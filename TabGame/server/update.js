"use strict";

/*
  SSE now reads state directly from storage.games (Map<gameId, { size, state }>).
*/

const utils = require("./utils");
const storage = require("./storage");

const WAIT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

function snapshotForClient(gameId) {
  const rec = storage.games.get(gameId);
  if (!rec || !rec.state) return null;
  // return the exact stored state
  return rec.state;
}

function handleInactivityExpired(nick, gameId) {
  try {
    console.log(`[update] inactivity timeout for ${nick}@${gameId}`);
    const rec = storage.games.get(gameId);
    const state = rec ? rec.state : null;

    // pairing incomplete -> draw
    const players = state ? Object.keys(state.players) : [];
    if (!state || players.length < 2) {
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

    // opponent wins
    const winnerNick = players.find((p) => p !== nick) || null;
    if (winnerNick) {
      try { storage.finalizeGameResult(players, winnerNick); } catch (e) {}
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

  utils.setCorsHeaders(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  if (!res._originalWrite) res._originalWrite = res.write.bind(res);

  if (!res._patchedWrite) {
    res._patchedWrite = function (...args) {
      let ok = false;
      try { ok = res._originalWrite(...args); } catch (e) {}
      try {
        if (res._inactivityTimer) clearTimeout(res._inactivityTimer);
        res._inactivityTimer = setTimeout(() => handleInactivityExpired(nick, game), WAIT_TIMEOUT_MS);
      } catch (e) {}
      return ok;
    };
    res.write = res._patchedWrite;
  }

  const key = `${nick}:${game}`;
  console.log("[update] SSE register:", key);
  storage.sseClients.set(key, res);

  if (res._inactivityTimer) clearTimeout(res._inactivityTimer);
  res._inactivityTimer = setTimeout(() => handleInactivityExpired(nick, game), WAIT_TIMEOUT_MS);

  // If game already has 2 players, send snapshot immediately
  const rec = storage.games.get(game);
  const state = rec ? rec.state : null;
  const players = state ? Object.keys(state.players) : [];
  if (state && players.length == 2) {
    try {
      res.write(`data: ${JSON.stringify(state)}\n\n`);
      console.log("[update] immediate snapshot sent to", key);
    } catch (e) {}
  }

  const keep = setInterval(() => {
    try {
      if (!res.writableEnded && res._originalWrite) res._originalWrite(": keepalive\n\n");
    } catch (e) {}
  }, 20000);

  req.on("close", () => {
    console.log("[update] SSE closed by client:", key);
    clearInterval(keep);
    if (res._inactivityTimer) {
      clearTimeout(res._inactivityTimer);
      delete res._inactivityTimer;
    }
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

module.exports = { 
  handleUpdate, 
  snapshotForClient, 
  resetInactivityTimerFor
};