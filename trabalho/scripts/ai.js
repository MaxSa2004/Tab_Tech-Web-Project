/*
Expectminimax algorithm, with alpha beta pruning on decision nodes.
The code doesn't alter the DOM, it only reads the current game state from the DOM and decides the AI move (returns {from {r,c}, to {r,c}, value} or null) from a cloned model.
*/ 

(function () { // IIFE (Immediately Invoked Function Expression). Executes immediately afyer definition. Used when trying to avoid polluting the global namespace, because all the vars used inside the IIFE, like any other function, are not visible outside its scope.

  if (!document) return; // safety check, if DOM does not exist, return

  // Configuration constants
  const USE_WEIGHTED_STICK_DICE_CHANCE = true;    // chance nodes use real stick-dice distribution
  const MODEL_EXTRA_ROLL_IN_TREE = false;         // if true, on die in {1,4,6} the same player moves again in-tree
  const NORMAL_RANDOM_PROB = 0.18;                // randomization for Normal difficulty
  const NORMAL_RANDOM_TOP_K = 2;                  // if >1, pick randomly among top-K moves instead of any move

  // Realistic stick-dice outcomes and probabilities:
  // Up-count: 0->6, 1->1, 2->2, 3->3, 4->4
  // Mapping used in game: {1,2,3,4,6} with probs: 1:25%, 2:38%, 3:25%, 4:6%, 6:6%
  const CHANCE_VALUES = [1, 2, 3, 4, 6]; // possible die outcomes
  const CHANCE_WEIGHTS = [0.25, 0.38, 0.25, 0.06, 0.06]; // corresponding weights

  function cellKey(r, c) { return `${r},${c}`; } // helper to build cell key from row/col

  function buildModelFromDOM() { // build internal model from DOM to work on without altering the original DOM
    const cells = {}; // map of cellKey -> {r,c,arrow:{up,down,left,right},piece:{owner,moveState}|null}
    const cellNodes = Array.from(document.querySelectorAll('.cell')); // get all cell DOM nodes
    let cols = null, rows = 4; // fixed 4 rows in your rules, cols is dynamic
    for (const cell of cellNodes) { // iterate all cell nodes
      const r = parseInt(cell.dataset.r, 10); // parse row/col from data attributes
      const c = parseInt(cell.dataset.c, 10);
      if (isNaN(r) || isNaN(c)) continue; // skip invalid
      cols = cols === null ? Math.max(c + 1, cols || 0) : Math.max(cols, c + 1); // determine cols by max c seen
      const arrowEl = cell.querySelector('.arrow'); // get arrow element if any
      const arrow = {
        up: arrowEl && arrowEl.classList.contains('up'), // check arrow directions
        down: arrowEl && arrowEl.classList.contains('down'),
        left: arrowEl && arrowEl.classList.contains('left'),
        right: arrowEl && arrowEl.classList.contains('right')
      };
      const pieceEl = cell.querySelector('.piece'); // get piece element if any
      const piece = pieceEl ? {
        owner: pieceEl.classList.contains('red') ? 'red' : (pieceEl.classList.contains('yellow') ? 'yellow' : null), // determine owner by class
        moveState: pieceEl ? pieceEl.getAttribute('move-state') || 'moved' : null // determine move state
      } : null;
      cells[`${r},${c}`] = { r, c, arrow, piece }; // store cell info in cells map
    }
    let red = 0, yellow = 0; // count pieces
    Object.values(cells).forEach(s => {
      if (s.piece) {
        if (s.piece.owner === 'red') red++;
        if (s.piece.owner === 'yellow') yellow++;
      }
    });
    return { rows, cols: cols || 9, cells, counts: { red, yellow } }; // return model witth number of rows, cols, cells map, and counts
  }

  function cloneModel(model) { // deep clone model to avoid mutating original
    const newCells = {}; // map of cellKey -> cloned cell
    for (const k of Object.keys(model.cells)) {
      const c = model.cells[k]; // original cell
      newCells[k] = { // cloned cell
        r: c.r,
        c: c.c,
        arrow: { ...c.arrow },
        piece: c.piece ? { owner: c.piece.owner, moveState: c.piece.moveState } : null
      };
    }
    return { rows: model.rows, cols: model.cols, cells: newCells, counts: { ...model.counts } }; // return cloned model
  }

  function sideHasBasePieces(model, owner) { // check if side has pieces in base row
    // Base row is r=3 : because the board has 4 rows indexed 0..3, and base row is the last row (3), where AI's pieces start from its perspective
    for (const k of Object.keys(model.cells)) {
      const s = model.cells[k]; // cell
      if (s.piece && s.piece.owner === owner && s.r === 3) return true; // found piece in base row -> can't move to top row (0)
    }
    return false;
  }

  function getValidMovesModel(model, fromR, fromC, diceValue) { // get valid moves for piece at (fromR, fromC) with given diceValue
    const key = cellKey(fromR, fromC); // cell key
    const start = model.cells[key]; // starting cell
    if (!start || !start.piece) return []; // no piece to move
    const moveState = start.piece.moveState; // §tarting piece move state ('not-moved', 'moved', 'row-four')
    const rows = model.rows; // number of rows
    const cols = model.cols; // number of columns
    const owner = start.piece.owner; // owner of the piece

    if (fromR === 1) { // from row 1: special logic (can go right, then up/down, then follow arrows)
      let remaining = diceValue; // steps remaining
      let currentC = fromC; // current column
      const stepsToRightEnd = cols - 1 - currentC; // steps to right end
      const horizontalMove = Math.min(remaining, stepsToRightEnd); // horizontal move steps
      currentC += horizontalMove; // move right
      remaining -= horizontalMove; // decrease remaining steps
 
      if (remaining === 0) { // no remaining steps: only one target
        const targetKey = cellKey(1, currentC); // target cell key
        return model.cells[targetKey] ? [{ r: 1, c: currentC }] : []; // return target if valid, else empty
      }

      const targets = []; // potential targets after horizontal move
      const upKey = cellKey(0, currentC); // cell above
      const downKey = cellKey(2, currentC); // cell below
      // Align with DOM rule: cannot go to top row if you still have base-row pieces
      const hasBasePieces = sideHasBasePieces(model, owner);
      // if top cell exists and no base pieces (or special case), add as target the fourth row (0)
      if (!hasBasePieces && !(moveState === 'row-four' && fromR !== 0) && model.cells[upKey]) {
        targets.push({ r: 0, c: currentC }); // add top cell as target, with r=0
      }
      if (model.cells[downKey]) targets.push({ r: 2, c: currentC }); // add bottom cell as target, with r=2, if exists

      if (remaining > 1) { // more than 1 step remaining: follow arrows from each target
        const further = []; // further targets after following arrows
        for (const t of targets) {
          let curR = t.r, curC = t.c;
          let rem = remaining - 1;
          let ok = true; // flag to track valid path
          for (let s = 0; s < rem; s++) { // for each remaining step
            const curCell = model.cells[cellKey(curR, curC)]; // current cell
            if (!curCell) { ok = false; break; } // invalid cell, break
            const arrow = curCell.arrow; // get arrow
            let newR = curR, newC = curC; // new position
            if (arrow.up) newR--; // move up
            if (arrow.down) newR++; // move down
            if (arrow.left) newC--; // move left
            if (arrow.right) newC++; // move right
            if (newR < 0 || newR >= rows || newC < 0 || newC >= cols) { ok = false; break; } // out of bounds
            if (moveState === 'row-four' && fromR !== 0 && newR === 0) { ok = false; break; } // it's not allowed to move to top row if piece is in 'row-four' state and already left top row -> invalid move
            curR = newR; curC = newC; // update current position
          }
          if (ok && model.cells[cellKey(curR, curC)]) further.push({ r: curR, c: curC }); // valid final position, add to further targets
        }
        return further;
      }
      return targets; // return all further targets
    }

    let curR = fromR, curC = fromC;
    for (let step = 0; step < diceValue; step++) { // follow arrows for diceValue steps
      const curCell = model.cells[cellKey(curR, curC)]; // current cell
      if (!curCell) return []; // invalid cell
      const arrow = curCell.arrow; // get arrow
      let newR = curR, newC = curC;
      if (arrow.up) newR--; // move up
      if (arrow.down) newR++; // move down
      if (arrow.left) newC--; // move left
      if (arrow.right) newC++; // move right
      if (newR < 0 || newR >= rows || newC < 0 || newC >= cols) return []; // out of bounds
      if (moveState === 'row-four' && fromR !== 0 && newR === 0) return []; // not allowed to move to top row if piece is in 'row-four' state and already left top row -> invalid move
      curR = newR; curC = newC;
    }
    return model.cells[cellKey(curR, curC)] ? [{ r: curR, c: curC }] : []; // return one valid target or empty
  }
  // Applies a move to the model, returns whether a capture occurred and if there's a winner
  function applyMoveModel(model, fromR, fromC, toR, toC) {
    const fromKey = cellKey(fromR, fromC);
    const toKey = cellKey(toR, toC);
    const piece = model.cells[fromKey] && model.cells[fromKey].piece; // piece being moved (if model.cells[fromKey] exists, it returns the piece (model.cells[fromKey].piece), else undefined)
    if (!piece) return { capture: false, winner: null }; // no piece to move
    const dest = model.cells[toKey]; // destination cell
    let capture = false;
    if (dest && dest.piece) { // destination occupied
      if (dest.piece.owner !== piece.owner) { // opponent's piece: capture
        capture = true;
        if (dest.piece.owner === 'red') model.counts.red--;
        else if (dest.piece.owner === 'yellow') model.counts.yellow--;
        dest.piece = null;
      } else {
        return { capture: false, winner: null, illegal: true }; // illegal move: own piece at destination, no capture
      }
    }
    model.cells[toKey].piece = { owner: piece.owner, moveState: piece.moveState }; // move piece to destination
    model.cells[fromKey].piece = null; // clear source cell
    if (toR === 0 || model.cells[toKey].piece.moveState === 'row-four') { // reached top row or already in 'row-four' state
      model.cells[toKey].piece.moveState = 'row-four'; // set move state to 'row-four'
    } else if (model.cells[toKey].piece.moveState === 'not-moved') { // first move
      model.cells[toKey].piece.moveState = 'moved'; // set move state to 'moved'
    }
    let winner = null;
    if (model.counts.red <= 0) winner = 'yellow'; // check for winner
    if (model.counts.yellow <= 0) winner = 'red';
    return { capture, winner }; // return capture status and winner
  }
  // Enumerate all possible moves for a player given a die value
  function enumerateMovesForPlayer(model, playerColor, dieValue) {
    const moves = []; // list of possible moves
    for (const k of Object.keys(model.cells)) {
      const s = model.cells[k];
      if (!s.piece || s.piece.owner !== playerColor) continue; // skip empty or opponent's pieces
      if (s.piece.moveState === 'not-moved' && dieValue !== 1) continue; // can only move 'not-moved' pieces with die value 1
      const valids = getValidMovesModel(model, s.r, s.c, dieValue); // get valid moves for this piece
      for (const t of valids) {
        const dest = model.cells[cellKey(t.r, t.c)]; // destination cell
        if (dest.piece && dest.piece.owner === playerColor) continue; // skip if destination occupied by own piece
        moves.push({ from: { r: s.r, c: s.c }, to: { r: t.r, c: t.c } }); // add move to list
      }
    }
    return moves;
  }

  // check if a move is a capture
  function isCaptureMove(model, mv, playerColor) {
    const dest = model.cells[`${mv.to.r},${mv.to.c}`]; // destination cell
    return !!(dest && dest.piece && dest.piece.owner && dest.piece.owner !== playerColor); // true if destination has opponent's piece
  }
  // check if a move is a conversion (first move of a piece)
  function isConversionMove(model, mv) {
    const from = model.cells[`${mv.from.r},${mv.from.c}`]; // source cell
    return !!(from && from.piece && from.piece.moveState === 'not-moved'); // true if source piece is 'not-moved'
  }
  // order moves by priority: captures first, then conversions, then progress
  function orderMovesByPriority(moves, model, playerColor, dieKnown) {
    // score = 200*isCapture + 50*(die==1 && isConversion) + small progress tie-break
    return moves.slice().sort((a, b) => { // first checks captures
      const capA = isCaptureMove(model, a, playerColor) ? 1 : 0;
      const capB = isCaptureMove(model, b, playerColor) ? 1 : 0;
      if (capA !== capB) return capB - capA;
      // then checks conversions if die is 1
      const convA = (dieKnown === 1 && isConversionMove(model, a)) ? 1 : 0;
      const convB = (dieKnown === 1 && isConversionMove(model, b)) ? 1 : 0;
      if (convA !== convB) return convB - convA;
  
      // small tie-breaker: prefer forward progress by column
      if (a.to.c !== b.to.c) return b.to.c - a.to.c;
  
      // last tie-breaker: stable order by row/col
      if (a.to.r !== b.to.r) return a.to.r - b.to.r;
      return 0;
    });
  }
  // evaluate model state for AI color
  function evaluateModel(model, aiColor) {
    const opponent = aiColor === 'red' ? 'yellow' : 'red';
    const WEIGHT_PIECE = 200; // piece count weight
    const WEIGHT_PROGRESS = 4; // progress weight per column
    const WEIGHT_SAFE = 10; // safe position weight
    let score = 0; // initial score (used to evaluate the board state and decide the best move)
    score += WEIGHT_PIECE * (model.counts[aiColor] - model.counts[opponent]);
    for (const k of Object.keys(model.cells)) {
      const c = model.cells[k];
      if (!c.piece) continue;
      const colScore = c.c;
      if (c.piece.owner === aiColor) score += WEIGHT_PROGRESS * colScore; // progress for AI pieces
      else score -= WEIGHT_PROGRESS * colScore; // progress for opponent pieces
      if ((c.arrow.up || c.arrow.down) && !(c.arrow.left || c.arrow.right)) {
        if (c.piece.owner === aiColor) score += WEIGHT_SAFE; // safe position for AI pieces
        else score -= WEIGHT_SAFE; // safe position for opponent pieces
      }
    }
    return score;
  }

  function expectiMinimax(model, depth, playerToMove, aiColor, alpha, beta, dieKnown = null) {
    // terminal / leaf checks
    if (depth === 0) {
      return { value: evaluateModel(model, aiColor) }; // evaluate board
    }
    if (model.counts.red <= 0) return { value: (aiColor === 'yellow') ? 1e9 : -1e9 }; // large positive/negative for win/loss
    if (model.counts.yellow <= 0) return { value: (aiColor === 'red') ? 1e9 : -1e9 }; // large positive/negative for win/loss

    const opponent = playerToMove === 'red' ? 'yellow' : 'red';

    // Chance node: unknown next die
    if (dieKnown === null) {
      if (!USE_WEIGHTED_STICK_DICE_CHANCE) { // if false, use uniform distribution over {1,2,3,4,6}
        let total = 0;
        for (let die = 1; die <= 6; die++) {
          const res = expectiMinimax(model, depth, playerToMove, aiColor, alpha, beta, die); // recurse with known die
          total += res.value;
        }
        return { value: total / 6 }; // average over all die outcomes
      } else { // use realistic weighted distribution
        // Weighted over real stick outcomes {1,2,3,4,6}
        let total = 0;
        let sumW = 0;
        for (let i = 0; i < CHANCE_VALUES.length; i++) {
          const die = CHANCE_VALUES[i]; // possible die outcome
          const w = CHANCE_WEIGHTS[i]; // corresponding weight
          const res = expectiMinimax(model, depth, playerToMove, aiColor, alpha, beta, die); // recurse with known die
          total += w * res.value; // weighted sum
          sumW += w; // accumulate weights
        }
        return { value: sumW > 0 ? total / sumW : 0 }; // weighted average
      }
    }

    // Decision node with known die
  const movesRaw = enumerateMovesForPlayer(model, playerToMove, dieKnown); // all possible moves for player with known die
  if (movesRaw.length === 0) { // no moves available: pass turn
    const res = expectiMinimax(model, depth - 1, opponent, aiColor, alpha, beta, null); // recurse for opponent
    return { value: res.value }; // return value
  }
  const moves = orderMovesByPriority(movesRaw, model, playerToMove, dieKnown); // order moves by priority 

  if (playerToMove === aiColor) { // maximizing player
    let bestVal = -Infinity; // initialize best value
    let bestMove = null;
    for (const mv of moves) {
      const nm = cloneModel(model);
      applyMoveModel(nm, mv.from.r, mv.from.c, mv.to.r, mv.to.c);
      const res = expectiMinimax(nm, depth - 1, opponent, aiColor, alpha, beta, null);
      if (res.value > bestVal) { bestVal = res.value; bestMove = mv; } // update best value and move
      alpha = Math.max(alpha, bestVal); // update alpha
      if (beta <= alpha) break; // beta cut-off 
    }
    return { value: bestVal, bestMove };
  } else { // minimizing player
    let bestVal = Infinity;
    let bestMove = null;
    for (const mv of moves) {
      const nm = cloneModel(model);
      applyMoveModel(nm, mv.from.r, mv.from.c, mv.to.r, mv.to.c);
      const res = expectiMinimax(nm, depth - 1, opponent, aiColor, alpha, beta, null);
      if (res.value < bestVal) { bestVal = res.value; bestMove = mv; }
      beta = Math.min(beta, bestVal);
      if (beta <= alpha) break;
    }
    return { value: bestVal, bestMove };
  }
  }
  // Main function to get AI move given die value, AI color, and difficulty ('default' is 'normal')
  function getAIMove(dieValue, aiColor, difficulty = 'normal') {
    const model = buildModelFromDOM();
    const allMoves = [];
    for (const k of Object.keys(model.cells)) {
      const s = model.cells[k];
      if (!s.piece || s.piece.owner !== aiColor) continue; // skip empty or opponent's pieces
      if (s.piece.moveState === 'not-moved' && dieValue !== 1) continue; // can only move 'not-moved' pieces with die value 1
      const valids = getValidMovesModel(model, s.r, s.c, dieValue); // get valid moves for this piece
      for (const t of valids) {
        const dest = model.cells[cellKey(t.r, t.c)];
        if (dest.piece && dest.piece.owner === aiColor) continue; // skip if destination occupied by own piece
        allMoves.push({ from: { r: s.r, c: s.c }, to: { r: t.r, c: t.c } }); // add move to list
      }
    }
    if (allMoves.length === 0) return null;
    if (difficulty === 'easy') { // easy: random move, prefer captures
      const capMoves = allMoves.filter(m => { // filter capture moves
        const dest = model.cells[cellKey(m.to.r, m.to.c)];
        return dest.piece && dest.piece.owner !== aiColor;
      }); // if capture moves exist, pick one randomly
      if (capMoves.length > 0) return { ...capMoves[Math.floor(Math.random() * capMoves.length)], value: null };
      return { ...allMoves[Math.floor(Math.random() * allMoves.length)], value: null };
    }
    const DEPTH = difficulty === 'normal' ? 2 : 4; // set depth based on difficulty
    const res = expectiMinimax(model, DEPTH, aiColor, aiColor, -Infinity, Infinity, dieValue); // run expectiMinimax to get best move
    const best = res.bestMove || null; // best move found
    if (!best) return { ...allMoves[Math.floor(Math.random() * allMoves.length)], value: res.value }; // fallback: random move if none found
    // Normal: add variety
    if (difficulty === 'normal' && NORMAL_RANDOM_PROB > 0) { // NORMAL_RANDOM_PROB chance to randomize
      if (Math.random() < NORMAL_RANDOM_PROB) { // randomize
        if (NORMAL_RANDOM_TOP_K > 1) {
          // simulates a shallow re-evaluation among all moves to pick a top-K move
          const scored = [];
          const moves = orderMovesByPriority(allMoves, model, aiColor, dieValue); // order all moves by priority
          for (const mv of moves) {
            const nm = cloneModel(model);
            applyMoveModel(nm, mv.from.r, mv.from.c, mv.to.r, mv.to.c);
            // re-score with one less depth until leaf since we are at root
            const r2 = expectiMinimax(nm, DEPTH - 1, (MODEL_EXTRA_ROLL_IN_TREE && (dieValue===1||dieValue===4||dieValue===6)) ? aiColor : (aiColor === 'red' ? 'yellow' : 'red'), aiColor, -Infinity, Infinity, null); // recurse when MODEL_EXTRA_ROLL_IN_TREE is true and die is 1,4,6 (AI moves again), else opponent moves
            scored.push({ mv, v: r2.value }); // store move and its value
          }
          scored.sort((a, b) => b.v - a.v); // sort by value descending
          const k = Math.min(NORMAL_RANDOM_TOP_K, scored.length);  // top-K
          const pick = scored[Math.floor(Math.random() * k)].mv;
          return { ...pick, value: res.value };
        }
        // fallback: any random move
        return { ...allMoves[Math.floor(Math.random() * allMoves.length)], value: res.value };
      }
    }
    return { ...best, value: res.value }; // ... -> spread operator to return move with value in an object or array
  }

  window.TAB_AI = window.TAB_AI || {}; // ensure global namespace for TAB_AI
  window.TAB_AI.getAIMove = getAIMove; // expose getAIMove function to use in gameScript.js

})();