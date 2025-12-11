"use strict";

/*
  Game-related endpoints (join/leave/roll/pass/notify/ranking).
  Uses storage.js for persistent counters under 'games' and 'victories'.
  Authentication uses storage.verifyPassword().
*/

const utils = require("./utils");
const storage = require("./storage");
const crypto = require("crypto");
const update = require('./update');

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
    const { nick, password, game } = body;

    if (
      !utils.isNonEmptyString(nick) ||
      !utils.isNonEmptyString(password) ||
      !utils.isNonEmptyString(game)
    ) {
      return utils.sendError(res, 400, "nick, password, game required");
    }

    if (!storage.getUser(nick) || !storage.verifyPassword(nick, password))
      return utils.sendError(res, 401, "invalid credentials");

    const g = storage.games.get(game);
    if (!g) return utils.sendError(res, 404, "game not found");
    if (g.winner) return utils.sendError(res, 409, "game finished");
    if (getTurnNick(g) !== nick) return utils.sendError(res, 403, "not your turn");

    // --- simulate stick-dice using weighted distribution ---
    // distribution over up-counts 0..4: probs [0.06, 0.25, 0.38, 0.25, 0.06]
    const upProb = [0.06, 0.25, 0.38, 0.25, 0.06];
    const r = Math.random();
    let cum = 0;
    let chosenUp = 2; // default
    for (let i = 0; i < upProb.length; i++) {
      cum += upProb[i];
      if (r <= cum) { chosenUp = i; break; }
    }
    // build stickValues: chosenUp positions set to true randomly
    const indices = [0,1,2,3];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const stickValues = [false, false, false, false];
    for (let i = 0; i < chosenUp; i++) stickValues[indices[i]] = true;

    const value = (chosenUp === 0) ? 6 : chosenUp;
    const keepPlaying = (value === 1 || value === 4 || value === 6);

    // --- determine whether the player has any legal moves for this roll ---
    const size = g.size;
    const boardLen = 4 * size;
    const myPositions = (g.pieces.get(nick) || []).slice(); // numeric indices of their pieces
    // build occupancy map: index -> ownerNick
    const occ = new Map();
    for (const [playerNick, arr] of g.pieces.entries()) {
      for (const pos of (arr || [])) {
        if (Number.isInteger(pos) && pos >= 0 && pos < boardLen) occ.set(pos, playerNick);
      }
    }

    function hasMovesAvailable() {
      if (!Array.isArray(myPositions) || myPositions.length === 0) return false;
      for (const pos of myPositions) {
        if (!Number.isInteger(pos)) continue;
        const dest = pos + value;
        if (dest < 0 || dest >= boardLen) continue;
        const ownerAtDest = occ.get(dest);
        // legal if destination not occupied by own piece
        if (ownerAtDest !== nick) return true;
      }
      return false;
    }

    const movesAvailable = hasMovesAvailable();

    // mustPass: if no available moves AND this roll does not grant keepPlaying (i.e., no extra roll)
    const mustPass = (!movesAvailable && !keepPlaying) ? nick : null;

    // Build response payload
    const dicePayload = {
      stickValues,
      value,
      keepPlaying,
    };

    const resp = {
      dice: dicePayload,
      turn: getTurnNick(g), // current player (still nick, they rolled)
      mustPass: mustPass,
    };

    // Broadcast to SSE clients (so both players get the roll result)
    broadcastGameEvent(game, "roll", resp);

    // Respond to the HTTP POST caller
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
    if (getTurnNick(g) !== nick) return utils.sendError(res, 403, "not your turn");

    // Advance turn
    const next = nextTurn(g);

    // Build a snapshot for broadcast (prefer update.snapshot helper if available)
    let snap = null;
    if (typeof snapshotFromUpdate === "function") {
      snap = snapshotFromUpdate(game);
    }

    if (!snap) {
      const size = g.size;
      const boardLen = 4 * size;
      const board = new Array(boardLen).fill(null);

      const players = g.players.slice();
      const p1 = players[0] || null;
      const p2 = players[1] || null;
      const playersObj = {};
      if (p1) playersObj[p1] = "Blue";
      if (p2) playersObj[p2] = "Red";

      for (const nickKey of players) {
        const color = playersObj[nickKey];
        const positions = g.pieces.get(nickKey) || [];
        for (const pos of positions) {
          if (Number.isInteger(pos) && pos >= 0 && pos < boardLen) {
            board[pos] = { color, inMotion: false, reachedLastRow: false };
          }
        }
      }

      snap = {
        pieces: board,
        initial: g.players[0] || null,
        step: "from",
        turn: next || null,
        players: playersObj,
        dice: null,
      };
    } else {
      snap.turn = next || null;
      snap.dice = null;
    }

    // Broadcast the snapshot to SSE clients (both players will receive this)
    broadcastGameEvent(game, "pass", snap);
    try { update.resetInactivityTimerFor(next, game); } catch (e) { /* ignore */ }

    // Return an empty object to the HTTP caller as requested
    return utils.sendJSON(res, 200, {});
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