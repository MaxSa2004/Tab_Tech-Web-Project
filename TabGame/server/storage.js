"use strict";

/*
  Central in-memory storage module.

  Exports singletons so all handler modules share the same in-memory state.
  Swap this module for a persistent DB implementation later if needed.
*/

/**
 * users - Map of nick -> { password, wins, plays }
 * Stores user credentials and simple statistics for ranking.
 */
const users = new Map();

/**
 * games - Map of gameId -> gameObject
 * gameObject: { size, players:[], turnIndex, pieces: Map<nick, array>, winner }
 */
const games = new Map();

/**
 * sseClients - Map of `${nick}:${game}` -> ServerResponse
 * Used to broadcast SSE events to connected clients.
 */
const sseClients = new Map();

module.exports = {
  users,
  games,
  sseClients,
};
