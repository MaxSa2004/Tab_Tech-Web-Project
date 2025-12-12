"use strict";

/*
  Game endpoints rewritten to use storage.games as Map<gameId, { size, state }>.
*/

const utils = require("./utils");
const storage = require("./storage");
const crypto = require("crypto");
const update = require("./update");

/* helpers working on state only */

function createEmptyBoard(size) {
  return new Array(4 * size).fill(null);
}

function colorMapFor(players) {
  const map = {};
  if (players[0]) map[players[0]] = "Blue";
  if (players[1]) map[players[1]] = "Red";
  return map;
}

function buildInitialState(size, players) {
  const board = createEmptyBoard(size);
  const p1 = players[0] || null;
  const p2 = players[1] || null;

  // place player1 at 0..size-1
  if (p1) {
    for (let i = 0; i < size; i++) {
      board[i] = { color: "Blue", inMotion: false, reachedLastRow: false };
    }
  }
  // place player2 at 3*size .. 4*size-1
  if (p2) {
    for (let i = 0; i < size; i++) {
      const pos = 3 * size + i;
      board[pos] = { color: "Red", inMotion: false, reachedLastRow: false };
    }
  }

  return {
    // size is not part of state; it lives alongside in storage.games entry
    pieces: board,
    initial: p1,
    step: "from",
    turn: p1,
    players: colorMapFor(players),
  };
}

function ensureGameRecord(gameId, size) {
  let rec = storage.games.get(gameId);
  if (!rec) {
    rec = {
      size,
      state: {
        pieces: createEmptyBoard(size),
        initial: null,
        step: "from",
        turn: null,
        players: {},
      },
    };
    storage.games.set(gameId, rec);
  }
  return rec;
}

function getPlayersFromState(state) {
  // players are the keys from players color map, in [p1, p2] order
  const p1 =
    Object.keys(state.players).find((n) => state.players[n] === "Blue") || null;
  const p2 =
    Object.keys(state.players).find((n) => state.players[n] === "Red") || null;
  const arr = [];
  if (p1) arr.push(p1);
  if (p2) arr.push(p2);
  return arr;
}

function broadcastGameEvent(gameId, eventName, data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const [key, res] of storage.sseClients.entries()) {
    if (key.endsWith(`:${gameId}`)) {
      try {
        if (!res.writableEnded) {
          res.write(payload);
        }
      } catch (e) {}
    }
  }
}

function toInt(v) {
  return utils.toInt(v);
}

