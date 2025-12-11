"use strict";

/*
  Game-related endpoints (join/leave/roll/pass/notify/ranking).
  Uses storage.js for persistent counters under 'games' and 'victories'.
  Authentication uses storage.verifyPassword().
*/

const utils = require("./utils");
const storage = require("./storage");
const crypto = require("crypto");

// reuse snapshot helper from update.js if available (avoid duplication)
let snapshotFromUpdate = null;
try {
  // require lazily to avoid circular require problems; update.js exports snapshotForClient
  snapshotFromUpdate = require("./update").snapshotForClient;
} catch (e) {
  snapshotFromUpdate = null;
}

/**
 * ensureGame
 * - Create and return a game object for the given gameId if it doesn't exist.
 * - Each game object contains: { size, players:[], turnIndex, pieces: Map<nick,array>, winner }
 * - Returns the game object (existing or newly created).
 */
function ensureGame(gameId, size = 6) {
  if (!storage.games.has(gameId)) {
    storage.games.set(gameId, {
      size,
      players: [],
      turnIndex: 0,
      pieces: new Map(),
      winner: null,
    });
  }
  return storage.games.get(gameId);
}

/**
 * getTurnNick
 * - Returns the nick of the player whose turn it currently is, or null if no players.
 */
function getTurnNick(game) {
  if (!game.players.length) return null;
  return game.players[game.turnIndex];
}

/**
 * nextTurn
 * - Advances the game's turnIndex to the next player and returns that player's nick.
 * - Wraps around using modulo arithmetic.
 * - If there are no players returns null.
 */
function nextTurn(game) {
  if (!game.players.length) return null;
  game.turnIndex = (game.turnIndex + 1) % game.players.length;
  return game.players[game.turnIndex];
}

/**
 * broadcastGameEvent
 * - Sends an SSE event to every connected SSE client whose key ends with `:${gameId}`.
 * - NOTE: we send plain "data: ..." messages (no "event: ...") so clients using
 *   EventSource.onmessage will receive them.
 * - data: payload object (will be JSON.stringified).
 */
function broadcastGameEvent(gameId, /*string*/ eventName, data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const [key, res] of storage.sseClients.entries()) {
    if (key.endsWith(`:${gameId}`)) {
      try {
        if (!res.writableEnded) res.write(payload);
      } catch (e) {
        // ignore write errors for individual clients
      }
    }
  }
}

/*
  Build the start snapshot to match the required format:
  - pieces: array of length 4 * size
  - initial: first player nick
  - step: "from"
  - turn: first player nick
  - players: { nick1: "Blue", nick2: "Red" }
*/
function buildStartSnapshot(game) {
  // prefer using the snapshot helper from update.js if available
  if (snapshotFromUpdate) {
    const s = snapshotFromUpdate(
      game ? (typeof game === "string" ? game : game.id) : null
    );
    // snapshotFromUpdate expects gameId; but if passed object return fallback below
    // we'll fallback to local builder when necessary
  }

  const size = game.size;
  const boardLen = 4 * size;
  const board = new Array(boardLen).fill(null);

  const players = game.players.slice();
  const player1 = players[0] || null;
  const player2 = players[1] || null;

  // colors: player1 = Blue, player2 = Red
  const colorMap = {};
  if (player1) colorMap[player1] = "Blue";
  if (player2) colorMap[player2] = "Red";

  // place player1 pieces at positions 0 .. size-1
  if (player1) {
    for (let i = 0; i < size; i++) {
      board[i] = { color: "Blue", inMotion: false, reachedLastRow: false };
    }
  }

  // place player2 pieces at positions 3*size .. 4*size-1
  if (player2) {
    for (let i = 0; i < size; i++) {
      const pos = 3 * size + i;
      board[pos] = { color: "Red", inMotion: false, reachedLastRow: false };
    }
  }

  return {
    pieces: board,
    initial: player1,
    step: "from",
    turn: player1,
    players: colorMap,
  };
}

