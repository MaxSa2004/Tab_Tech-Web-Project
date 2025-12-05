"use strict";

/*
  Server-Sent Events endpoint (GET /update?nick=...&game=...)
  - registers the response as SSE client and sends initial snapshot
  - keeps connection alive with comments keepalive
*/

const utils = require("./utils");
const storage = require("./storage");

/**
 * snapshotForClient - build a serializable snapshot of a game's state to send to a client.
 * @param {string} gameId
 * @returns {Object}
 */
function snapshotForClient(gameId) {
  const game = storage.games.get(gameId);
  if (!game)
    return {
      players: [],
      pieces: {},
      turn: null,
      initial: null,
      mustPass: false,
      winner: null,
    };
  const piecesObj = {};
  for (const [nick, arr] of game.pieces.entries())
    piecesObj[nick] = arr.slice();
  return {
    players: game.players.slice(),
    pieces: piecesObj,
    turn: game.players[game.turnIndex] || null,
    initial: game.players[0] || null,
    mustPass: false,
    winner: game.winner,
  };
}

/**
 * handleUpdate - SSE handler that accepts query params ?nick=...&game=...
 * - Validates parameters
 * - Sets response headers for SSE
 * - Stores the response in storage.sseClients so other modules can broadcast
 * - Sends an initial 'update' event with current snapshot
 * - Sets up a keepalive interval and cleans up on connection close
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 */
function handleUpdate(req, res) {
  const q = utils.parseUrlEncoded(req.url);
  const { nick, game } = q;
  if (!utils.isNonEmptyString(nick) || !utils.isNonEmptyString(game))
    return utils.sendError(res, 400, "nick and game required");

  // Allow cross-origin EventSource connections (if needed)
  utils.setCorsHeaders(res);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("\n");

  const key = `${nick}:${game}`;
  storage.sseClients.set(key, res);

  // send initial snapshot event
  const snap = snapshotForClient(game);
  res.write(`event: update\ndata: ${JSON.stringify(snap)}\n\n`);

  // keep connection alive with SSE comments
  const keep = setInterval(() => {
    if (!res.writableEnded) res.write(": keepalive\n\n");
  }, 20000);
  req.on("close", () => {
    clearInterval(keep);
    storage.sseClients.delete(key);
  });
}

module.exports = { handleUpdate };
