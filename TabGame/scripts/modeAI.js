// AI controller only. No network calls.

window.AIController = (function () {
    let S, UI, Msg, Dice;
    let difficulty;
  
    function init(GameState, GameUI, Messages, DiceModule, aiLevel, humanFirst) {
      S = GameState; UI = GameUI; Msg = Messages; Dice = DiceModule;
  
      // Set mode flags and difficulty
      S.vsAI = true; S.vsPlayer = false;
      S.aiDifficulty = aiLevel || 'normal';
  
      // Assign players depending on who starts
      S.aiPlayerNum = humanFirst ? 2 : 1;
      S.humanPlayerNum = humanFirst ? 1 : 2;
      difficulty = S.aiDifficulty;
  
      // Current player starts as 1 (red), same do legacy
      S.currentPlayer = 1;
      if (S.elements.currentPlayerEl) S.elements.currentPlayerEl.textContent = S.currentPlayer;
  
      // Stats and start message
      try {
        TabStats.start({ mode: 'ia', aiDifficulty: difficulty, cols: S.getCols(), firstPlayer: humanFirst ? 'Human' : 'Ai' });
        TabStats.onTurnAdvance();
      } catch {}
  
      Msg.system('msg_game_started');
  
      // Lock config and set active
      S.setGameActive(true);
  
      // Buttons state like legacy
      const { nextTurnBtn, throwBtn, playButton, leaveButton } = S.elements;
      if (nextTurnBtn) nextTurnBtn.disabled = true;
      if (throwBtn) throwBtn.disabled = (S.vsAI && S.aiPlayerNum === 1); // disable throw if AI starts
      if (playButton) playButton.disabled = true;
      if (leaveButton) leaveButton.disabled = false;
  
      // Prompt dice if human starts and throw enabled
      if (S.isHumanTurn() && throwBtn && !throwBtn.disabled) {
        Msg.system('msg_dice');
      }
  
      // If AI starts, run its turn shortly
      if (S.vsAI && S.aiPlayerNum === 1) {
        setTimeout(() => runAiTurnLoop().catch(err => console.warn('Erro no turno inicial da IA:', err)), 250);
      }
    }
  
    function onCellClick(cell) {
      if (!S.gameActive) return;
      // Block input during AI turn
      if (S.vsAI && S.currentPlayer === S.aiPlayerNum) return;
  
      const pieceInCell = cell.querySelector('.piece');
      // Select piece of current player
      if (pieceInCell && (
        (S.currentPlayer == 1 && pieceInCell.classList.contains('red')) ||
        (S.currentPlayer == 2 && pieceInCell.classList.contains('yellow'))
      )) {
        Rules.selectPiece(S, pieceInCell);
        if (!S.selectedPiece) return;
  
        GameUI.clearHighlights();
        const state = pieceInCell.getAttribute('move-state');
        const roll = parseInt(S.lastDiceValue, 10);
        const movesAllowed = (state === 'not-moved' && roll !== 1) ? [] : Rules.getValidMoves(S, pieceInCell);
        movesAllowed.forEach(dest => dest.classList.add('green-glow'));
        return;
      }
  
      // Move if a piece is selected and we have a dice
      if (S.selectedPiece && S.lastDiceValue != null) {
        const state = S.selectedPiece.getAttribute('move-state');
        const currentRoll = parseInt(S.lastDiceValue, 10);
        if (state === 'not-moved' && currentRoll !== 1) return;
  
        const possibleMoves = Rules.getValidMoves(S, S.selectedPiece);
        const isValidMove = possibleMoves.some(dest => dest === cell);
        if (isValidMove) {
          if (state === 'not-moved' && currentRoll === 1) {
            S.selectedPiece.setAttribute('move-state', 'moved');
          }
          UI.movePieceTo(S.selectedPiece, cell);
          GameUI.clearHighlights();
          S.selectedPiece.classList.remove('selected');
          S.selectedPiece = null;
  
          if (Rules.checkWinCondition(S)) return;
  
          S.lastDiceValue = null;
          // Extra roll for 1/4/6, identical ao legacy
          if ([1, 4, 6].includes(currentRoll)) {
            if (S.elements.throwBtn) S.elements.throwBtn.disabled = false;
            if (S.elements.nextTurnBtn) S.elements.nextTurnBtn.disabled = true;
          } else {
            S.nextTurn();
          }
        }
      }
    }
  
    async function runAiTurnLoop() {
      if (!S.vsAI || !S.gameActive || S.currentPlayer !== S.aiPlayerNum) return;
  
      // Block human controls during AI
      if (S.elements.throwBtn) S.elements.throwBtn.disabled = true;
      if (S.elements.nextTurnBtn) S.elements.nextTurnBtn.disabled = true;
  
      const aiColor = S.getColorForPlayerNum(S.aiPlayerNum);
  
      while (S.gameActive && S.currentPlayer === S.aiPlayerNum) {
        let result;
        try { result = await Dice.spawnAndLaunch(); } catch { break; }
        S.lastDiceValue = result;
        try { TabStats.onDice(S.currentPlayer, result); } catch {}
        Msg.player(S.currentPlayer, 'msg_ai_dice', { value: result });
  
        const domMoves = Rules.enumerateLegalMovesDOM(S, S.aiPlayerNum, result);
        if (domMoves.length === 0) {
          if ([1, 4, 6].includes(result)) {
            Msg.system('msg_ai_no_moves_extra');
            try { TabStats.onExtraRoll(S.currentPlayer, result); } catch {}
            S.lastDiceValue = null;
            continue; // AI rolls again
          } else {
            Msg.system('msg_ai_no_moves_pass');
            S.lastDiceValue = null;
            try { TabStats.onPass(S.currentPlayer); } catch {}
            S.nextTurn();
            break;
          }
        }
  
        // Choose move using TAB_AI.getAIMove, matching ai.js behavior
        let chosenMove = null;
        try {
          if (window.TAB_AI && typeof window.TAB_AI.getAIMove === 'function') {
            const choice = window.TAB_AI.getAIMove(result, aiColor, difficulty || 'normal');
            if (choice && choice.from && choice.to) {
              const fromCell = S.elements.gameBoard.querySelector(`.cell[data-r="${choice.from.r}"][data-c="${choice.from.c}"]`);
              const destCell = S.elements.gameBoard.querySelector(`.cell[data-r="${choice.to.r}"][data-c="${choice.to.c}"]`);
              const piece = fromCell ? fromCell.querySelector(`.piece.${aiColor}`) : null;
              if (fromCell && destCell && piece) {
                const legalCells = Rules.getValidMoves(S, piece, result);
                const isInLegalList = legalCells.some(cell => cell === destCell);
                const occ = destCell.querySelector('.piece');
                const blockedByOwn = occ && occ.classList.contains(aiColor);
                if (isInLegalList && !blockedByOwn) {
                  chosenMove = { piece, from: choice.from, destCell, to: choice.to };
                }
              }
            }
          }
        } catch (e) { console.warn('Erro ao obter jogada da IA:', e); }
  
        if (!chosenMove) {
          // Fallback: captura primeiro, senão primeiro legal — igual ao legacy
          const captureMoves = domMoves.filter(m => {
            const occ = m.destCell.querySelector('.piece');
            return occ && !occ.classList.contains(aiColor);
          });
          chosenMove = captureMoves[0] || domMoves[0];
          if (!chosenMove) {
            if ([1, 4, 6].includes(result)) {
              Msg.system('msg_ai_no_moves_extra');
              S.lastDiceValue = null;
              continue;
            } else {
              Msg.system('msg_ai_no_moves_pass');
              S.lastDiceValue = null;
              S.nextTurn();
              break;
            }
          }
        }
  
        // Apply move
        const piece = chosenMove.piece;
        const destCell = chosenMove.destCell;
        const state = piece.getAttribute('move-state');
        if (state === 'not-moved' && result === 1) piece.setAttribute('move-state', 'moved');
        UI.movePieceTo(piece, destCell);
  
        if (Rules.checkWinCondition(S)) return;
  
        // Extra roll or pass turn
        if ([1, 4, 6].includes(result)) {
          Msg.system('msg_ai_extra_roll');
          try { TabStats.onExtraRoll(S.currentPlayer, result); } catch {}
          S.lastDiceValue = null;
          continue;
        } else {
          S.lastDiceValue = null;
          S.nextTurn();
          break;
        }
      }
    }
  
    return { init, onCellClick, runAiTurnLoop };
  })();