/*
  POST /join
  Body: { nick, password, size, group }
  Behavior:
  - First player: create game, register them, DO NOT send any 'update' snapshot back.
  - Second player: when they join, initialize starting positions, respond to any
    waiting GETs (long-poll) for that game with the snapshot, and also return the
    game id in the POST response.
*/
async function handleJoin(req, res) {
  try {
    const body = await utils.parseJSONBody(req);
    const { nick, password, size, group } = body;

    if (!utils.isNonEmptyString(nick) || !utils.isNonEmptyString(password)) {
      return utils.sendError(res, 400, "nick and password required");
    }

    const numSize = utils.toInt(size);
    const numGroup = utils.toInt(group);

    // require at least one valid integer >= 1
    if (
      (!Number.isInteger(numSize) || numSize < 1) &&
      (!Number.isInteger(numGroup) || numGroup < 1)
    ) {
      return utils.sendError(res, 400, "size must be integer >= 1");
    }

    const sizeInt =
      Number.isInteger(numSize) && numSize >= 1 ? numSize : numGroup;

    if (!storage.getUser(nick) || !storage.verifyPassword(nick, password)) {
      return utils.sendError(res, 401, "invalid credentials");
    }

    // try to find an existing waiting game with matching size
    let gameId = null;
    for (const [gid, g] of storage.games.entries()) {
      if (!g.winner && g.players.length < 2 && g.size === sizeInt) {
        gameId = gid;
        break;
      }
    }

    // if none, create a new game id
    if (!gameId) {
      gameId = crypto.randomBytes(8).toString("hex");
    }

    // ensure game exists (use sizeInt for new games)
    const g = ensureGame(gameId, sizeInt);

    // add player if not already present
    if (!g.players.includes(nick)) {
      g.players.push(nick);
      // set temporary default positions (will be set correctly when second player arrives)
      g.pieces.set(nick, Array(g.size).fill(0));
    }

    // If this join made the game start (now has 2 players), initialize start positions
    if (g.players.length === 2) {
      const p1 = g.players[0];
      const p2 = g.players[1];

      // set internal piece position arrays to starting indices
      const positionsP1 = [];
      const positionsP2 = [];
      for (let i = 0; i < g.size; i++) {
        positionsP1.push(i); // 0..size-1
        positionsP2.push(3 * g.size + i); // 3*size .. 4*size-1
      }
      g.pieces.set(p1, positionsP1);
      g.pieces.set(p2, positionsP2);

      // ensure turn starts with first player and no winner
      g.turnIndex = 0;
      g.winner = null;

      // build snapshot
      const snap = buildStartSnapshot(g);

      // broadcast 'update' to any SSE clients (first player has its EventSource open and will get this)
      broadcastGameEvent(gameId, "update", snap);

      // respond to any long-poll GET clients waiting for this game's start (if you kept that mechanism)
      const waiters =
        storage.waitingClients && storage.waitingClients.get
          ? storage.waitingClients.get(gameId)
          : null;
      if (Array.isArray(waiters)) {
        for (const w of waiters.slice()) {
          try {
            if (w.timer) clearTimeout(w.timer);
            utils.sendJSON(w.res, 200, snap);
          } catch (e) {
            // ignore per-client errors
          }
        }
        if (storage.waitingClients) storage.waitingClients.delete(gameId);
      }

      // ALSO return the snapshot in the HTTP POST /join response for the joining client
      // this avoids a race where the joining client opens its EventSource after the broadcast and misses it
      return utils.sendJSON(res, 200, { game: gameId });
    }

    // For the first player we return only the game id and do NOT send any snapshot
    return utils.sendJSON(res, 200, { game: gameId });
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

async function handleLeave(req, res) {
  try {
    const body = await utils.parseJSONBody(req);
    const { nick, password, game } = body;
    if (
      !utils.isNonEmptyString(nick) ||
      !utils.isNonEmptyString(password) ||
      !utils.isNonEmptyString(game)
    ) {
      return utils.sendError(res, 400, "nick, password and game required");
    }
    if (!storage.getUser(nick) || !storage.verifyPassword(nick, password))
      return utils.sendError(res, 401, "invalid credentials");

    const g = storage.games.get(game);
    if (!g) return utils.sendError(res, 404, "game not found");

    // capture participants before modification so finalizeGameResult can be accurate
    const participantsBefore = g.players.slice();

    // remove leaving player
    g.players = g.players.filter((p) => p !== nick);

    // CASE: nobody left in game (player left while waiting) -> treat as draw and remove game
    if (g.players.length === 0) {
      // notify any SSE clients for this game with draw and close their connections
      for (const [skey, sres] of Array.from(storage.sseClients.entries())) {
        if (skey.endsWith(`:${game}`)) {
          try {
            sres.write(`data: ${JSON.stringify({ winner: null })}\n\n`);
          } catch (e) {
            // ignore
          }
          try {
            sres.end();
          } catch (e) {
            // ignore
          }
          storage.sseClients.delete(skey);
        }
      }

      // remove the game from memory
      storage.games.delete(game);

      return utils.sendJSON(res, 200, {});
    }

    // CASE: one player remains -> they are the winner
    if (g.players.length === 1) {
      const winner = g.players[0];
      g.winner = winner;

      // finalize game result for both participants (increment games for both, victory for winner)
      try {
        storage.finalizeGameResult(participantsBefore, winner);
      } catch (e) {
        console.warn("Warning: finalizeGameResult failed for", winner, e);
      }

      // broadcast leave/update and then send final winner to SSE clients and close
      broadcastGameEvent(game, "leave", {
        players: g.players.slice(),
        winner: g.winner || null,
      });

      // notify SSE clients with final winner and close connections
      for (const [skey, sres] of Array.from(storage.sseClients.entries())) {
        if (skey.endsWith(`:${game}`)) {
          try {
            sres.write(`data: ${JSON.stringify({ winner: g.winner })}\n\n`);
          } catch (e) {
            /* ignore */
          }
          try {
            sres.end();
          } catch (e) {
            /* ignore */
          }
          storage.sseClients.delete(skey);
        }
      }

      // remove the game from memory
      storage.games.delete(game);

      return utils.sendJSON(res, 200, {});
    }

    // fallback: (shouldn't normally happen) broadcast updated players list
    broadcastGameEvent(game, "leave", {
      players: g.players.slice(),
      winner: g.winner || null,
    });
    return utils.sendJSON(res, 200, {});
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

async function handleRoll(req, res) {
  try {
    const body = await utils.parseJSONBody(req);
    const { nick, password, game, cell } = body;
    if (
      !utils.isNonEmptyString(nick) ||
      !utils.isNonEmptyString(password) ||
      !utils.isNonEmptyString(game)
    )
      return utils.sendError(res, 400, "nick, password, game required");
    const cellInt = utils.toInt(cell);
    if (!Number.isInteger(cellInt) || cellInt < 0)
      return utils.sendError(res, 400, "cell must be integer >= 0");

    if (!storage.getUser(nick) || !storage.verifyPassword(nick, password))
      return utils.sendError(res, 401, "invalid credentials");

    const g = storage.games.get(game);
    if (!g) return utils.sendError(res, 404, "game not found");
    if (g.winner) return utils.sendError(res, 409, "game finished");
    if (getTurnNick(g) !== nick)
      return utils.sendError(res, 403, "not your turn");

    const dice = Math.floor(Math.random() * 6) + 1;
    const pieces = g.pieces.get(nick) || Array(g.size).fill(0);
    const pieceIndex = Math.min(cellInt, pieces.length - 1);
    const from = pieces[pieceIndex];
    const to = from + dice;
    pieces[pieceIndex] = to;
    g.pieces.set(nick, pieces);

    const finishLine = g.size * 10;
    let winner = null;
    if (to >= finishLine) {
      winner = nick;
      g.winner = nick;
      try {
        storage.incrementVictories(nick);
      } catch (e) {
        console.warn("Warning: failed to persist victory for", nick, e);
      }
    }
    const next = winner ? null : nextTurn(g);

    const resp = {
      ok: true,
      dice,
      cell: to,
      selected: [from, to],
      step: 1,
      pieces: (() => {
        const o = {};
        for (const [k, arr] of g.pieces.entries()) o[k] = arr.slice();
        return o;
      })(),
      turn: next,
      winner: winner || null,
    };

    broadcastGameEvent(game, "roll", resp);
    return utils.sendJSON(res, 200, resp);
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

async function handlePass(req, res) {
  try {
    const body = await utils.parseJSONBody(req);
    const { nick, password, game } = body;
    if (
      !utils.isNonEmptyString(nick) ||
      !utils.isNonEmptyString(password) ||
      !utils.isNonEmptyString(game)
    )
      return utils.sendError(res, 400, "nick, password, game required");

    if (!storage.getUser(nick) || !storage.verifyPassword(nick, password))
      return utils.sendError(res, 401, "invalid credentials");

    const g = storage.games.get(game);
    if (!g) return utils.sendError(res, 404, "game not found");
    if (g.winner) return utils.sendError(res, 409, "game finished");
    if (getTurnNick(g) !== nick)
      return utils.sendError(res, 403, "not your turn");

    const next = nextTurn(g);
    const resp = { ok: true, game, turn: next, mustPass: true };
    broadcastGameEvent(game, "pass", resp);
    return utils.sendJSON(res, 200, resp);
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

async function handleNotify(req, res) {
  try {
    const body = await utils.parseJSONBody(req);
    const { nick, password, game, cell } = body;
    if (
      !utils.isNonEmptyString(nick) ||
      !utils.isNonEmptyString(password) ||
      !utils.isNonEmptyString(game)
    )
      return utils.sendError(res, 400, "nick, password, game required");
    const cellInt = utils.toInt(cell);
    if (!Number.isInteger(cellInt) || cellInt < 0)
      return utils.sendError(res, 400, "cell must be integer >= 0");

    if (!storage.getUser(nick) || !storage.verifyPassword(nick, password))
      return utils.sendError(res, 401, "invalid credentials");

    const g = storage.games.get(game);
    if (!g) return utils.sendError(res, 404, "game not found");

    const pieces = g.pieces.get(nick) || Array(g.size).fill(0);
    const from = pieces[0];
    pieces[0] = cellInt;
    g.pieces.set(nick, pieces);

    const resp = {
      ok: true,
      cell: cellInt,
      selected: [from, cellInt],
      pieces: (() => {
        const o = {};
        for (const [k, arr] of g.pieces.entries()) o[k] = arr.slice();
        return o;
      })(),
      turn: getTurnNick(g),
    };
    broadcastGameEvent(game, "notify", resp);
    return utils.sendJSON(res, 200, resp);
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

async function handleRanking(req, res) {
  try {
    // accept query param or POST JSON body
    const q = utils.parseUrlEncoded(req.url);
    let nick = q.nick;

    if (req.method === "POST") {
      try {
        const body = await utils.parseJSONBody(req);
        if (body && typeof body.nick === "string" && body.nick.trim() !== "") {
          nick = body.nick;
        }
      } catch (e) {
        // ignore body parse errors for ranking; we can still proceed
      }
    }

    // Do not require nick — return ranking regardless (matches teacher server)
    try {
      const ranking = storage.getRanking(20); // array of { nick, victories, games }
      return utils.sendJSON(res, 200, { ok: true, ranking });
    } catch (e) {
      console.warn("Warning: getRanking failed, falling back", e);
      const ranking = Array.from(storage.users.entries()).map(([n, u]) => ({
        nick: n,
        victories: u.victories || 0,
        games: u.games || 0,
      }));
      ranking.sort((a, b) => b.victories - a.victories);
      return utils.sendJSON(res, 200, { ok: true, ranking });
    }
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

module.exports = {
  handleJoin,
  handleLeave,
  handleRoll,
  handlePass,
  handleNotify,
  handleRanking,
};