// ai.js
// Expectiminimax + alpha-beta pruning (nós de decisão) para Tâb.
// Expondo window.TAB_AI.getAIMove(dieValue, aiColor, difficulty)
// Retorna { from:{r,c}, to:{r,c}, value } ou null.
// (Código não altera o DOM do jogo — só lê e decide.)

(function () {
  if (!document) return;

  // ---- Tuning / feature flags ----
  const USE_WEIGHTED_STICK_DICE_CHANCE = true;    // chance nodes use real stick-dice distribution
  const MODEL_EXTRA_ROLL_IN_TREE = false;         // if true, on die in {1,4,6} the same player moves again in-tree
  const NORMAL_RANDOM_PROB = 0.18;                // randomization for Normal difficulty
  const NORMAL_RANDOM_TOP_K = 2;                  // if >1, pick randomly among top-K moves instead of any move
  const ORDER_MOVES_HEURISTIC = true;             // try captures first at decision nodes to help alpha-beta

  // Realistic stick-dice outcomes and probabilities:
  // Up-count: 0->6, 1->1, 2->2, 3->3, 4->4
  // Mapping used in game: {1,2,3,4,6} with approx probs: 1:25%, 2:38%, 3:25%, 4:6%, 6:6%
  const CHANCE_VALUES = [1, 2, 3, 4, 6];
  const CHANCE_WEIGHTS = [0.25, 0.38, 0.25, 0.06, 0.06];

  function cellKey(r, c) { return `${r},${c}`; }

  function buildModelFromDOM() {
    const cells = {};
    const cellNodes = Array.from(document.querySelectorAll('.cell'));
    let cols = null, rows = 4;
    for (const cell of cellNodes) {
      const r = parseInt(cell.dataset.r, 10);
      const c = parseInt(cell.dataset.c, 10);
      if (isNaN(r) || isNaN(c)) continue;
      cols = cols === null ? Math.max(c + 1, cols || 0) : Math.max(cols, c + 1);
      const arrowEl = cell.querySelector('.arrow');
      const arrow = {
        up: arrowEl && arrowEl.classList.contains('up'),
        down: arrowEl && arrowEl.classList.contains('down'),
        left: arrowEl && arrowEl.classList.contains('left'),
        right: arrowEl && arrowEl.classList.contains('right')
      };
      const pieceEl = cell.querySelector('.piece');
      const piece = pieceEl ? {
        owner: pieceEl.classList.contains('red') ? 'red' : (pieceEl.classList.contains('yellow') ? 'yellow' : null),
        moveState: pieceEl ? pieceEl.getAttribute('move-state') || 'moved' : null
      } : null;
      cells[`${r},${c}`] = { r, c, arrow, piece };
    }
    let red = 0, yellow = 0;
    Object.values(cells).forEach(s => {
      if (s.piece) {
        if (s.piece.owner === 'red') red++;
        if (s.piece.owner === 'yellow') yellow++;
      }
    });
    return { rows, cols: cols || 9, cells, counts: { red, yellow } };
  }

  function cloneModel(model) {
    const newCells = {};
    for (const k of Object.keys(model.cells)) {
      const c = model.cells[k];
      newCells[k] = {
        r: c.r,
        c: c.c,
        arrow: { ...c.arrow },
        piece: c.piece ? { owner: c.piece.owner, moveState: c.piece.moveState } : null
      };
    }
    return { rows: model.rows, cols: model.cols, cells: newCells, counts: { ...model.counts } };
  }

  function sideHasBasePieces(model, owner) {
    // Base row is r=3 in your rules
    for (const k of Object.keys(model.cells)) {
      const s = model.cells[k];
      if (s.piece && s.piece.owner === owner && s.r === 3) return true;
    }
    return false;
  }

  function getValidMovesModel(model, fromR, fromC, diceValue) {
    const key = cellKey(fromR, fromC);
    const start = model.cells[key];
    if (!start || !start.piece) return [];
    const moveState = start.piece.moveState;
    const rows = model.rows;
    const cols = model.cols;
    const owner = start.piece.owner;

    if (fromR === 1) {
      let remaining = diceValue;
      let currentC = fromC;
      const stepsToRightEnd = cols - 1 - currentC;
      const horizontalMove = Math.min(remaining, stepsToRightEnd);
      currentC += horizontalMove;
      remaining -= horizontalMove;

      if (remaining === 0) {
        const targetKey = cellKey(1, currentC);
        return model.cells[targetKey] ? [{ r: 1, c: currentC }] : [];
      }

      const targets = [];
      const upKey = cellKey(0, currentC);
      const downKey = cellKey(2, currentC);
      // Align with DOM rule: cannot go to top row if you still have base-row pieces
      const hasBasePieces = sideHasBasePieces(model, owner);

      if (!hasBasePieces && !(moveState === 'row-four' && fromR !== 0) && model.cells[upKey]) {
        targets.push({ r: 0, c: currentC });
      }
      if (model.cells[downKey]) targets.push({ r: 2, c: currentC });

      if (remaining > 1) {
        const further = [];
        for (const t of targets) {
          let curR = t.r, curC = t.c;
          let rem = remaining - 1;
          let ok = true;
          for (let s = 0; s < rem; s++) {
            const curCell = model.cells[cellKey(curR, curC)];
            if (!curCell) { ok = false; break; }
            const arrow = curCell.arrow;
            let newR = curR, newC = curC;
            if (arrow.up) newR--;
            if (arrow.down) newR++;
            if (arrow.left) newC--;
            if (arrow.right) newC++;
            if (newR < 0 || newR >= rows || newC < 0 || newC >= cols) { ok = false; break; }
            if (moveState === 'row-four' && fromR !== 0 && newR === 0) { ok = false; break; }
            curR = newR; curC = newC;
          }
          if (ok && model.cells[cellKey(curR, curC)]) further.push({ r: curR, c: curC });
        }
        return further;
      }
      return targets;
    }

    let curR = fromR, curC = fromC;
    for (let step = 0; step < diceValue; step++) {
      const curCell = model.cells[cellKey(curR, curC)];
      if (!curCell) return [];
      const arrow = curCell.arrow;
      let newR = curR, newC = curC;
      if (arrow.up) newR--;
      if (arrow.down) newR++;
      if (arrow.left) newC--;
      if (arrow.right) newC++;
      if (newR < 0 || newR >= rows || newC < 0 || newC >= cols) return [];
      if (moveState === 'row-four' && fromR !== 0 && newR === 0) return [];
      curR = newR; curC = newC;
    }
    return model.cells[cellKey(curR, curC)] ? [{ r: curR, c: curC }] : [];
  }

  function applyMoveModel(model, fromR, fromC, toR, toC) {
    const fromKey = cellKey(fromR, fromC);
    const toKey = cellKey(toR, toC);
    const piece = model.cells[fromKey] && model.cells[fromKey].piece;
    if (!piece) return { capture: false, winner: null };
    const dest = model.cells[toKey];
    let capture = false;
    if (dest && dest.piece) {
      if (dest.piece.owner !== piece.owner) {
        capture = true;
        if (dest.piece.owner === 'red') model.counts.red--;
        else if (dest.piece.owner === 'yellow') model.counts.yellow--;
        dest.piece = null;
      } else {
        return { capture: false, winner: null, illegal: true };
      }
    }
    model.cells[toKey].piece = { owner: piece.owner, moveState: piece.moveState };
    model.cells[fromKey].piece = null;
    if (toR === 0 || model.cells[toKey].piece.moveState === 'row-four') {
      model.cells[toKey].piece.moveState = 'row-four';
    } else if (model.cells[toKey].piece.moveState === 'not-moved') {
      model.cells[toKey].piece.moveState = 'moved';
    }
    let winner = null;
    if (model.counts.red <= 0) winner = 'yellow';
    if (model.counts.yellow <= 0) winner = 'red';
    return { capture, winner };
  }

  function enumerateMovesForPlayer(model, playerColor, dieValue) {
    const moves = [];
    for (const k of Object.keys(model.cells)) {
      const s = model.cells[k];
      if (!s.piece || s.piece.owner !== playerColor) continue;
      if (s.piece.moveState === 'not-moved' && dieValue !== 1) continue;
      const valids = getValidMovesModel(model, s.r, s.c, dieValue);
      for (const t of valids) {
        const dest = model.cells[cellKey(t.r, t.c)];
        if (dest.piece && dest.piece.owner === playerColor) continue;
        moves.push({ from: { r: s.r, c: s.c }, to: { r: t.r, c: t.c } });
      }
    }
    return moves;
  }

  // simple move ordering to help alpha–beta: captures first, then progress
  function orderMoves(moves, model, playerColor) {
    if (!ORDER_MOVES_HEURISTIC) return moves;
    return moves.slice().sort((a, b) => {
      const da = model.cells[cellKey(a.to.r, a.to.c)];
      const db = model.cells[cellKey(b.to.r, b.to.c)];
      const capA = da.piece && da.piece.owner && da.piece.owner !== playerColor ? 1 : 0;
      const capB = db.piece && db.piece.owner && db.piece.owner !== playerColor ? 1 : 0;
      if (capA !== capB) return capB - capA; // captures first
      // small tie-break: progress by column
      if (a.to.c !== b.to.c) return b.to.c - a.to.c;
      return 0;
    });
  }

  function isCaptureMove(model, mv, playerColor) {
    const dest = model.cells[`${mv.to.r},${mv.to.c}`];
    return !!(dest && dest.piece && dest.piece.owner && dest.piece.owner !== playerColor);
  }
  function isConversionMove(model, mv) {
    const from = model.cells[`${mv.from.r},${mv.from.c}`];
    return !!(from && from.piece && from.piece.moveState === 'not-moved');
  }
  function orderMovesByPriority(moves, model, playerColor, dieKnown) {
    // score = 200*isCapture + 50*(die==1 && isConversion) + small progress tie-break
    return moves.slice().sort((a, b) => {
      const capA = isCaptureMove(model, a, playerColor) ? 1 : 0;
      const capB = isCaptureMove(model, b, playerColor) ? 1 : 0;
      if (capA !== capB) return capB - capA;
  
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

  function evaluateModel(model, aiColor) {
    const opponent = aiColor === 'red' ? 'yellow' : 'red';
    const WEIGHT_PIECE = 200;
    const WEIGHT_PROGRESS = 4;
    const WEIGHT_SAFE = 10;
    let score = 0;
    score += WEIGHT_PIECE * (model.counts[aiColor] - model.counts[opponent]);
    for (const k of Object.keys(model.cells)) {
      const c = model.cells[k];
      if (!c.piece) continue;
      const colScore = c.c;
      if (c.piece.owner === aiColor) score += WEIGHT_PROGRESS * colScore;
      else score -= WEIGHT_PROGRESS * colScore;
      if ((c.arrow.up || c.arrow.down) && !(c.arrow.left || c.arrow.right)) {
        if (c.piece.owner === aiColor) score += WEIGHT_SAFE;
        else score -= WEIGHT_SAFE;
      }
    }
    return score;
  }

  function expectiMinimax(model, depth, playerToMove, aiColor, alpha, beta, dieKnown = null) {
    // terminal / leaf checks
    if (depth === 0) {
      return { value: evaluateModel(model, aiColor) };
    }
    if (model.counts.red <= 0) return { value: (aiColor === 'yellow') ? 1e9 : -1e9 };
    if (model.counts.yellow <= 0) return { value: (aiColor === 'red') ? 1e9 : -1e9 };

    const opponent = playerToMove === 'red' ? 'yellow' : 'red';

    // Chance node: unknown next die
    if (dieKnown === null) {
      if (!USE_WEIGHTED_STICK_DICE_CHANCE) {
        // Uniform over 1..6 (legacy)
        let total = 0;
        for (let die = 1; die <= 6; die++) {
          const res = expectiMinimax(model, depth, playerToMove, aiColor, alpha, beta, die);
          total += res.value;
        }
        return { value: total / 6 };
      } else {
        // Weighted over real stick outcomes {1,2,3,4,6}
        let total = 0;
        let sumW = 0;
        for (let i = 0; i < CHANCE_VALUES.length; i++) {
          const die = CHANCE_VALUES[i];
          const w = CHANCE_WEIGHTS[i];
          const res = expectiMinimax(model, depth, playerToMove, aiColor, alpha, beta, die);
          total += w * res.value;
          sumW += w;
        }
        return { value: sumW > 0 ? total / sumW : 0 };
      }
    }

    // Decision node with known die
  const movesRaw = enumerateMovesForPlayer(model, playerToMove, dieKnown);
  if (movesRaw.length === 0) {
    const res = expectiMinimax(model, depth - 1, opponent, aiColor, alpha, beta, null);
    return { value: res.value };
  }
  const moves = orderMovesByPriority(movesRaw, model, playerToMove, dieKnown);

  if (playerToMove === aiColor) {
    let bestVal = -Infinity;
    let bestMove = null;
    for (const mv of moves) {
      const nm = cloneModel(model);
      applyMoveModel(nm, mv.from.r, mv.from.c, mv.to.r, mv.to.c);
      const res = expectiMinimax(nm, depth - 1, opponent, aiColor, alpha, beta, null);
      if (res.value > bestVal) { bestVal = res.value; bestMove = mv; }
      alpha = Math.max(alpha, bestVal);
      if (beta <= alpha) break;
    }
    return { value: bestVal, bestMove };
  } else {
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

  function getAIMove(dieValue, aiColor, difficulty = 'normal') {
    const model = buildModelFromDOM();
    const allMoves = [];
    for (const k of Object.keys(model.cells)) {
      const s = model.cells[k];
      if (!s.piece || s.piece.owner !== aiColor) continue;
      if (s.piece.moveState === 'not-moved' && dieValue !== 1) continue;
      const valids = getValidMovesModel(model, s.r, s.c, dieValue);
      for (const t of valids) {
        const dest = model.cells[cellKey(t.r, t.c)];
        if (dest.piece && dest.piece.owner === aiColor) continue;
        allMoves.push({ from: { r: s.r, c: s.c }, to: { r: t.r, c: t.c } });
      }
    }
    if (allMoves.length === 0) return null;
    if (difficulty === 'easy') {
      const capMoves = allMoves.filter(m => {
        const dest = model.cells[cellKey(m.to.r, m.to.c)];
        return dest.piece && dest.piece.owner !== aiColor;
      });
      if (capMoves.length > 0) return { ...capMoves[Math.floor(Math.random() * capMoves.length)], value: null };
      return { ...allMoves[Math.floor(Math.random() * allMoves.length)], value: null };
    }
    const DEPTH = difficulty === 'normal' ? 2 : 4;
    const res = expectiMinimax(model, DEPTH, aiColor, aiColor, -Infinity, Infinity, dieValue);
    const best = res.bestMove || null;
    if (!best) return { ...allMoves[Math.floor(Math.random() * allMoves.length)], value: res.value };
    // Normal: add variety
    if (difficulty === 'normal' && NORMAL_RANDOM_PROB > 0) {
      if (Math.random() < NORMAL_RANDOM_PROB) {
        if (NORMAL_RANDOM_TOP_K > 1) {
          // pick randomly among top-K by re-scoring root moves (cheap at depth=2)
          const scored = [];
          const moves = orderMovesByPriority(allMoves, model, aiColor, dieValue);
          for (const mv of moves) {
            const nm = cloneModel(model);
            applyMoveModel(nm, mv.from.r, mv.from.c, mv.to.r, mv.to.c);
            const r2 = expectiMinimax(nm, DEPTH - 1, (MODEL_EXTRA_ROLL_IN_TREE && (dieValue===1||dieValue===4||dieValue===6)) ? aiColor : (aiColor === 'red' ? 'yellow' : 'red'), aiColor, -Infinity, Infinity, null);
            scored.push({ mv, v: r2.value });
          }
          scored.sort((a, b) => b.v - a.v);
          const k = Math.min(NORMAL_RANDOM_TOP_K, scored.length);
          const pick = scored[Math.floor(Math.random() * k)].mv;
          return { ...pick, value: res.value };
        }
        // fallback: any random move
        return { ...allMoves[Math.floor(Math.random() * allMoves.length)], value: res.value };
      }
    }
    return { ...best, value: res.value };
  }

  window.TAB_AI = window.TAB_AI || {};
  window.TAB_AI.getAIMove = getAIMove;

})();