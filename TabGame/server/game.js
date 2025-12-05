"use strict";

/*
  Game-related endpoints:
  - POST /join
  - POST /leave
  - POST /roll
  - POST /pass
  - POST /notify
  - GET  /ranking
  Uses storage.js singletons and utils for parsing/response.
*/

const utils = require("./utils");
const storage = require("./storage");

/**
 * ensureGame - create a new game object if it doesn't exist.
 * @param {string} gameId
 * @param {number} size
 * @returns {Object} game object
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
 * getTurnNick - return the nick of the player whose turn it is.
 * @param {Object} game
 * @returns {string|null}
 */
function getTurnNick(game) {
  if (!game.players.length) return null;
  return game.players[game.turnIndex];
}

/**
 * nextTurn - advance the turn index and return the next player's nick.
 * @param {Object} game
 * @returns {string|null}
 */
function nextTurn(game) {
  if (!game.players.length) return null;
  game.turnIndex = (game.turnIndex + 1) % game.players.length;
  return game.players[game.turnIndex];
}

/**
 * broadcastGameEvent - broadcast an event payload to all SSE clients listening to a game.
 * Uses storage.sseClients map.
 * @param {string} gameId
 * @param {string} eventName
 * @param {Object} data
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
 * handleJoin - join a player to a game (creates game if needed).
 * Request body: { nick, password, size, game }
 * Validates credentials and returns current players/pieces/turn info.
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
    const user = storage.users.get(nick);
    if (!user || user.password !== password)
      return utils.sendError(res, 401, "invalid credentials");

    const g = ensureGame(game, sizeInt);
    if (!g.players.includes(nick)) {
      g.players.push(nick);
      // initialize player's pieces to zero positions
      g.pieces.set(nick, Array(g.size).fill(0));
      user.plays = (user.plays || 0) + 1;
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
 * handleLeave - remove a player from a game.
 * Request body: { nick, password, game }
 * Updates game state and possibly marks a winner if only one player remains.
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
    const user = storage.users.get(nick);
    if (!user || user.password !== password)
      return utils.sendError(res, 401, "invalid credentials");
    const g = storage.games.get(game);
    if (!g) return utils.sendError(res, 404, "game not found");

    g.players = g.players.filter((p) => p !== nick);
    g.pieces.delete(nick);
    if (g.turnIndex >= g.players.length) g.turnIndex = 0;
    if (g.players.length === 1) {
      g.winner = g.players[0];
      const winnerUser = storage.users.get(g.winner);
      if (winnerUser) winnerUser.wins = (winnerUser.wins || 0) + 1;
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
 * handleRoll - perform a dice roll for the current player.
 * Request body: { nick, password, game, cell }
 * Validates turn, updates piece position, optionally marks winner, broadcasts update.
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
    const user = storage.users.get(nick);
    if (!user || user.password !== password)
      return utils.sendError(res, 401, "invalid credentials");
    const g = storage.games.get(game);
    if (!g) return utils.sendError(res, 404, "game not found");
    if (g.winner) return utils.sendError(res, 409, "game finished");
    if (getTurnNick(g) !== nick)
      return utils.sendError(res, 403, "not your turn");

    // Roll dice 1..6
    const dice = Math.floor(Math.random() * 6) + 1;
    const pieces = g.pieces.get(nick) || Array(g.size).fill(0);
    const pieceIndex = Math.min(cellInt, pieces.length - 1);
    const from = pieces[pieceIndex];
    const to = from + dice;
    pieces[pieceIndex] = to;
    g.pieces.set(nick, pieces);

    // Winner detection: demo rule (piece reaches finishLine)
    const finishLine = g.size * 10;
    let winner = null;
    if (to >= finishLine) {
      winner = nick;
      g.winner = nick;
      const u = storage.users.get(nick);
      if (u) u.wins = (u.wins || 0) + 1;
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
 * handlePass - current player passes their turn.
 * Request body: { nick, password, game }
 * Validates credentials and turn, advances to next player.
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
    const user = storage.users.get(nick);
    if (!user || user.password !== password)
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
 * handleNotify - accept a client-notified move.
 * Request body: { nick, password, game, cell }
 * Updates the player's pieces based on the provided cell.
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
    const user = storage.users.get(nick);
    if (!user || user.password !== password)
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
 * handleRanking - return a simple ranking table computed from users map.
 * GET query params: ?nick=...
 */
function handleRanking(req, res) {
  const q = utils.parseUrlEncoded(req.url);
  const { nick } = q;
  if (!utils.isNonEmptyString(nick))
    return utils.sendError(res, 400, "nick query required");
  const ranking = Array.from(storage.users.entries()).map(([n, u]) => ({
    nick: n,
    wins: u.wins || 0,
    plays: u.plays || 0,
  }));
  ranking.sort((a, b) => b.wins - a.wins);
  return utils.sendJSON(res, 200, { ok: true, ranking });
}

module.exports = {
  handleJoin,
  handleLeave,
  handleRoll,
  handlePass,
  handleNotify,
  handleRanking,
};
