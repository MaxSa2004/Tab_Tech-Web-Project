"use strict";

const utils = require("./utils");
const storage = require("./storage");
const crypto = require("crypto");
const update = require("./update");

// helpers for state
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
    lastDiceValue: null,
    lastSelectedIndex: null,
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
        lastDiceValue: null,
        lastSelectedIndex: null,
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

// join handler
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

    // if two players, build the initial pieces and set turn/initial
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

// leave handler
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

    return utils.sendJSON(res, 200, {});
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

// game helpers
// perspective helpers
function remapToPlayer2Perspective(arr, rows = 4, cols) {
  // Flip vertically: row-major bottom->top to top->bottom
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

// inverse of the above mapping
/*function remapFromPlayer2PerspectiveToNormal(arr, rows = 4, cols) {
  const out = new Array(rows * cols);
  for (let j = 0; j < arr.length; j++) {
    const v = arr[j];
    const r2 = Math.floor(j / cols);
    const c2 = j % cols;
    const i = (rows - 1 - r2) * cols + c2;
    out[i] = v;
  }
  return out;
}*/

// matrices from 1D board using zig-zag traversal bottom -> top
function buildBoardMatrices(dim1PieceArr, indexes, rows, cols) {
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(null));
  const indexMatrix = Array.from({ length: rows }, () => Array(cols).fill(-1));

  let index = 0;
  for (let i = rows - 1; i >= 0; i--) {
    if (i % 2 === 0) {
      // even row: right -> left
      for (let j = cols - 1; j >= 0; j--) {
        const cell = dim1PieceArr[index];
        if (cell !== null) matrix[i][j] = cell;
        indexMatrix[i][j] = indexes[index];
        index++;
      }
    } else {
      // odd row: left -> right
      for (let j = 0; j < cols; j++) {
        const cell = dim1PieceArr[index];
        if (cell !== null) matrix[i][j] = cell;
        indexMatrix[i][j] = indexes[index];
        index++;
      }
    }
  }

  return { matrix, indexMatrix };
}

// find matrix coords for 1D index in zig-zag traversal
function coordsForIndex(index1D, rows, cols) {
  // simulate zig-zag to locate the (r,c) for index1D
  let index = 0;
  for (let i = rows - 1; i >= 0; i--) {
    if (i % 2 === 0) {
      for (let j = cols - 1; j >= 0; j--) {
        if (index === index1D) return { r: i, c: j };
        index++;
      }
    } else {
      for (let j = 0; j < cols; j++) {
        if (index === index1D) return { r: i, c: j };
        index++;
      }
    }
  }
  return { r: 0, c: 0 }; // fallback, should not happen if index1D is valid
}

// build the per-cell arrow directions according to client logic
function buildDirectionMatrix(rows, cols) {
  const directionMatrix = Array.from({ length: rows }, () =>
    Array(cols).fill("")
  );
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0) directionMatrix[r][c] = c === 0 ? "down" : "left";
      else if (r === 1)
        directionMatrix[r][c] = c === cols - 1 ? "up down" : "right";
      else if (r === 2) directionMatrix[r][c] = c === 0 ? "up" : "left";
      else if (r === 3) directionMatrix[r][c] = c === cols - 1 ? "up" : "right";
    }
  }
  return directionMatrix;
}

// helper to move one step according to directionMatrix
function stepFrom(directionMatrix, r, c) {
  const dir = directionMatrix[r][c];
  let newR = r;
  let newC = c;
  if (dir.includes("up")) newR--;
  if (dir.includes("down")) newR++;
  if (dir.includes("left")) newC--;
  if (dir.includes("right")) newC++;
  return { r: newR, c: newC };
}

