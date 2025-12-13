"use strict";

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
    const rec = storage.games.get(gameId);
    const state = rec ? rec.state : null;

    // pairing incomplete -> draw
    const players = state ? Object.keys(state.players) : [];
    if (!state || players.length < 2) {
      for (const [k, cres] of Array.from(storage.sseClients.entries())) {
        if (k.endsWith(`:${gameId}`)) {
          try {
            cres.write(`data: ${JSON.stringify({ winner: null })}\n\n`);
          } catch (e) {}
          try {
            cres.end();
          } catch (e) {}
          storage.sseClients.delete(k);
        }
      }
      storage.games.delete(gameId);
      return;
    }

    // opponent of the timed-out nick wins
    const winnerNick = players.find((p) => p !== nick) || null;
    if (winnerNick) {
      try {
        storage.finalizeGameResult(players, winnerNick);
      } catch (e) {}
    }

    for (const [k, cres] of Array.from(storage.sseClients.entries())) {
      if (k.endsWith(`:${gameId}`)) {
        try {
          cres.write(`data: ${JSON.stringify({ winner: winnerNick })}\n\n`);
        } catch (e) {}
        try {
          cres.end();
        } catch (e) {}
        storage.sseClients.delete(k);
      }
    }

    storage.games.delete(gameId);
  } catch (err) {
    // ignore
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

  // Only refresh inactivity for the player whose turn it is
  if (!res._patchedWrite) {
    res._patchedWrite = function (...args) {
      let ok = false;
      try {
        ok = res._originalWrite(...args);
      } catch (e) {}
      try {
        const recNow = storage.games.get(game);
        const isCurrentTurn =
          recNow && recNow.state && recNow.state.turn === nick;
        if (isCurrentTurn) {
          if (res._inactivityTimer) clearTimeout(res._inactivityTimer);
          res._inactivityTimer = setTimeout(
            () => handleInactivityExpired(nick, game),
            WAIT_TIMEOUT_MS
          );
        }
      } catch (e) {}
      return ok;
    };
    res.write = res._patchedWrite;
  }

  const key = `${nick}:${game}`;
  storage.sseClients.set(key, res);

  // Set the inactivity timer ONLY if it's currently this player's turn
  try {
    const rec = storage.games.get(game);
    const state = rec ? rec.state : null;
    const currentTurn = state ? state.turn : null;
    if (currentTurn === nick) {
      if (res._inactivityTimer) clearTimeout(res._inactivityTimer);
      res._inactivityTimer = setTimeout(
        () => handleInactivityExpired(nick, game),
        WAIT_TIMEOUT_MS
      );
    } else {
      // ensure no timer is running for non-turn clients
      if (res._inactivityTimer) {
        clearTimeout(res._inactivityTimer);
        delete res._inactivityTimer;
      }
    }
  } catch (e) {}

  // If game already has 2 players, send snapshot immediately
  const rec = storage.games.get(game);
  const state = rec ? rec.state : null;
  const players = state ? Object.keys(state.players) : [];
  if (state && players.length == 2) {
    try {
      res.write(`data: ${JSON.stringify(state)}\n\n`);
    } catch (e) {}
  }

  const keep = setInterval(() => {
    try {
      if (!res.writableEnded && res._originalWrite)
        res._originalWrite(": keepalive\n\n"); // keepalive does NOT reset inactivity
    } catch (e) {}
  }, 20000);

  req.on("close", () => {
    clearInterval(keep);
    if (res._inactivityTimer) {
      clearTimeout(res._inactivityTimer);
      delete res._inactivityTimer;
    }
    if (res._originalWrite) {
      try {
        res.write = res._originalWrite;
      } catch (e) {}
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
    res._inactivityTimer = setTimeout(
      () => handleInactivityExpired(nick, gameId),
      WAIT_TIMEOUT_MS
    );
    return true;
  } catch (e) {
    return false;
  }
}

function clearInactivityTimerFor(nick, gameId) {
  const key = `${nick}:${gameId}`;
  const res = storage.sseClients.get(key);
  if (!res) return false;
  try {
    if (res._inactivityTimer) {
      clearTimeout(res._inactivityTimer);
      delete res._inactivityTimer;
    }
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  handleUpdate,
  snapshotForClient,
  resetInactivityTimerFor,
  clearInactivityTimerFor,
};
