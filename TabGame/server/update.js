"use strict";

/*
  Server-Sent Events endpoint (GET /update?nick=...&game=...)
  - registers the response as SSE client and keeps the connection alive
  - does NOT send any data on registration unless the game already has 2 players,
    in which case it sends the start snapshot immediately to the registering client
  - starts a per-client inactivity timer (WAIT_TIMEOUT_MS):
      * if the game has <2 players when the timer fires => treat as draw { winner: null }
      * if the game has 2 players when the timer fires => opponent wins
  - server-side writes (broadcasts) reset the inactivity timer; keepalive comments do not
*/

const utils = require("./utils");
const storage = require("./storage");

// inactivity / wait timeout in ms
const WAIT_TIMEOUT_MS = (1 * 60 * 1000)/2; // 2 minutes

function snapshotForClient(gameId) {
  const game = storage.games.get(gameId);
  if (!game) return null;

  const size = game.size;
  const boardLen = 4 * size;
  const board = new Array(boardLen).fill(null);

  const players = game.players.slice();
  const p1 = players[0] || null;
  const p2 = players[1] || null;
  const playersObj = {};
  if (p1) playersObj[p1] = "Blue";
  if (p2) playersObj[p2] = "Red";

  for (const nick of players) {
    const color = playersObj[nick];
    const positions = game.pieces.get(nick) || [];
    for (const pos of positions) {
      if (Number.isInteger(pos) && pos >= 0 && pos < boardLen) {
        board[pos] = { color, inMotion: false, reachedLastRow: false };
      }
    }
  }

  return {
    pieces: board,
    initial: p1,
    step: "from",
    turn: players[game.turnIndex] || null,
    players: playersObj,
  };
}

function handleInactivityExpired(nick, gameId) {
  try {
    console.log(`[update] inactivity timeout for ${nick}@${gameId}`);
    const game = storage.games.get(gameId);

    if (!game || game.players.length < 2) {
      // pairing never completed -> draw
      for (const [k, cres] of Array.from(storage.sseClients.entries())) {
        if (k.endsWith(`:${gameId}`)) {
          try { cres.write(`data: ${JSON.stringify({ winner: null })}\n\n`); } catch (e) {}
          try { cres.end(); } catch (e) {}
          storage.sseClients.delete(k);
        }
      }
      storage.games.delete(gameId);
      console.log(`[update] game ${gameId} removed due to timeout (draw)`);
      return;
    }

    // active game -> opponent wins
    const opponents = game.players.filter(p => p !== nick);
    const winnerNick = opponents.length > 0 ? opponents[0] : null;

    if (winnerNick) {
      try { storage.finalizeGameResult(game.players, winnerNick); } catch (e) { console.warn("persist victory failed", e); }
    }

    for (const [k, cres] of Array.from(storage.sseClients.entries())) {
      if (k.endsWith(`:${gameId}`)) {
        try { cres.write(`data: ${JSON.stringify({ winner: winnerNick })}\n\n`); } catch (e) {}
        try { cres.end(); } catch (e) {}
        storage.sseClients.delete(k);
      }
    }

    storage.games.delete(gameId);
    console.log(`[update] game ${gameId} ended due to inactivity; winner=${winnerNick}`);
  } catch (err) {
    console.error("[update] error handling inactivity timeout:", err);
  }
}

function handleUpdate(req, res) {
  const q = utils.parseUrlEncoded(req.url);
  const { nick, game } = q;
  if (!utils.isNonEmptyString(nick) || !utils.isNonEmptyString(game))
    return utils.sendError(res, 400, "nick and game required");

  // set headers
  utils.setCorsHeaders(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // keep original write to use for keepalives and for direct writes when needed
  if (!res._originalWrite) res._originalWrite = res.write.bind(res);

  // wrap res.write so server-written updates reset the inactivity timer.
  if (!res._patchedWrite) {
    res._patchedWrite = function (...args) {
      let ok = false;
      try { ok = res._originalWrite(...args); } catch (e) { /* ignore write error */ }
      try {
        if (res._inactivityTimer) clearTimeout(res._inactivityTimer);
        res._inactivityTimer = setTimeout(() => handleInactivityExpired(nick, game), WAIT_TIMEOUT_MS);
      } catch (e) {}
      return ok;
    };
    // set res.write to patchedWrite for server writes
    res.write = res._patchedWrite;
  }

  const key = `${nick}:${game}`;
  console.log("[update] SSE register:", key);
  storage.sseClients.set(key, res);

  // start inactivity timer now (will be reset by server writes)
  if (res._inactivityTimer) clearTimeout(res._inactivityTimer);
  res._inactivityTimer = setTimeout(() => handleInactivityExpired(nick, game), WAIT_TIMEOUT_MS);

  // If the game already has 2 players, immediately send the snapshot to this registering client
  // (this allows player 2 who opens SSE after joining to receive the start snapshot)
  const g = storage.games.get(game);
  if (g && g.players.length >= 2) {
    try {
      const snap = snapshotForClient(game);
      if (snap) {
        res.write(`data: ${JSON.stringify(snap)}\n\n`); // patched write will reset timer
        console.log("[update] immediate snapshot sent to", key);
      }
      // No need to clear the timer — patched write already restarted it
    } catch (e) {
      // ignore
    }
  }

  // keepalive comments — use originalWrite so keepalive does NOT reset inactivity timer
  const keep = setInterval(() => {
    try {
      if (!res.writableEnded && res._originalWrite) res._originalWrite(": keepalive\n\n");
    } catch (e) {
      // ignore
    }
  }, 20000);

  req.on("close", () => {
    console.log("[update] SSE closed by client:", key);
    clearInterval(keep);
    if (res._inactivityTimer) {
      clearTimeout(res._inactivityTimer);
      delete res._inactivityTimer;
    }
    // restore write (best-effort)
    if (res._originalWrite) {
      try { res.write = res._originalWrite; } catch (e) {}
      delete res._patchedWrite;
    }
    storage.sseClients.delete(key);
  });
}

function resetInactivityTimerFor(nick, gameId) {
  const key = `${nick}:${gameId}`;
  const res = storage.sseClients.get(key);
  if (!res) return false;
  try {
    if (res._inactivityTimer) clearTimeout(res._inactivityTimer);
    res._inactivityTimer = setTimeout(() => handleInactivityExpired(nick, gameId), WAIT_TIMEOUT_MS);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { handleUpdate, snapshotForClient, resetInactivityTimerFor };