/* POST /join */
async function handleJoin(req, res) {
  try {
    const body = await utils.parseJSONBody(req);
    const { nick, password, size, group } = body;

    if (!utils.isNonEmptyString(nick) || !utils.isNonEmptyString(password)) {
      return utils.sendError(res, 400, "nick and password required");
    }

    const numSize = toInt(size);
    const numGroup = toInt(group);
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

    // find an open game with same size (record-only)
    let gameId = null;
    for (const [gid, rec] of storage.games.entries()) {
      const players = getPlayersFromState(rec.state);
      if (players.length < 2 && rec.size === sizeInt) {
        gameId = gid;
        break;
      }
    }
    if (!gameId) gameId = crypto.randomBytes(16).toString("hex");

    let rec = ensureGameRecord(gameId, sizeInt);
    const { state } = rec;

    // add player color
    const playersNow = getPlayersFromState(state);
    if (!playersNow.includes(nick)) {
      if (!state.players[nick]) {
        // assign next available color (Blue first, then Red)
        const assignedBlue = playersNow.some(
          (p) => state.players[p] === "Blue"
        );
        state.players[nick] = assignedBlue ? "Red" : "Blue";
      }
    }

    // If two players, build the initial pieces and set turn/initial
    const playersAfter = getPlayersFromState(state);
    if (playersAfter.length === 2) {
      const newState = buildInitialState(rec.size, playersAfter);
      storage.games.set(gameId, { size: rec.size, state: newState });

      // wake any long-poll waiters and broadcast start snapshot
      const waiters = storage.waitingClients.get(gameId) || null;
      if (Array.isArray(waiters)) {
        for (const w of waiters.slice()) {
          try {
            if (w.timer) clearTimeout(w.timer);
            utils.sendJSON(w.res, 200, newState);
          } catch (e) {}
        }
        storage.waitingClients.delete(gameId);
      }

      broadcastGameEvent(gameId, "update", newState);
      return utils.sendJSON(res, 200, { game: gameId });
    }

    // one player waiting
    storage.games.set(gameId, rec);
    return utils.sendJSON(res, 200, { game: gameId });
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

/* POST /leave */
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

    const rec = storage.games.get(game);
    if (!rec) return utils.sendError(res, 404, "game not found");
    const state = rec.state;

    const players = getPlayersFromState(state);
    const participantsBefore = players.slice();

    // remove player from color map
    if (state.players[nick]) {
      delete state.players[nick];
    }

    const remainingPlayers = getPlayersFromState(state);

    // case: nobody left -> draw and remove game
    if (remainingPlayers.length === 0) {
      for (const [skey, sres] of Array.from(storage.sseClients.entries())) {
        if (skey.endsWith(`:${game}`)) {
          try {
            sres.write(`data: ${JSON.stringify({ winner: null })}\n\n`);
          } catch (e) {}
          try {
            sres.end();
          } catch (e) {}
          storage.sseClients.delete(skey);
        }
      }
      storage.games.delete(game);
      return utils.sendJSON(res, 200, {});
    }

    // case: one player remains -> they win, update ranking and close SSE
    if (remainingPlayers.length === 1) {
      const winner = remainingPlayers[0];
      try {
        storage.finalizeGameResult(participantsBefore, winner);
      } catch (e) {}

      for (const [skey, sres] of Array.from(storage.sseClients.entries())) {
        if (skey.endsWith(`:${game}`)) {
          try {
            sres.write(`data: ${JSON.stringify({ winner })}\n\n`);
          } catch (e) {}
          try {
            sres.end();
          } catch (e) {}
          storage.sseClients.delete(skey);
        }
      }

      storage.games.delete(game);
      return utils.sendJSON(res, 200, {});
    }

    /*// two players still; broadcast updated state (board stays as is)
    broadcastGameEvent(game, "leave", state);*/
    return utils.sendJSON(res, 200, {});
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

// game helpers
// [0,1..]
function remapToPlayer2Perspective(arr, rows = 4, cols) {
  // original row-major bottom->top to top->bottom
  const out = new Array(rows * cols);
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    const r = Math.floor(i / cols);
    const c = i % cols;
    const j = (rows - 1 - r) * cols + c;
    out[j] = v;
  }
  return out;
}

function remapFromPlayer2PerspectiveToNormal(arr, rows = 4, cols) {
  // inverse of the above mapping
  const out = new Array(rows * cols);
  for (let j = 0; j < arr.length; j++) {
    const v = arr[j];
    const r2 = Math.floor(j / cols);
    const c2 = j % cols;
    const i = (rows - 1 - r2) * cols + c2;
    out[i] = v;
  }
  return out;
}

// check if there are any legal moves for given player in the 'game' for the 'diceValue'.. return true/false
function hasMovesAvailableFor(playerNick, game, diceValue) {
  const gameState = storage.games.get(game);
  const cols = gameState.size;
  const dim1PieceArr = gameState.state.pieces;
  const colour = gameState.state.players[playerNick]; // colour of playerNick

  for (let i = 0; i < dim1PieceArr.length; i++) {
    const piece = dim1PieceArr[i];
    if (piece !== null && colour === piece.color) {
      // if not null and has piece of colour
      const moves = movesAvailableFor(playerNick, game, diceValue, i); // list of moves possible
      if (moves.length !== 0) {
        return true;
      }
    }
  }

  return false;
}

// check if there are any legal moves for given player piece at 1D array index 'index1D' in the 'game' for the 'diceValue'
// return array of 1D indexes of valid moves.
// TO-DO!!!!!!!!!!!    ----- NEEDS TO BE COMPLETED!
function movesAvailableFor(playerNick, game, diceValue, index1D) {
  const gameState = storage.games.get(game);
  const cols = gameState.size;
  let dim1PieceArr = gameState.state.pieces;
  // note: player 1 is "Blue" and player 2 is "Red"
  // pieces array stored in POV of player 1 "Blue" so 180deg rotate it if playerNick is "Red"
  const colour = gameState.state.players[playerNick];
  if (colour === "Red") {
    dim1PieceArr = remapToPlayer2Perspective(gameState.state.pieces, 4, cols);
  }

  // initial null game board matrix
  const matrix = Array.from({ length: 4 }, () => Array(cols).fill(null));
  const indexes = Array.from({ length: cols * 4 }, (_, i) => i);

  let index = 0; // index to traverse throuhh 1D pieces array
  // map 1D pieces array to a matrix
  for (let i = 3; i >= 0; i--) {
    // row index 0 (top) and 2
    if (i % 2 === 0) {
      for (let j = cols - 1; j >= 0; j--) {
        if (dim1PieceArr[index]) {
          // if not null add to matrix
          matrix[i][j] = dim1PieceArr[index];
        }
        index++;
      }
    } else {
      // bottom row index 3 or 1
      for (let j = 0; j < cols; j++) {
        if (dim1PieceArr[index]) {
          matrix[i][j] = dim1PieceArr[index];
        }
        index++;
      }
    }
  }

  // array of board directions.. same logic as client game script
  const directionMatrix = Array.from({ length: 4 }, () => Array(cols).fill("")); // initial null array

  // fill direction array
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0) directionMatrix[r][c] = c === 0 ? "down" : "left";
      else if (r === 1)
        directionMatrix[r][c] = c === cols - 1 ? "up down" : "right";
      else if (r === 2) directionMatrix[r][c] = c === 0 ? "up" : "left";
      else if (r === 3) directionMatrix[r][c] = 0 === cols - 1 ? "up" : "right";
    }
  }

  // if has base pieces no piece can go into top row (index 0)
  let hasBasePieces = false;
  for (let i = 0; i < cols; i++) {
    if (matrix[3][i]) {
      // if not null there is a piece
      hasBasePieces = true;
      break;
    }
  }

  /*for (let i = 0; i < 4; i++) {
    for (let j = 0; j < array.length; j++) {
      if (gameState.state.pieces[]) {
        
      }
    }
  }*/

  /*const rec = storage.games.get(game);
  const state = rec.state;
  const boardLen = 4 * rec.size;
  // compute positions per player from board
  function ownerAt(idx) {
    const cell = state.pieces[idx];
    if (cell && cell.color) {
      const owner = Object.keys(state.players).find(
        (n) => state.players[n] === cell.color
      );
      return owner || null;
    }
    return null;
  }
  // consider moving any of player's pieces forward by 'diceValue' if dest not occupied by own piece
  for (let pos = 0; pos < boardLen; pos++) {
    const owner = ownerAt(pos);
    if (owner === playerNick) {
      const dest = pos + diceValue;
      if (dest >= 0 && dest < boardLen) {
        const destOwner = ownerAt(dest);
        if (destOwner !== playerNick) return true;
      }
    }
  }*/
  return false;
}

