"use strict";

/*
  Game-related endpoints (join/leave/roll/pass/notify/ranking).
  Uses storage.js for persistent counters under 'games' and 'victories'.
  Authentication uses storage.verifyPassword().
*/

const utils = require("./utils");
const storage = require("./storage");

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
 * - Sends an SSE event to every connected SSE client whose key ends with `:gameId`.
 * - eventName: string name of the event (e.g., 'join', 'roll').
 * - data: payload object (will be JSON.stringified).
 */
function broadcastGameEvent(gameId, eventName, data) {
  for (const [key, res] of storage.sseClients.entries()) {
    if (key.endsWith(`:${gameId}`)) {
      const payload =
        `event: ${eventName}\n` + `data: ${JSON.stringify(data)}\n\n`;
      res.write(payload);
    }
  }
}

/**
 * handleJoin
 * - POST /join
 * - Body: { nick, password, size, game }
 * - Validates credentials using storage.verifyPassword, creates or joins the player into the game.
 * - Initializes player's pieces array if joining for the first time.
 * - Increments persistent 'games' counter for the nick via storage.incrementGames.
 * - Broadcasts a 'join' SSE event and returns game snapshot.
 */
async function handleJoin(req, res) {
  try {
    const body = await utils.parseJSONBody(req);
    const { nick, password, size, game } = body;
    if (
      !utils.isNonEmptyString(nick) ||
      !utils.isNonEmptyString(password) ||
      !utils.isNonEmptyString(game)
    ) {
      return utils.sendError(res, 400, "nick, password and game required");
    }
    const sizeInt = utils.toInt(size);
    if (!Number.isInteger(sizeInt) || sizeInt < 1)
      return utils.sendError(res, 400, "size must be integer >= 1");

    if (!storage.getUser(nick) || !storage.verifyPassword(nick, password))
      return utils.sendError(res, 401, "invalid credentials");

    const g = ensureGame(game, sizeInt);
    if (!g.players.includes(nick)) {
      g.players.push(nick);
      g.pieces.set(nick, Array(g.size).fill(0));
      try {
        storage.incrementGames(nick);
      } catch (e) {
        console.warn("Warning: failed to persist games counter for", nick, e);
      }
    }

    const resp = {
      ok: true,
      game,
      players: g.players.slice(),
      initial: g.players[0] || null,
      pieces: (() => {
        const o = {};
        for (const [k, arr] of g.pieces.entries()) o[k] = arr.slice();
        return o;
      })(),
      turn: getTurnNick(g),
      mustPass: false,
    };
    broadcastGameEvent(game, "join", { players: resp.players });
    return utils.sendJSON(res, 200, resp);
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

/**
 * handleLeave
 * - POST /leave
 * - Body: { nick, password, game }
 * - Validates credentials and removes the player from the game.
 * - If only one player remains, that player is declared winner and their persistent
 *   'victories' counter is incremented via storage.incrementVictories.
 * - Broadcasts a 'leave' SSE event and returns updated game info.
 */
async function handleLeave(req, res) {
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

    g.players = g.players.filter((p) => p !== nick);
    g.pieces.delete(nick);
    if (g.turnIndex >= g.players.length) g.turnIndex = 0;

    if (g.players.length === 1) {
      g.winner = g.players[0];
      try {
        storage.incrementVictories(g.winner);
      } catch (e) {
        console.warn("Warning: failed to persist victory for", g.winner, e);
      }
    }

    broadcastGameEvent(game, "leave", {
      players: g.players.slice(),
      winner: g.winner || null,
    });
    return utils.sendJSON(res, 200, {
      ok: true,
      game,
      players: g.players.slice(),
      winner: g.winner || null,
    });
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

/**
 * handleRoll
 * - POST /roll
 * - Body: { nick, password, game, cell }
 * - Validates credentials and current turn, performs a dice roll (1..6),
 *   updates the specified piece, checks for a winner and increments victories if needed.
 * - Broadcasts a 'roll' SSE event and returns the roll result and updated state.
 */
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

/**
 * handlePass
 * - POST /pass
 * - Body: { nick, password, game }
 * - Validates credentials and current turn, advances to next player and broadcasts 'pass' event.
 */
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

/**
 * handleNotify
 * - POST /notify
 * - Body: { nick, password, game, cell }
 * - Validates credentials, updates player's piece position to provided cell, broadcasts 'notify' event.
 */
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

/**
 * handleRanking
 * - GET /ranking?nick=...  OR POST /ranking with JSON body
 * - Returns ranking using storage.getRanking(limit) which provides { nick, victories, games } entries.
 * - Note: nick is optional; we return ranking even if no nick provided (to match teacher server behavior).
 */
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
