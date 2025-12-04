// Shared rules used by both AI and PvP.

window.Rules = (function () {
    function isConfigValid(elements) {
        const modeSelect = elements.modeSelect;
        const iaLevelSelect = elements.iaLevelSelect;
        const modeVal = modeSelect ? modeSelect.value : '';
        if (modeVal !== 'player' && modeVal !== 'ia') return false;
        if (modeVal === 'ia') {
            const diff = iaLevelSelect ? iaLevelSelect.value : '';
            if (!['easy', 'normal', 'hard'].includes(diff)) return false;
        }
        return true;
    }

    function selectPiece(S, piece) {
        if (!S.gameActive) return;
        if (S.lastDiceValue == null) {
            Messages.system('msg_roll_first');
            return;
        }
        if (S.selectedPiece === piece) {
            S.selectedPiece.classList.remove('selected');
            S.selectedPiece = null;
            GameUI.clearHighlights();
            return;
        }
        if ((S.currentPlayer == 1 && piece.classList.contains('red')) ||
            (S.currentPlayer == 2 && piece.classList.contains('yellow'))) {
            if (S.selectedPiece) S.selectedPiece.classList.remove('selected');
            S.selectedPiece = piece;
            piece.classList.add('selected');
        }
    }

    function getValidMoves(S, piece, diceValue = S.lastDiceValue) {
        if (!piece || diceValue == null) return [];
        const startCell = piece.parentElement;
        const cols = S.getCols();
        const rows = S.rows;

        const r = parseInt(startCell.dataset.r, 10);
        const c = parseInt(startCell.dataset.c, 10);
        const moveState = piece.getAttribute('move-state');
        const playerClass = piece.classList.contains('red') ? 'red' : 'yellow';

        const hasBasePieces = Array
            .from(S.elements.gameBoard.querySelectorAll(`.piece.${playerClass}`))
            .some(p => parseInt(p.parentElement.dataset.r, 10) === 3);

        if (r === 1) {
            let remaining = diceValue;
            let currentC = c;
            const stepsToRightEnd = cols - 1 - currentC;
            const horizontalMove = Math.min(remaining, stepsToRightEnd);
            currentC += horizontalMove;
            remaining -= horizontalMove;

            if (remaining === 0) {
                const targetCell = S.elements.gameBoard.querySelector(`.cell[data-r="1"][data-c="${currentC}"]`);
                return targetCell ? [targetCell] : [];
            }

            const targets = [];
            const upCell = S.elements.gameBoard.querySelector(`.cell[data-r="0"][data-c="${currentC}"]`);
            const downCell = S.elements.gameBoard.querySelector(`.cell[data-r="2"][data-c="${currentC}"]`);

            if (!hasBasePieces && moveState !== 'row-four' && upCell) {
                targets.push({ cell: upCell, r: 0, c: currentC });
            }
            if (downCell) targets.push({ cell: downCell, r: 2, c: currentC });

            if (remaining > 1) {
                const furtherTargets = [];
                targets.forEach(({ cell }) => {
                    let currentCell = cell;
                    let rem = remaining - 1;
                    for (let step = 0; step < rem; step++) {
                        const arrow = currentCell.querySelector('.arrow');
                        if (!arrow) break;
                        let newR = parseInt(currentCell.dataset.r, 10);
                        let newC = parseInt(currentCell.dataset.c, 10);
                        if (arrow.classList.contains('up')) newR--;
                        if (arrow.classList.contains('down')) newR++;
                        if (arrow.classList.contains('left')) newC--;
                        if (arrow.classList.contains('right')) newC++;
                        if (newR < 0 || newR >= rows || newC < 0 || newC >= cols) break;
                        if (moveState === 'row-four' && r !== 0 && newR === 0) break;
                        currentCell = S.elements.gameBoard.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
                    }
                    if (currentCell) furtherTargets.push(currentCell);
                });
                return furtherTargets;
            }
            return targets.map(t => t.cell);
        }

        let currentCell = startCell;
        for (let step = 0; step < diceValue; step++) {
            const arrow = currentCell.querySelector('.arrow');
            if (!arrow) break;
            let newR = parseInt(currentCell.dataset.r, 10);
            let newC = parseInt(currentCell.dataset.c, 10);
            if (arrow.classList.contains('up')) newR--;
            if (arrow.classList.contains('down')) newR++;
            if (arrow.classList.contains('left')) newC--;
            if (arrow.classList.contains('right')) newC++;
            if (newR < 0 || newR >= rows || newC < 0 || newC >= cols) break;
            if ((hasBasePieces && newR === 0) || (moveState === 'row-four' && r !== 0 && newR === 0)) break;
            currentCell = S.elements.gameBoard.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
        }
        return currentCell ? [currentCell] : [];
    }

    function enumerateLegalMovesDOM(S, playerNum, diceValue) {
        const color = S.getColorForPlayerNum(playerNum);
        const moves = [];
        const pieces = Array.from(S.elements.gameBoard.querySelectorAll('.piece.' + color));
        for (const piece of pieces) {
            const state = piece.getAttribute('move-state');
            if (state === 'not-moved' && diceValue !== 1) continue;
            const fromCell = piece.parentElement;
            const fromR = parseInt(fromCell.dataset.r, 10);
            const fromC = parseInt(fromCell.dataset.c, 10);
            const valids = getValidMoves(S, piece, diceValue);
            for (const dest of valids) {
                const occ = dest.querySelector('.piece');
                if (occ && occ.classList.contains(color)) continue;
                const toR = parseInt(dest.dataset.r, 10);
                const toC = parseInt(dest.dataset.c, 10);
                moves.push({ piece, from: { r: fromR, c: fromC }, destCell: dest, to: { r: toR, c: toC } });
            }
        }
        return moves;
    }

    function countConvertiblePieces(S, playerNum) {
        const color = S.getColorForPlayerNum(playerNum);
        return Array.from(S.elements.gameBoard.querySelectorAll('.piece.' + color))
            .filter(p => p.getAttribute('move-state') === 'not-moved').length;
    }

    function sendCapturedPieceToContainer(pieceEl, capturedByPlayer, S) {
        if (!pieceEl) return;
        const target = capturedByPlayer === S.humanPlayerNum ? S.elements.capturedP1 : S.elements.capturedP2;
        if (!target) return;
        const isRed = pieceEl.classList.contains('red');
        const colorClass = isRed ? 'red' : 'yellow';
        const token = document.createElement('div');
        token.className = `captured-token ${colorClass}`;
        token.setAttribute('aria-label', colorClass === 'red' ? 'Captured red piece' : 'Captured yellow piece');
        target.appendChild(token);
        pieceEl.remove();
    }

    function checkWinCondition(S) {
        if (!S.gameActive) return false;
        if (S.redPieces === 0 && S.yellowPieces === 0) return false;
        let winnerNum = null;
        if (S.redPieces === 0) winnerNum = 2;
        else if (S.yellowPieces === 0) winnerNum = 1;
        else return false;
        Messages.system('msg_player_won', { player: winnerNum });
        try { TabStats.setWinner(winnerNum); } catch { }
        endGame(S);
        return true;
    }

    function endGame(S) {
        try {
            if (window.updateEventSource) {
                window.updateEventSource.close();
                window.updateEventSource = null;
            }
        } catch { }
        try { TabStats.showSummary(); } catch { }
        S.currentPlayer = 1;
        S.gameActive = false;
        S.redPieces = 0;
        S.yellowPieces = 0;
        S.selectedPiece = null;
        S.vsAI = false;
        S.vsPlayer = false;
        S.aiPlayerNum = null;
        S.humanPlayerNum = 1;
        S.lastDiceValue = null;
        if (S.elements.capturedP1) S.elements.capturedP1.innerHTML = '';
        if (S.elements.capturedP2) S.elements.capturedP2.innerHTML = '';
        GameUI.renderBoard(S.getCols());
        if (S.elements.nextTurnBtn) S.elements.nextTurnBtn.disabled = true;
        if (S.elements.throwBtn) S.elements.throwBtn.disabled = true;
        GameState.setConfigEnabled(true);
        const { playButton, leaveButton } = S.elements;
        if (playButton) playButton.disabled = !isConfigValid(S.elements);
        if (leaveButton) leaveButton.disabled = true;
    }

    // No final do game_rules.js

    function processDiceResult(S, UI, Msg, result) {
        S.lastDiceValue = result;
        Msg.player(S.currentPlayer, 'msg_dice_thrown', { value: result });

        const isExtra = (result === 1 || result === 4 || result === 6);
        const isTab = (result === 1); // Tâb

        // Calcular movimentos legais
        const legalMoves = enumerateLegalMovesDOM(S, S.currentPlayer, result);
        const playerColor = S.getColorForPlayerNum(S.currentPlayer);

        // Filtrar quais desses movimentos resultam em captura
        const captureMoves = legalMoves.filter(m => {
            const occ = m.destCell.querySelector('.piece');
            return occ && !occ.classList.contains(playerColor);
        });

        // CASO 1: Sem movimentos
        if (legalMoves.length === 0) {
            if (isExtra) {
                Msg.system('msg_player_no_moves_extra');
                try { TabStats.onDice(S.currentPlayer, result); TabStats.onExtraRoll(S.currentPlayer, result); } catch { }
                // Reativa o botão para jogar de novo
                if (S.currentPlayer === S.humanPlayerNum && S.elements.throwBtn) {
                    S.elements.throwBtn.disabled = false;
                    S.lastDiceValue = null;
                }
            } else {
                Msg.system('msg_player_no_moves_pass');
                try { TabStats.onDice(S.currentPlayer, result); } catch { }
                // Ativa o botão de passar a vez
                if (S.currentPlayer === S.humanPlayerNum && S.elements.nextTurnBtn) {
                    S.elements.nextTurnBtn.disabled = false;
                    if (S.elements.throwBtn) S.elements.throwBtn.disabled = true;
                }
            }
            return;
        }

        // CASO 2: Movimentos possíveis (Verifica Capturas)

        // Lógica de mensagens de Tâb (peças convertíveis)
        if (isTab) {
            const convertibleCount = countConvertiblePieces(S, S.currentPlayer);
            if (convertibleCount > 0) {
                Msg.system('msg_dice_thrown_one', { n: convertibleCount });
            }
        }

        // --- CORREÇÃO AQUI: Aviso de Captura Geral ---
        if (captureMoves.length > 0) {
            // Se houver capturas, avisa SEMPRE, independentemente do dado
            Msg.player(S.currentPlayer, 'msg_capture', { n: captureMoves.length });
        } else {
            // Mensagem padrão se não houver capturas
            if (!isTab) {
                // Se não for Tab (que já deu msg acima) e não houver captura, diz que pode mover
                if (isExtra) Msg.system('msg_dice_thrown_double', { value: result });
                else Msg.system('msg_player_can_move');
            } else {
                // Se for Tab e não houver captura nem conversão, avisa do extra roll
                Msg.system('msg_dice_thrown_double', { value: result });
            }
        }
        // ----------------------------------------------

        // Registar estatísticas
        try {
            TabStats.onDice(S.currentPlayer, result);
            if (isExtra) TabStats.onExtraRoll(S.currentPlayer, result);
        } catch { }

        // Bloquear botões do humano enquanto ele decide o movimento
        if (S.currentPlayer === S.humanPlayerNum) {
            if (S.elements.throwBtn) S.elements.throwBtn.disabled = true;
            if (S.elements.nextTurnBtn) S.elements.nextTurnBtn.disabled = true;
        }
    }

    return {
        isConfigValid,
        selectPiece,
        getValidMoves,
        enumerateLegalMovesDOM,
        countConvertiblePieces,
        sendCapturedPieceToContainer,
        checkWinCondition,
        endGame,
        processDiceResult
    };
})();