// check if cell is inside board bounds
function inBounds(r, c, rows, cols) {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

// Main: return array of 1D destination indexes (in Blue POV) for legal moves
function movesAvailableFor(playerNick, game, diceValue, index1D) {
  const gameState = storage.games.get(game);
  const rows = 4;
  const cols = gameState.size;

  // identity index map and POV maps
  const identity = Array.from({ length: rows * cols }, (_, i) => i);
  const blueToRedIndex = remapToPlayer2Perspective(identity, rows, cols);

  let dim1PieceArr = gameState.state.pieces;
  let indexes = identity.slice();

  // player color and perspective
  const colour = gameState.state.players[playerNick];
  // Normalize the input index to the player's POV
  const workingIndex1D = colour === "Red" ? blueToRedIndex[index1D] : index1D;

  // Work in player's POV for pathing
  if (colour === "Red") {
    dim1PieceArr = remapToPlayer2Perspective(dim1PieceArr, rows, cols);
    indexes = remapToPlayer2Perspective(indexes, rows, cols);
  }

  // build matrices
  const { matrix, indexMatrix } = buildBoardMatrices(
    dim1PieceArr,
    indexes,
    rows,
    cols
  );

  // starting coords (perspective-aware)
  const { r: currR, c: currC } = coordsForIndex(workingIndex1D, rows, cols);

  // rule: if piece is not inMotion, it can only move with diceValue === 1
  const startPiece = matrix[currR][currC];
  if (!startPiece) return [];
  if (startPiece.inMotion === false && diceValue !== 1) return []; // piece cannot be moved

  // flags and helpers
  const moveLastRowState = startPiece.reachedLastRow === true;

  let hasBasePieces = false;
  for (let i = 0; i < cols; i++) {
    if (matrix[rows - 1][i] !== null) {
      hasBasePieces = true;
      break;
    }
  }

  const isOwnPiece = (r, c) => {
    const cell = matrix[r][c];
    return cell !== null && cell.color === colour;
  };

  // direction matrix used to follow arrow logic of game board
  const directionMatrix = buildDirectionMatrix(rows, cols);

  // special case: second row (r === 1) (third row from bottom)
  if (currR === 1) {
    let remaining = diceValue;
    let currentC = currC;

    // move horizontally to the right end of row index 1
    const stepsToRightEnd = cols - 1 - currentC;
    const horizontalMove = Math.min(remaining, stepsToRightEnd);
    currentC += horizontalMove;
    remaining -= horizontalMove;

    if (remaining === 0) {
      // single destination on row index 1
      if (isOwnPiece(1, currentC)) return [];
      return [indexMatrix[1][currentC]]; // player POV
    }

    // branch: up (to row 0) and down (to row 2)
    const targets = [];
    if (!hasBasePieces && !moveLastRowState && !isOwnPiece(0, currentC)) {
      targets.push({ r: 0, c: currentC });
    }
    if (!isOwnPiece(2, currentC)) {
      targets.push({ r: 2, c: currentC });
    }

    if (targets.length === 0) return [];

    if (remaining > 1) {
      const furtherTargets = [];
      targets.forEach(({ r, c }) => {
        let rem = remaining - 1;
        let curR = r,
          curC = c;
        let progressed = false;

        for (let step = 0; step < rem; step++) {
          const { r: newR, c: newC } = stepFrom(directionMatrix, curR, curC);
          if (!inBounds(newR, newC, rows, cols)) break;
          if (moveLastRowState && currR !== 0 && newR === 0) break;
          curR = newR;
          curC = newC;
          progressed = true;
        }

        if (progressed && !isOwnPiece(curR, curC)) {
          furtherTargets.push({ r: curR, c: curC });
        }
      });

      if (furtherTargets.length === 0) return [];
      return furtherTargets.map(({ r, c }) => indexMatrix[r][c]); // player POV
    }

    // remaining === 1: immediate up/down filtered above
    return targets.map(({ r, c }) => indexMatrix[r][c]); // player POV
  }

  // normal movement: follow arrows for diceValue steps from current cell
  let remaining = diceValue;
  let curR = currR,
    curC = currC;
  let progressed = false;

  for (let step = 0; step < remaining; step++) {
    const { r: newR, c: newC } = stepFrom(directionMatrix, curR, curC);
    if (!inBounds(newR, newC, rows, cols)) break;
    if (
      (hasBasePieces && newR === 0) ||
      (moveLastRowState && currR !== 0 && newR === 0)
    )
      break;
    curR = newR;
    curC = newC;
    progressed = true;
  }

  if (!progressed) return [];
  if (isOwnPiece(curR, curC)) return [];

  return [indexMatrix[curR][curC]]; // player POV
}

// any moves available check for a given player and dice value
// checks all positions in pieces array and checks movesAvailableFor() iff piece belongs to given player
function hasMovesAvailableFor(playerNick, game, diceValue) {
  const gameState = storage.games.get(game);
  const dim1PieceArr = gameState.state.pieces;
  const colour = gameState.state.players[playerNick];

  for (let i = 0; i < dim1PieceArr.length; i++) {
    const piece = dim1PieceArr[i];
    if (piece !== null && piece.color === colour) {
      const moves = movesAvailableFor(playerNick, game, diceValue, i);
      if (Array.isArray(moves) && moves.length > 0) {
        console.log(moves);
        return true;
      }
    }
  }
  return false;
}

// move piece helper
function movePiece(game, playerNick, fromIndex, toIndex, diceValue) {
  const gameState = storage.games.get(game);

  const rows = 4;
  const cols = gameState.size;
  const state = gameState.state;
  const colour = state.players[playerNick];

  const arrLen = state.pieces.length;
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    fromIndex >= arrLen ||
    toIndex < 0 ||
    toIndex >= arrLen
  ) {
    return { ok: false, reason: "out of bound index" };
  }

  const srcPiece = state.pieces[fromIndex];
  if (!srcPiece) {
    return { ok: false, reason: "no piece found" };
  }
  if (srcPiece.color !== colour) {
    return { ok: false, reason: "not-players-piece" };
  }

  if (srcPiece.inMotion === false && diceValue !== 1) {
    return { ok: false, reason: "first move of piece must be diceValue 1" };
  }

  const dest = state.pieces[toIndex];
  if (dest && dest.color === colour) {
    return { ok: false, reason: "cannot move onto own piece" };
  }

  // Compute destination row in the PLAYER'S POV:
  // - For Blue, use toIndex directly with coordsForIndex
  // - For Red, convert Blue->Red POV index, then use coordsForIndex
  let reachedLastRow = srcPiece.reachedLastRow === true;

  // Build identity index map and POV conversion
  const identity = Array.from({ length: rows * cols }, (_, i) => i);
  const blueToRedIndex = remapToPlayer2Perspective(identity, rows, cols);

  const toIndexPlayerPOV = colour === "Red" ? blueToRedIndex[toIndex] : toIndex;
  const { r: destRPlayerPOV } = coordsForIndex(toIndexPlayerPOV, rows, cols);

  // In player's perspective, "top row" is row 0
  if (destRPlayerPOV === 0) {
    reachedLastRow = true;
  }

  // apply move to state array of pieces
  state.pieces[fromIndex] = null;
  state.pieces[toIndex] = {
    color: colour,
    inMotion: true,
    reachedLastRow,
  };

  return { ok: true, fromIndex, toIndex, state };
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

    // store dice value
    state.lastDiceValue = value;

    const movesAvailable = hasMovesAvailableFor(nick, game, value);
    //console.log("moves available? " + movesAvailable);
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

    state.lastDiceValue = null;

    // Broadcast the exact state plus dice: null
    const payload = {
      pieces: state.pieces,
      initial: state.initial,
      step: state.step,
      turn: state.turn,
      players: state.players,
      dice: state.lastDiceValue,
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

// notify handler
// TO-DO!!!!!!!
// notify handler
async function handleNotify(req, res) {
  try {
    const body = await utils.parseJSONBody(req);
    const { nick, password, game, cell } = body;
    if (
      !utils.isNonEmptyString(nick) ||
      !utils.isNonEmptyString(password) ||
      !utils.isNonEmptyString(game)
    ) {
      return utils.sendError(res, 400, "nick, password, game required");
    }

    // type checks
    const cellInt = utils.toInt(cell);
    if (!Number.isInteger(cellInt) || cellInt < 0)
      return utils.sendError(res, 400, "cell must be integer >= 0");
    // password and username pair must be valid
    if (!storage.getUser(nick) || !storage.verifyPassword(nick, password))
      return utils.sendError(res, 401, "invalid credentials");

    const rec = storage.games.get(game);
    if (!rec) return utils.sendError(res, 404, "game not found");
    const state = rec.state;

    // bounds check against pieces array
    if (cellInt >= state.pieces.length)
      return utils.sendError(res, 400, "cell out of bounds");

    // must be player's turn
    if (state.turn !== nick) return utils.sendError(res, 403, "not your turn");

    // need a dice value from last roll
    const diceValue = utils.toInt(state.lastDiceValue);
    if (!Number.isInteger(diceValue))
      return utils.sendError(res, 409, "no dice value available");

    const myColor = state.players[nick];
    if (!myColor) return utils.sendError(res, 403, "not a player in this game");

    const keepPlaying = diceValue === 1 || diceValue === 4 || diceValue === 6;

    // CASE A: Completing a two-step move (destination selection)
    if (state.lastSelectedIndex !== null && state.step === "to") {
      const fromIndex = state.lastSelectedIndex;

      // Validate destination against legal moves for the selected piece
      const legalMoves = movesAvailableFor(nick, game, diceValue, fromIndex);
      if (!Array.isArray(legalMoves) || !legalMoves.includes(cellInt)) {
        return utils.sendError(res, 400, "destination not allowed by dice");
      }

      // Apply the move
      const move = movePiece(game, nick, fromIndex, cellInt, diceValue);
      if (!move || move.ok === false) {
        return utils.sendError(res, 400, "move failed");
      }

      // Clear dice (always) and advance step back to "from"
      state.lastDiceValue = null;
      state.lastSelectedIndex = null;
      state.step = "from";

      // Rotate turn only if not keepPlaying
      if (!keepPlaying) {
        const players = getPlayersFromState(state);
        const next = state.turn === players[0] ? players[1] : players[0];
        state.turn = next;
      }

      const resp = {
        cell: cellInt,
        selected: [fromIndex, cellInt],
        dice: null,
        pieces: state.pieces,
        initial: state.initial,
        step: state.step,
        turn: state.turn,
        players: state.players,
      };
      broadcastGameEvent(game, "notify", resp);
      return utils.sendJSON(res, 200, {});
    }

    // Selecting a piece to move (first click)
    const fromPiece = state.pieces[cellInt];
    if (fromPiece === null) {
      return utils.sendError(res, 400, "no piece in that cell");
    }
    if (fromPiece.color !== myColor) {
      return utils.sendError(res, 400, "not your piece");
    }
    if (fromPiece.inMotion === false && diceValue !== 1) {
      return utils.sendError(res, 400, "must roll 1 to start moving this piece");
    }

    // Get possible destinations for this piece with the current dice
    const possibleDests = movesAvailableFor(nick, game, diceValue, cellInt);
    if (!Array.isArray(possibleDests) || possibleDests.length === 0) {
      return utils.sendError(res, 400, "no valid moves for that piece");
    }

    // CASE B: More than one possible destination -> prompt selection
    if (possibleDests.length > 1) {
      state.step = "to";
      state.lastSelectedIndex = cellInt;

      const resp = {
        cell: cellInt,
        selected: possibleDests,
        dice: diceValue, // keep dice visible; still needed to validate final move
        pieces: state.pieces,
        initial: state.initial,
        step: state.step,
        turn: state.turn,
        players: state.players,
      };
      broadcastGameEvent(game, "notify", resp);
      return utils.sendJSON(res, 200, {});
    }

    // CASE C: Only one possible destination -> execute immediately
    const toIndex = possibleDests[0];
    const move = movePiece(game, nick, cellInt, toIndex, diceValue);
    if (!move || move.ok === false) {
      return utils.sendError(res, 409, "move failed");
    }

    // Clear dice (always) and rotate only if not keepPlaying
    state.lastDiceValue = null;
    if (!keepPlaying) {
      const players = getPlayersFromState(state);
      const next = state.turn === players[0] ? players[1] : players[0];
      state.turn = next;
    }

    state.step = "from";
    state.lastSelectedIndex = null;

    const resp = {
      cell: cellInt,
      selected: [cellInt, toIndex],
      dice: null,
      pieces: state.pieces,
      initial: state.initial,
      step: state.step,
      turn: state.turn,
      players: state.players,
    };
    broadcastGameEvent(game, "notify", resp);
    return utils.sendJSON(res, 200, {});
  } catch (err) {
    return utils.sendError(res, 400, err.message);
  }
}

// ranking handler
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