// dice roll handler
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

    const rec = storage.games.get(game);
    if (!rec) return utils.sendError(res, 404, "game not found");
    const state = rec.state;

    if (state.turn !== nick) return utils.sendError(res, 403, "not your turn");

    // dice
    const upProb = [0.06, 0.25, 0.38, 0.25, 0.06];
    const r = Math.random();
    let cum = 0,
      chosenUp = 2;
    for (let i = 0; i < upProb.length; i++) {
      cum += upProb[i];
      if (r <= cum) {
        chosenUp = i;
        break;
      }
    }
    const indices = [0, 1, 2, 3];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const stickValues = [false, false, false, false];
    for (let i = 0; i < chosenUp; i++) stickValues[indices[i]] = true;
    const value = chosenUp === 0 ? 6 : chosenUp;
    const keepPlaying = value === 1 || value === 4 || value === 6;

    const movesAvailable = hasMovesAvailableFor(nick, game, value);
    const mustPass = !movesAvailable && !keepPlaying ? nick : null;

    const resp = {
      dice: { stickValues, value, keepPlaying },
      mustPass,
      turn: state.turn,
    };

    broadcastGameEvent(game, "roll", resp);
    return utils.sendJSON(res, 200, {});
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

// pass move handler
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

    const rec = storage.games.get(game);
    if (!rec) return utils.sendError(res, 404, "game not found");
    const state = rec.state;

    if (state.turn !== nick) return utils.sendError(res, 403, "not your turn");

    const players = getPlayersFromState(state);
    if (players.length < 2)
      return utils.sendError(res, 409, "game not started");

    // rotate turn
    const next = state.turn === players[0] ? players[1] : players[0];
    state.turn = next;

    // Broadcast the exact state plus dice: null
    const payload = {
      pieces: state.pieces,
      initial: state.initial,
      step: state.step,
      turn: state.turn,
      players: state.players,
      dice: null,
    };
    broadcastGameEvent(game, "pass", payload);

    try {
      update.resetInactivityTimerFor(next, game);
    } catch (e) {}

    return utils.sendJSON(res, 200, {});
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

/* POST /notify */
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

    const rec = storage.games.get(game);
    if (!rec) return utils.sendError(res, 404, "game not found");
    const state = rec.state;

    const boardLen = 4 * rec.size;
    if (cellInt >= boardLen)
      return utils.sendError(res, 400, "cell out of bounds");

    // move: find first piece for nick
    const myColor = state.players[nick];
    if (!myColor) return utils.sendError(res, 403, "not a player in this game");

    let from = -1;
    for (let i = 0; i < boardLen; i++) {
      const cellObj = state.pieces[i];
      if (cellObj && cellObj.color === myColor) {
        from = i;
        break;
      }
    }
    if (from === -1) return utils.sendError(res, 409, "no piece to move");

    // simple move: if destination has own piece, reject; else place
    const destCell = state.pieces[cellInt];
    if (destCell && destCell.color === myColor) {
      return utils.sendError(res, 409, "destination occupied by own piece");
    }
    // move piece
    state.pieces[from] = null;
    state.pieces[cellInt] = {
      color: myColor,
      inMotion: false,
      reachedLastRow: false,
    };

    const resp = {
      ok: true,
      cell: cellInt,
      selected: [from, cellInt],
      state,
      turn: state.turn,
    };
    broadcastGameEvent(game, "notify", resp);
    return utils.sendJSON(res, 200, {});
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

/* POST /ranking */
async function handleRanking(req, res) {
  try {
    const body = await utils.parseJSONBody(req);
    const { group, size } = body;
    const numSize = utils.toInt(size);
    const numGroup = utils.toInt(group);

    if (
      (!Number.isInteger(numSize) || numSize < 1) &&
      (!Number.isInteger(numGroup) || numGroup < 1)
    ) {
      return utils.sendError(res, 400, "size must be integer >= 1");
    }

    try {
      const ranking = storage.getRanking(20);
      return utils.sendJSON(res, 200, { ranking });
    } catch (e) {
      return utils.sendError(res, 400, "error fetching rankings");
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
