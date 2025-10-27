// DOMContentLoaded ensures that all html is loaded before script runs
document.addEventListener("DOMContentLoaded", () => {
    const widthSelect = document.getElementById('width');
    const gameBoard = document.getElementById('gameBoard');
    const messagesEl = document.getElementById('messages');
    const currentPlayerEl = document.getElementById('currentPlayer');
    const nextTurnBtn = document.getElementById('nextTurn');
    const throwBtn = document.getElementById('throwDiceBtn'); // mover para o topo
    const toggleMuteBtn = document.getElementById('toggleMute');
    const playButton = document.getElementById('playButton');
    const authForm = document.querySelector('.authForm');

    // selects de configuração
    const modeSelect = document.getElementById('game_mode');
    const iaLevelSelect = document.getElementById('ia_lvl');
    const firstToPlayCheckbox = document.getElementById('first_to_play');

    const rows = 4;

    // estado
    let currentPlayer = 1; // 1 or 2
    let gameActive = false;

    // estado IA / modo
    let gameMode = 'player';      // 'player' | 'ia'
    let vsAI = false;
    let aiDifficulty = 'normal';  // 'easy' | 'normal' | 'hard'
    let aiPlayerNum = null;       // 1 (red) ou 2 (yellow)
    let humanPlayerNum = 1;

    // peças
    let redPieces = 0;
    let yellowPieces = 0;
    let selectedPiece = null;

    // dados
    let lastDiceValue = null;

    // helpers cor
    function getColorForPlayerNum(n) { return n === 1 ? 'red' : 'yellow'; }

    // validação de config + UX do botão Start
    function isConfigValid() {
        const modeVal = modeSelect ? modeSelect.value : '';
        if (modeVal !== 'player' && modeVal !== 'ia') return false;
        if (modeVal === 'ia') {
            const diff = iaLevelSelect ? iaLevelSelect.value : '';
            if (!['easy', 'normal', 'hard'].includes(diff)) return false;
        }
        return true;
    }
    function updatePlayButtonState() {
        if (!playButton) return;
        playButton.disabled = !isConfigValid();
    }
    if (modeSelect) modeSelect.addEventListener('change', updatePlayButtonState);
    if (iaLevelSelect) iaLevelSelect.addEventListener('change', updatePlayButtonState);
    updatePlayButtonState(); // estado inicial

    // ---- RENDER TABULEIRO ----
    function renderBoard(cols) {
        redPieces = cols;
        yellowPieces = cols;
        gameBoard.style.setProperty('--cols', cols);
        gameBoard.style.gridTemplateColumns = `repeat(${cols}, minmax(36px, 1fr))`;
        gameBoard.innerHTML = '';

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.r = r;
                cell.dataset.c = c;

                const arrow = document.createElement('i');
                if (r === 0) arrow.className = 'arrow ' + (c === 0 ? 'down' : 'left');
                else if (r === 1) arrow.className = 'arrow ' + (c === cols - 1 ? 'up down' : 'right');
                else if (r === 2) arrow.className = 'arrow ' + (c === 0 ? 'up' : 'left');
                else if (r === 3) arrow.className = 'arrow ' + (c === cols - 1 ? 'up' : 'right');

                // peças iniciais
                const piece = document.createElement('div');
                piece.setAttribute('move-state', 'not-moved');
                piece.classList.add('piece');

                if (r == 0) { piece.classList.add('yellow'); cell.appendChild(piece); }
                if (r == 3) { piece.classList.add('red'); cell.appendChild(piece); }

                // jogada por clique
                cell.addEventListener('click', () => handleCellClick(cell));

                cell.appendChild(arrow);
                gameBoard.appendChild(cell);
            }
        }
    }

    // seleção de peça
    function selectPiece(piece) {
        if (!gameActive) return;
        if (selectedPiece == piece) {
            selectedPiece.classList.remove('selected');
            selectedPiece = null;
            clearHighlights();
            return;
        }
        if ((currentPlayer == 1 && piece.classList.contains('red')) ||
            (currentPlayer == 2 && piece.classList.contains('yellow'))) {
            if (selectedPiece) selectedPiece.classList.remove('selected');
            selectedPiece = piece;
            piece.classList.add('selected');
        }
    }

    function clearHighlights() {
        gameBoard.querySelectorAll('.cell.green-glow').forEach(c => {
            c.classList.remove('green-glow', 'pulse');
        });
    }

    function handleCellClick(cell) {
        if (!gameActive) return;
        // bloquear input no turno da IA
        if (vsAI && currentPlayer === aiPlayerNum) return;

        const pieceInCell = cell.querySelector('.piece');

        // selecionar peça do jogador atual
        if (pieceInCell && ((currentPlayer == 1 && pieceInCell.classList.contains('red')) ||
            (currentPlayer == 2 && pieceInCell.classList.contains('yellow')))) {
            selectPiece(pieceInCell);
            if (!selectedPiece) return;
            clearHighlights();

            const state = pieceInCell.getAttribute('move-state');
            const diceAllowed = (state === 'not-moved' && lastDiceValue !== 1) ? [] : getValidMoves(pieceInCell);
            diceAllowed.forEach(dest => dest.classList.add('green-glow'));
            return;
        }

        // tentar mover a peça selecionada para a célula clicada
        if (selectedPiece && lastDiceValue != null) {
            const state = selectedPiece.getAttribute('move-state');
            if (state === 'not-moved' && lastDiceValue !== 1) return;

            const possibleMoves = getValidMoves(selectedPiece);
            const isValidMove = possibleMoves.some(dest => dest === cell);

            if (isValidMove) {
                if (state === 'not-moved' && lastDiceValue === 1) {
                    selectedPiece.setAttribute('move-state', 'moved');
                }
                movePieceTo(selectedPiece, cell);
                clearHighlights();
                selectedPiece.classList.remove('selected');
                selectedPiece = null;

                if (checkWinCondition()) return;

                if (lastDiceValue === 4 || lastDiceValue === 6 || lastDiceValue === 1) {
                    throwBtn.disabled = false;
                    nextTurnBtn.disabled = true;
                } else {
                    nextTurn();
                }
                lastDiceValue = null;
            }
        }
    }

    function getValidMoves(piece, diceValue = lastDiceValue) {
        if (!piece || diceValue == null) return [];

        const startCell = piece.parentElement;
        const cols = parseInt(gameBoard.style.getPropertyValue('--cols'), 10);

        const r = parseInt(startCell.dataset.r, 10);
        const c = parseInt(startCell.dataset.c, 10);
        const moveState = piece.getAttribute('move-state');
        const playerClass = piece.classList.contains('red') ? 'red' : 'yellow';

        // regra: não pode entrar na fila de topo se tiver peças na base
        const hasBasePieces = Array
            .from(gameBoard.querySelectorAll(`.piece.${playerClass}`))
            .some(p => parseInt(p.parentElement.dataset.r, 10) === 3);

        // caso especial: fila 1 (index 1)
        if (r === 1) {
            let remaining = diceValue;
            let currentC = c;

            const stepsToRightEnd = cols - 1 - currentC;
            const horizontalMove = Math.min(remaining, stepsToRightEnd);
            currentC += horizontalMove;
            remaining -= horizontalMove;

            if (remaining === 0) {
                const targetCell = gameBoard.querySelector(`.cell[data-r="1"][data-c="${currentC}"]`);
                return targetCell ? [targetCell] : [];
            }

            const targets = [];
            const upCell = gameBoard.querySelector(`.cell[data-r="0"][data-c="${currentC}"]`);
            const downCell = gameBoard.querySelector(`.cell[data-r="2"][data-c="${currentC}"]`);

            if (!hasBasePieces && !(moveState === 'row-four' && r !== 0) && upCell) {
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

                        currentCell = gameBoard.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
                    }
                    if (currentCell) furtherTargets.push(currentCell);
                });
                return furtherTargets;
            }

            return targets.map(t => t.cell);
        }

        // movimento normal pelas setas
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

            currentCell = gameBoard.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
        }

        return currentCell ? [currentCell] : [];
    }

    function movePieceTo(piece, destCell) {
        const existingPiece = destCell.querySelector('.piece');
        if (existingPiece) {
            if (existingPiece.classList.contains('red')) {
                redPieces--;
                showMessage({ who: 'system', key: 'red_pieces', params:{count: redPieces }});
            } else if (existingPiece.classList.contains('yellow')) {
                yellowPieces--;
                showMessage({ who: 'system', key: 'yellow_pieces', params:{count:yellowPieces }});
            }
            existingPiece.remove();
        }

        const destRow = parseInt(destCell.dataset.r, 10);
        const currentState = piece.getAttribute('move-state');
        if (destRow === 0 || currentState === 'row-four') {
            piece.setAttribute('move-state', 'row-four');
        }
        destCell.appendChild(piece);
    }

    function flipBoard() {
        lastDiceValue = null;
        // preparar UI para novo turno
        if (throwBtn) throwBtn.disabled = (vsAI && (currentPlayer === aiPlayerNum));
        if (nextTurnBtn) nextTurnBtn.disabled = true;

        const cols = parseInt(gameBoard.style.getPropertyValue('--cols'), 10);
        const cells = Array.from(gameBoard.querySelectorAll('.cell'));

        if (selectedPiece) {
            selectedPiece.classList.remove('selected');
            selectedPiece = null;
        }

        const newPositions = [];
        cells.forEach(cell => {
            const piece = cell.querySelector('.piece');
            if (piece) {
                const r = parseInt(cell.dataset.r, 10);
                const c = parseInt(cell.dataset.c, 10);
                const newR = rows - 1 - r;
                const newC = cols - 1 - c;
                newPositions.push({ piece, newR, newC });
            }
        });

        cells.forEach(cell => {
            const piece = cell.querySelector('.piece');
            if (piece) piece.remove();
        });

        newPositions.forEach(({ piece, newR, newC }) => {
            const dest = gameBoard.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
            if (dest) dest.appendChild(piece);
        });
    }

    // --- Turnos ---
    function nextTurn() {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        currentPlayerEl.textContent = currentPlayer;
        showMessage({ who: 'system', key: 'msg_turn_of', params: {player: currentPlayer }});
        flipBoard();

        // se for IA, lança automaticamente
        if (vsAI && currentPlayer === aiPlayerNum) {
            setTimeout(() => runAiTurnLoop().catch(err => console.warn('Erro no turno da IA:', err)), 200);
        }
    }

    function checkWinCondition() {
        if (redPieces == 0) {
            showMessage({ who: 'system', key: 'msg_player_won', params:{player:2}});
            endGame();
            return true;
        } else if (yellowPieces == 0) {
            showMessage({ who: 'system', key: 'msg_player_won', params:{player: 1}});
            endGame();
            return true;
        }
        return false;
    }

    function endGame() {
        currentPlayer = 1;
        gameActive = false;

        redPieces = 0;
        yellowPieces = 0;
        selectedPiece = null;

        // IA
        vsAI = false;
        aiPlayerNum = null;
        humanPlayerNum = 1;

        lastDiceValue = null;
        renderBoard(parseInt(widthSelect.value, 10));
        if (nextTurnBtn) nextTurnBtn.disabled = true;
        if (throwBtn) throwBtn.disabled = true;
        updatePlayButtonState();
    }

    // mensagens
    function showMessage({ who = 'system', player = null, text, key, params }) {
        const wrap = document.createElement('div');
        wrap.className = 'message';
      
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
      
        if (key) {
          // guardar key/params para re-tradução futura
          bubble.dataset.i18nKey = key;
          if (params && Object.keys(params).length) {
            bubble.dataset.i18nParams = JSON.stringify(params);
          }
          bubble.textContent = t(key, params || {});
        } else {
          // fallback: texto literal (não será re-traduzido no futuro)
          bubble.textContent = text ?? '';
        }
      
        if (who === 'system') {
          wrap.classList.add('msg-server');
          wrap.appendChild(bubble);
        } else {
          wrap.classList.add(player === 1 ? 'msg-player1' : 'msg-player2');
          const avatar = document.createElement('div');
          avatar.className = 'avatar';
          avatar.textContent = 'P' + player;
          const stack = document.createElement('div');
          stack.appendChild(bubble);
          wrap.appendChild(avatar);
          wrap.appendChild(stack);
        }
      
        messagesEl.appendChild(wrap);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
      
      // função para re-traduzir as bolhas já existentes
      function refreshChatBubbles() {
        if (!messagesEl) return;
        const bubbles = messagesEl.querySelectorAll('.bubble[data-i18n-key]');
        bubbles.forEach(b => {
          const key = b.dataset.i18nKey;
          let params = {};
          if (b.dataset.i18nParams) {
            try { params = JSON.parse(b.dataset.i18nParams); } catch {}
          }
          b.textContent = t(key, params);
        });
      }
      
      // expõe para o languageScript chamar após setLang
      window.__refreshChat = refreshChatBubbles;

    // UI listeners
    if (nextTurnBtn) nextTurnBtn.addEventListener('click', nextTurn);
    if (widthSelect) widthSelect.addEventListener('change', () => renderBoard(parseInt(widthSelect.value, 10)));
    if (toggleMuteBtn) toggleMuteBtn.addEventListener('click', (e) => {
        // soundOn é opcional no teu projeto; ignora se não existir
        window.soundOn = !window.soundOn;
        e.target.textContent = window.soundOn ? 'Som: ligado' : 'Som: desligado';
    });
    if (authForm) authForm.addEventListener('submit', (ev) => ev.preventDefault());

    // Start Game
    if (playButton) playButton.addEventListener('click', () => {
        // bloqueio: só começa com config válida
        if (!isConfigValid()) {
            showMessage({ who: 'system', key: 'select_mode'});
            updatePlayButtonState();
            return;
        }

        const modeVal = modeSelect.value;
        const diffSel = (modeVal === 'ia') ? iaLevelSelect.value : 'normal';
        const humanFirst = firstToPlayCheckbox ? !!firstToPlayCheckbox.checked : true;

        gameMode = modeVal;
        vsAI = (modeVal === 'ia');
        aiDifficulty = diffSel;

        currentPlayer = humanFirst ? 1 : 2;
        currentPlayerEl.textContent = currentPlayer;

        if (vsAI) {
            humanPlayerNum = humanFirst ? 1 : 2;
            aiPlayerNum = humanFirst ? 2 : 1;
        } else {
            humanPlayerNum = 1;
            aiPlayerNum = null;
        }

        showMessage({ who: 'system', key: 'msg_game_started'});
        gameActive = true;

        if (nextTurnBtn) nextTurnBtn.disabled = true;
        if (throwBtn) throwBtn.disabled = (vsAI && currentPlayer === aiPlayerNum) ? true : false;

        // se IA começa, dispara o turno dela
        if (vsAI && currentPlayer === aiPlayerNum) {
            setTimeout(() => runAiTurnLoop().catch(err => console.warn('Erro no turno inicial da IA:', err)), 250);
        }
    });

    // botão de dados
    if (throwBtn) {
        throwBtn.addEventListener('click', async (e) => {
            // bloquear no turno da IA
            if (vsAI && currentPlayer === aiPlayerNum) {
                e.preventDefault();
                return;
            }
            if (!gameActive) return;

            try {
                const result = await window.tabGame.spawnAndLaunch();
                showMessage({ who: 'player', player: currentPlayer, key: 'msg_dice_thrown', params:{value: result}});

                if (hasValidMove()) {
                    nextTurnBtn.disabled = true;
                    throwBtn.disabled = true;

                    if (result === 4 || result === 6 || result === 1) {
                        showMessage({ who: 'system', key: 'msg_dice_thrown_double', params:{value: result}});
                    }
                    return;
                }

                if (result === 4 || result === 6 || result === 1) {
                    showMessage({ who: 'system', key: 'msg_dice_thrown_double', params:{value: result}});
                    throwBtn.disabled = false;
                    nextTurnBtn.disabled = true;
                } else {
                    throwBtn.disabled = true;
                    nextTurnBtn.disabled = false;
                }
            } catch (err) {
                console.warn('Erro ao lançar dados:', err);
            }
        });
    }

    // há jogada válida?
    function hasValidMove(player = currentPlayer, diceValue = lastDiceValue) {
        if (diceValue == null) return false;

        const playerClass = player === 1 ? 'red' : 'yellow';
        const ownPieces = Array.from(gameBoard.querySelectorAll('.piece.' + playerClass));

        for (const piece of ownPieces) {
            const state = piece.getAttribute('move-state');
            if (state === 'not-moved' && diceValue !== 1) continue;

            const possible = getValidMoves(piece, diceValue);
            if (!possible || possible.length === 0) continue;

            for (const dest of possible) {
                const occupant = dest.querySelector('.piece');
                if (!occupant) return true;
                if (!occupant.classList.contains(playerClass)) return true;
            }
        }
        return false;
    }
    // helper: enumerar todas as jogadas legais no DOM para um jogador e dado
    function enumerateLegalMovesDOM(playerNum, diceValue) {
        const color = getColorForPlayerNum(playerNum);
        const moves = [];
        const pieces = Array.from(gameBoard.querySelectorAll('.piece.' + color));

        for (const piece of pieces) {
            const state = piece.getAttribute('move-state');
            if (state === 'not-moved' && diceValue !== 1) continue;

            const fromCell = piece.parentElement;
            const fromR = parseInt(fromCell.dataset.r, 10);
            const fromC = parseInt(fromCell.dataset.c, 10);

            const valids = getValidMoves(piece, diceValue); // células DOM
            for (const dest of valids) {
                const occ = dest.querySelector('.piece');
                if (occ && occ.classList.contains(color)) continue; // bloqueado por peça própria
                const toR = parseInt(dest.dataset.r, 10);
                const toC = parseInt(dest.dataset.c, 10);
                moves.push({ piece, from: { r: fromR, c: fromC }, destCell: dest, to: { r: toR, c: toC } });
            }
        }
        return moves;
    }

    // =============== TURNO DA IA ===============
    async function runAiTurnLoop() {
        if (!vsAI || !gameActive || currentPlayer !== aiPlayerNum) return;

        // bloquear UI do jogador durante a IA
        if (throwBtn) throwBtn.disabled = true;
        if (nextTurnBtn) nextTurnBtn.disabled = true;

        const aiColor = getColorForPlayerNum(aiPlayerNum);
        const difficulty = aiDifficulty || 'normal';

        while (gameActive && currentPlayer === aiPlayerNum) {
            let result;
            try {
                result = await window.tabGame.spawnAndLaunch();
            } catch (err) {
                console.warn('Falha ao lançar dados para IA:', err);
                break;
            }

            // estabilizar o valor do dado
            lastDiceValue = result;

            showMessage({ who: 'player', player: currentPlayer,  key: 'msg_ai_dice', params:{value: result}});

            // fonte de verdade: jogadas legais no DOM (mesmas regras do humano)
            const domMoves = enumerateLegalMovesDOM(aiPlayerNum, result);

            if (domMoves.length === 0) {
                // sem jogada possível
                if (result === 1 || result === 4 || result === 6) {
                    showMessage({ who: 'player', player: currentPlayer, key: 'msg_ai_no_moves_extra'});
                    lastDiceValue = null;
                    continue; // IA volta a lançar
                } else {
                    showMessage({ who: 'player', player: currentPlayer, key: 'msg_ai_no_moves_pass'});
                    lastDiceValue = null;
                    nextTurn();
                    break;
                }
            }

            // tentar usar a jogada do motor (ai.js); se falhar, usar fallback do DOM
            let chosenMove = null;

            try {
                if (window.TAB_AI && typeof window.TAB_AI.getAIMove === 'function') {
                    const choice = window.TAB_AI.getAIMove(result, aiColor, difficulty);
                    if (choice && choice.from && choice.to) {
                        const fromCell = gameBoard.querySelector(`.cell[data-r="${choice.from.r}"][data-c="${choice.from.c}"]`);
                        const destCell = gameBoard.querySelector(`.cell[data-r="${choice.to.r}"][data-c="${choice.to.c}"]`);
                        const piece = fromCell ? fromCell.querySelector(`.piece.${aiColor}`) : null;

                        if (fromCell && destCell && piece) {
                            // validar com as mesmas regras do humano
                            const legalCells = getValidMoves(piece, result);
                            const isInLegalList = legalCells.some(cell => cell === destCell);
                            const occ = destCell.querySelector('.piece');
                            const blockedByOwn = occ && occ.classList.contains(aiColor);

                            if (isInLegalList && !blockedByOwn) {
                                chosenMove = { piece, from: choice.from, destCell, to: choice.to };
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('Erro ao obter jogada da IA:', e);
            }

            if (!chosenMove) {
                // Fallback: escolher uma jogada válida do DOM (preferir captura)
                const captureMoves = domMoves.filter(m => {
                    const occ = m.destCell.querySelector('.piece');
                    return occ && !occ.classList.contains(aiColor);
                });
                chosenMove = captureMoves[0] || domMoves[0];
                // nota: chosenMove contém { piece, from, destCell, to }
                if (!chosenMove) {
                    // extremamente improvável, mas protege
                    console.warn('Sem fallback de jogada, embora domMoves > 0 — a passar a vez.');
                    if (result === 1 || result === 4 || result === 6) {
                        showMessage({ who: 'player', player: currentPlayer, key: 'msg_ai_no_moves_extra'});
                        lastDiceValue = null;
                        continue;
                    } else {
                        showMessage({ who: 'player', player: currentPlayer, key: 'msg_ai_no_moves_pass'});
                        lastDiceValue = null;
                        nextTurn();
                        break;
                    }
                }
            }

            // Executar a jogada escolhida (IA ou fallback)
            const piece = chosenMove.piece;
            const destCell = chosenMove.destCell;

            // se estava "not-moved" e saiu 1, converter para "moved"
            const state = piece.getAttribute('move-state');
            if (state === 'not-moved' && result === 1) {
                piece.setAttribute('move-state', 'moved');
            }

            // efeito visual opcional (comentado; podes ativar se quiseres feedback)
            // piece.classList.add('selected');
            // destCell.classList.add('green-glow');
            // setTimeout(() => { piece.classList.remove('selected'); destCell.classList.remove('green-glow'); }, 500);

            movePieceTo(piece, destCell);

            if (checkWinCondition()) return;

            // regra dos lançamentos extra
            if (result === 1 || result === 4 || result === 6) {
                showMessage({ who: 'player', player: currentPlayer, key:'msg_ai_extra_roll' });
                lastDiceValue = null;
                continue; // IA volta a lançar
            } else {
                lastDiceValue = null;
                nextTurn(); // passa para o jogador
                break;
            }
        }
    }

    // ======= Dados (sticks) =======
    const upCountProbs = [0.06, 0.25, 0.38, 0.25, 0.06];
    const namesMap = { 0: "Sitteh", 1: "Tâb", 2: "Itneyn", 3: "Teláteh", 4: "Arba'ah" };

    function sampleFromDistribution(probs) {
        const r = Math.random();
        let c = 0;
        for (let i = 0; i < probs.length; i++) {
            c += probs[i];
            if (r <= c) return i;
        }
        return probs.length - 1;
    }

    window.tabGame = window.tabGame || {};
    window.tabGame._resolveResult = null;

    function createDicePouch(autoDrop = false) {
        const prev = document.body.querySelector('.dice-overlay');
        if (prev) prev.remove();

        const overlay = document.createElement('div');
        overlay.className = 'dice-overlay';

        const arena = document.createElement('div');
        arena.className = 'dice-arena';
        overlay.appendChild(arena);

        const hint = document.createElement('div');
        hint.style.position = 'absolute';
        hint.style.bottom = '12px';
        hint.style.left = '14px';
        hint.style.fontSize = '13px';
        hint.style.color = '#333';
        hint.style.opacity = '0.8';
        hint.dataset.i18nKey = 'dice_auto_hint';
        hint.textContent = t('dice_auto_hint');
        arena.appendChild(hint);

        const pouch = document.createElement('div');
        pouch.className = 'dice-pouch';
        arena.appendChild(pouch);

        for (let i = 0; i < 4; i++) {
            const s = document.createElement('div');
            s.className = 'dice-stick initial';
            s.dataset.index = i;
            s.style.left = "50%";
            s.style.top = "50%";
            const randZ = (Math.random() * 8 - 4);
            s.style.transform = `translate(-50%,-50%) rotateX(-90deg) rotateZ(${randZ}deg)`;
            s.style.transformOrigin = '50% 85%';

            const faceUp = document.createElement('div');
            faceUp.className = 'face dice-face-up';
            faceUp.dataset.i18nKey = 'dice_face_up';
            faceUp.textContent = t('dice_face_up');
            const faceDown = document.createElement('div');
            faceDown.className = 'face dice-face-down';
            faceDown.dataset.i18nKey = 'dice_face_down';
            faceDown.textContent = t('dice_face_down');
            s.appendChild(faceUp);
            s.appendChild(faceDown);
            pouch.appendChild(s);
        }

        document.body.appendChild(overlay);

        if (throwBtn) throwBtn.disabled = true;
        if (autoDrop) setTimeout(() => dropDiceSticks(pouch, arena, overlay), 120);
    }

    function dropDiceSticks(pouch, arena, overlay) {
        const sticks = Array.from(pouch.querySelectorAll('.dice-stick'));

        const chosenUpCount = sampleFromDistribution(upCountProbs);

        const indices = [0, 1, 2, 3];
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const results = new Array(4).fill(false);
        for (let k = 0; k < chosenUpCount; k++) results[indices[k]] = true;

        const maxWide = Math.min(window.innerWidth, 900);
        const gapPx = Math.max(54, Math.round(maxWide * 0.08));
        sticks.forEach((s, i) => {
            s.classList.remove('initial');
            void s.offsetWidth;
            s.classList.add('fallen');

            const posIndex = i - 1.5;
            const offsetX = Math.round(posIndex * gapPx);
            const offsetY = Math.round(6 + (Math.random() * 6 - 3));

            const isUp = results[i];
            const rotX = isUp ? 0 : 180;
            const rotZ = (Math.random() * 6 - 3);

            s.style.left = `calc(50% + ${offsetX}px)`;
            s.style.top = `calc(50% + ${offsetY}px)`;
            s.style.transform = `translate(-50%,-50%) rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
            s.style.transitionDelay = `${i * 80}ms`;
        });

        const totalAnim = 700 + (sticks.length - 1) * 80;
        setTimeout(() => {
            const actualUp = results.reduce((a, b) => a + (b ? 1 : 0), 0);
            const gameValue = (actualUp === 0) ? 6 : actualUp;

            lastDiceValue = gameValue;
            showDiceResult(gameValue, actualUp, overlay);

            if (window.tabGame && typeof window.tabGame._resolveResult === 'function') {
                try {
                    window.tabGame._resolveResult(gameValue);
                } catch (e) {
                    console.warn('resolve falhou', e);
                }
                window.tabGame._resolveResult = null;
            }
        }, totalAnim + 40);
    }

    function showDiceResult(gameValue, upCount, overlay) {
        const prevBubble = overlay.querySelector('.dice-result-bubble');
        if (prevBubble) prevBubble.remove();

        const bubble = document.createElement('div');
        bubble.className = 'dice-result-bubble';

        const big = document.createElement('div'); big.className = 'big';
        big.textContent = String(gameValue);
        const label = document.createElement('div'); label.className = 'label';
        label.dataset.i18nKey = 'dice_label';
        label.dataset.diceUp = String(upCount);
        const diceName = t(`dice_name_${upCount}`);
        label.dataset.i18nParams = JSON.stringify({ name: diceName, up: upCount });
        label.textContent = t('dice_label', { name: diceName, up: upCount });

        const countdown = document.createElement('div');
        countdown.className = 'dice-countdown';
        let secs = 2;
        countdown.dataset.i18nKey = 'dice_countdown';
        countdown.dataset.secs = String(secs);
        countdown.textContent = t('dice_countdown', { secs });

        bubble.appendChild(big);
        bubble.appendChild(label);
        bubble.appendChild(countdown);

        overlay.appendChild(bubble);
        setTimeout(() => bubble.classList.add('show'), 20);

        const intervalId = setInterval(() => {
            secs -= 1;
            if (secs > 0) {
                countdown.dataset.i18nKey = 'dice_countdown';
                countdown.dataset.secs = String(secs);
                countdown.textContent = t('dice_countdown', { secs });
            } else {
                countdown.dataset.i18nKey = 'dice_closing';
                delete countdown.dataset.secs;
                countdown.textContent = t('dice_closing');
                clearInterval(intervalId);
            }
        }, 1000);
        overlay._countdownInterval = intervalId;

        overlay._autoCloseTimer = setTimeout(() => {
            if (overlay._countdownInterval) {
                clearInterval(overlay._countdownInterval);
                overlay._countdownInterval = null;
            }
            const ov = document.body.querySelector('.dice-overlay');
            if (ov) ov.remove();
        }, 3000);
    }
    function refreshDiceOverlay() {
        const ov = document.body.querySelector('.dice-overlay');
        if (!ov) return;
      
        // Re-traduz tudo que tem data-i18n-key
        ov.querySelectorAll('[data-i18n-key]').forEach(el => {
          const key = el.dataset.i18nKey;
          let params = {};
      
          // label: recompõe o nome pelo up guardado
          if (key === 'dice_label') {
            const up = parseInt(el.dataset.diceUp || '0', 10);
            const name = t(`dice_name_${up}`);
            params = { name, up };
            el.dataset.i18nParams = JSON.stringify(params);
            el.textContent = t(key, params);
            return;
          }
      
          // countdown: reaplica com os segundos atuais, se existirem
          if (key === 'dice_countdown' && el.dataset.secs) {
            params = { secs: parseInt(el.dataset.secs, 10) };
            el.textContent = t(key, params);
            return;
          }
      
          // demais: sem params
          el.textContent = t(key, params);
        });
      }
      
      // expõe para o languageScript chamar
      window.__refreshDice = refreshDiceOverlay;

    // substitui a função inteira
    window.tabGame.spawnAndLaunch = function () {
        return new Promise((resolve) => {
            // Fechar overlay anterior se existir, limpando timers para evitar leaks
            const prev = document.body.querySelector('.dice-overlay');
            if (prev) {
                try {
                    if (prev._countdownInterval) {
                        clearInterval(prev._countdownInterval);
                        prev._countdownInterval = null;
                    }
                    if (prev._autoCloseTimer) {
                        clearTimeout(prev._autoCloseTimer);
                        prev._autoCloseTimer = null;
                    }
                } catch (e) {
                    console.warn('Falha a limpar timers do overlay anterior:', e);
                }
                prev.remove();
            }

            // Guardar o resolver e criar novo overlay + lançamento
            window.tabGame._resolveResult = resolve;
            createDicePouch(true);
        });
    };
    window.tabGame.getLastValue = () => lastDiceValue;

    // --- inicialização ---
    const initialCols = widthSelect ? parseInt(widthSelect.value, 10) : 9;
    renderBoard(initialCols);
    showMessage({ who: 'system', key: 'select_mode'});

    if (nextTurnBtn) nextTurnBtn.disabled = true;
    if (throwBtn) throwBtn.disabled = true;

    // avisos debug
    if (!widthSelect) console.warn('widthSelect not found');
    if (!gameBoard) console.warn('gameBoard not found');
    if (!messagesEl) console.warn('messagesEl not found');

    function t(key, params = {}) {
        const lang = window.currentLang || 'pt';
        // tenta ler primeiro da variável global i18n; se não existir, usa window.i18n
        const root = (typeof i18n !== 'undefined' ? i18n : window.i18n) || {};
        const dict = root[lang] || {};
        // fallback para en depois pt; e por fim mostra a própria key (útil para debug)
        let str = dict[key] ?? root.en?.[key] ?? root.pt?.[key] ?? key;
        return String(str).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
      }
});