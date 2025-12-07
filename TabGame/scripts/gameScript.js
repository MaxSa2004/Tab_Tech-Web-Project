document.addEventListener("DOMContentLoaded", () => {
    const widthSelect = document.getElementById('width');
    const gameBoard = document.getElementById('gameBoard');
    const messagesEl = document.getElementById('messages');
    const currentPlayerEl = document.getElementById('currentPlayer');
    const nextTurnBtn = document.getElementById('nextTurn');
    const throwBtn = document.getElementById('throwDiceBtn');
    const playButton = document.getElementById('playButton');
    const authForm = document.querySelector('.authForm');
    const capturedP1 = document.getElementById('capturedP1');
    const capturedP2 = document.getElementById('capturedP2');
    const leaveButton = document.getElementById('leaveButton');

    const modeSelect = document.getElementById('game_mode');
    const iaLevelSelect = document.getElementById('ia_lvl');
    const firstToPlayCheckbox = document.getElementById('first_to_play');

    const rows = 4; // fixed rows

    // state
    let currentPlayer = 1; // 1 = initial, 2 = other (server-relative)
    let gameActive = false;

    // AI state and mode
    let gameMode = 'player'; // 'player' | 'ia'
    let vsAI = false;
    let vsPlayer = false;
    let aiDifficulty = 'normal';
    let aiPlayerNum = null; // 1 or 2
    let humanPlayerNum = 1; // 1 or 2 (our perspective)
    let waitingForPair = false;

    let currentServerStep = null;
    let serverDiceValue = null;
    let serverTurnNick = null;
    let serverMustPass = false;

    // pieces
    let redPieces = 0;
    let yellowPieces = 0;
    let selectedPiece = null;

    // dice
    let lastDiceValue = null;

    // SSE helpers
    let _sseInitialTimer = null;
    let _mappingValidatedForGame = false;

    // Quick debug helper
    window.__dbgState = function () {
        return {
            humanPlayerNum, currentPlayer, gameActive, vsAI, vsPlayer, aiPlayerNum, waitingForPair,
            throwBtnDisabled: throwBtn ? throwBtn.disabled : null,
            nextTurnBtnDisabled: nextTurnBtn ? nextTurnBtn.disabled : null,
            tt_nick: sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick'),
            tt_game: sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game'),
            eventSourceReadyState: window.updateEventSource ? window.updateEventSource.readyState : null,
            mappingValidated: _mappingValidatedForGame
        };
    };

    function getColorForPlayerNum(n) { return n === 1 ? 'red' : 'yellow'; }
    function isHumanTurn() { return currentPlayer === humanPlayerNum; }

    function getInitialNick() {
        return sessionStorage.getItem('tt_initial') || localStorage.getItem('tt_initial') || null;
    }

    function isConfigValid() {
        const modeVal = modeSelect ? modeSelect.value : '';
        if (modeVal !== 'player' && modeVal !== 'ia') return false;
        if (modeVal === 'ia') {
            const diff = iaLevelSelect ? iaLevelSelect.value : '';
            if (!['easy', 'normal', 'hard'].includes(diff)) return false;
        }
        return true;
    }

    function setConfigEnabled(enabled) {
        if (widthSelect) widthSelect.disabled = !enabled;
        if (modeSelect) modeSelect.disabled = !enabled;
        if (iaLevelSelect) iaLevelSelect.disabled = !enabled;
        if (firstToPlayCheckbox) firstToPlayCheckbox.disabled = !enabled;
        if (modeSelect && modeSelect.value === 'player') {
            if (iaLevelSelect) iaLevelSelect.disabled = true;
            if (firstToPlayCheckbox) firstToPlayCheckbox.disabled = true;
        }
    }

    // ----------------------
    // Board mapping utilities
    // server convention: index 0 = bottom-right of the initial player.
    // rows = fixed (4), cols = widthSelect.value
    // ----------------------
    function serverIndexToLocalRC(serverIndex, cols, rowsCount, amIInitial) {
        const rowFromBottom = Math.floor(serverIndex / cols);
        const colFromRight = serverIndex % cols;
        const r_initial = (rowsCount - 1) - rowFromBottom;
        const c_initial = (cols - 1) - colFromRight;
        if (amIInitial) {
            return { r: r_initial, c: c_initial };
        } else {
            return { r: rowsCount - 1 - r_initial, c: cols - 1 - c_initial };
        }
    }

    function localRCToServerIndex(r, c, cols, rowsCount, amIInitial) {
        let r_initial = r;
        let c_initial = c;
        if (!amIInitial) {
            r_initial = rowsCount - 1 - r;
            c_initial = cols - 1 - c;
        }
        const rowFromBottom = (rowsCount - 1) - r_initial;
        const colFromRight = (cols - 1) - c_initial;
        return rowFromBottom * cols + colFromRight;
    }

    function validateMapping(cols, rowsCount, amIInitial) {
        for (let idx = 0; idx < cols * rowsCount; idx++) {
            const { r, c } = serverIndexToLocalRC(idx, cols, rowsCount, amIInitial);
            const back = localRCToServerIndex(r, c, cols, rowsCount, amIInitial);
            if (back !== idx) {
                console.error('Mapping mismatch', { idx, r, c, back, cols, rowsCount, amIInitial });
                return false;
            }
        }
        return true;
    }

    // ----------------------
    // CORREÇÃO 1: RENDERIZAÇÃO COM INDEX NO DATASET
    // ----------------------
    function renderPvPBoard(serverPieces, serverSelectedIndices) {
        if (!Array.isArray(serverPieces) || serverPieces.length === 0) return;
    
        // 1. AUTO-DETECÇÃO DE COLUNAS
        // O tabuleiro tem sempre 4 linhas. Logo, Cols = TotalPeças / 4.
        const calculatedCols = Math.ceil(serverPieces.length / 4);
        
        // Atualizar visualmente se for diferente
        if (widthSelect && widthSelect.value != calculatedCols) {
            widthSelect.value = calculatedCols;
        }
        const cols = calculatedCols;
        
        gameBoard.innerHTML = '';
        gameBoard.style.setProperty('--cols', cols);
    
        const myNick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
        const initialNick = getInitialNick();
        const amIInitial = Boolean(initialNick && myNick === initialNick);
    
        // 2. CONSTRUÇÃO DA GRELHA
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                
                // Usar sempre a 'calculatedCols' para a matemática
                const serverIndex = localRCToServerIndex(r, c, cols, rows, amIInitial);
                
                cell.dataset.serverIndex = serverIndex;
                cell.dataset.r = r;
                cell.dataset.c = c;
                
                // Debug opcional: descomente para ver os números nas casas
                // cell.innerText = serverIndex; 
                // cell.style.fontSize = "10px"; cell.style.color = "#ccc";
    
                const arrow = document.createElement('i');
                if (r === 0) arrow.className = 'arrow ' + (c === 0 ? 'down' : 'left');
                else if (r === 1) arrow.className = 'arrow ' + (c === cols - 1 ? 'up down' : 'right');
                else if (r === 2) arrow.className = 'arrow ' + (c === 0 ? 'up' : 'left');
                else if (r === 3) arrow.className = 'arrow ' + (c === cols - 1 ? 'up' : 'right');
                cell.appendChild(arrow);
    
                cell.addEventListener('click', () => handleCellClick(cell));
                gameBoard.appendChild(cell);
            }
        }
    
        // 3. COLOCAÇÃO DE PEÇAS (Usando índice direto)
        for (let si = 0; si < serverPieces.length; si++) {
            const pieceData = serverPieces[si];
            if (!pieceData) continue;
    
            const cell = gameBoard.querySelector(`.cell[data-server-index="${si}"]`);
            if (!cell) continue;
    
            const piece = document.createElement('div');
            piece.className = 'piece';
            if (pieceData.color === 'Red') piece.classList.add('red');
            else if (pieceData.color === 'Blue') piece.classList.add('yellow');
    
            if (pieceData.moveState) piece.setAttribute('move-state', pieceData.moveState);
            else piece.setAttribute('move-state', 'not-moved');
    
            cell.appendChild(piece);
        }
    
        // 4. HIGHLIGHTS
        if (Array.isArray(serverSelectedIndices)) {
            serverSelectedIndices.forEach(si => {
                const cell = gameBoard.querySelector(`.cell[data-server-index="${si}"]`);
                if (cell) {
                    cell.classList.add('server-selected');
                    cell.classList.add('green-glow');
                }
            });
        }
    
        redPieces = serverPieces.filter(p => p && p.color === 'Red').length;
        yellowPieces = serverPieces.filter(p => p && p.color === 'Blue').length;
    }

    // ----------------------
    // CORREÇÃO 2: CLIQUE DIRETO (SEM MATEMÁTICA)
    // ----------------------
    async function handleCellClick(cell) {
        if (!gameActive) return;
    
        // --- MODO PvP ---
        if (vsPlayer) {
            const indexStr = cell.dataset.serverIndex;
            if (indexStr === undefined || indexStr === null) return;
            
            const cellIndex = parseInt(indexStr, 10);
            const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
            const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
            const game = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game');
    
            console.log(`[UI] Clicou na célula Visual (r:${cell.dataset.r}, c:${cell.dataset.c}) -> Server Index: ${cellIndex}`);
    
            try {
                await Network.notify({ nick, password, game, cell: cellIndex });
            } catch (e) {
                console.warn('Erro na jogada:', e);
                // Se der erro 400, força um refresh visual para garantir que não estamos desincronizados
                showMessage({ who: 'system', text: 'Jogada inválida ou fora de turno.' });
            }
            return;
        }
    
        // --- MODO PvE (Mantido igual) ---
        const pieceInCell = cell.querySelector('.piece');
        if (pieceInCell && ((currentPlayer == 1 && pieceInCell.classList.contains('red')) ||
            (currentPlayer == 2 && pieceInCell.classList.contains('yellow')))) {
    
            selectPiece(pieceInCell);
            if (!selectedPiece) return;
            clearHighlights();
            const state = pieceInCell.getAttribute('move-state');
            const roll = parseInt(lastDiceValue, 10);
            const movesAllowed = (state === 'not-moved' && roll !== 1) ? [] : getValidMoves(pieceInCell);
            movesAllowed.forEach(dest => dest.classList.add('green-glow'));
            return;
        }
    
        if (selectedPiece && lastDiceValue != null) {
            const state = selectedPiece.getAttribute('move-state');
            const currentRoll = parseInt(lastDiceValue, 10);
            if (state === 'not-moved' && currentRoll !== 1) return;
    
            const possibleMoves = getValidMoves(selectedPiece);
            const isValidMove = possibleMoves.some(dest => dest === cell);
    
            if (isValidMove) {
                try {
                    if (state === 'not-moved' && currentRoll === 1) selectedPiece.setAttribute('move-state', 'moved');
                    movePieceTo(selectedPiece, cell);
                    clearHighlights();
                    selectedPiece.classList.remove('selected');
                    selectedPiece = null;
                    if (checkWinCondition()) return;
                } finally {
                    lastDiceValue = null;
                    if (currentRoll === 4 || currentRoll === 6 || currentRoll === 1) {
                        if (throwBtn) throwBtn.disabled = false;
                        if (nextTurnBtn) nextTurnBtn.disabled = true;
                        showMessage({ who: 'system', key: 'msg_dice_thrown_double', params: { value: currentRoll } });
                    } else {
                        nextTurn();
                    }
                }
            }
        }
    }

    // ----------------------
    // CORREÇÃO 3: ATUALIZAÇÃO ROBUSTA (DADO/TURNO)
    // ----------------------
    function handleUpdateMessage(event) {
        let data;
        try { data = JSON.parse(event.data); } catch (e) { return; }
    
        const prev = window.__lastSSE || {};
        const merged = Object.assign({}, prev, data);
        if (!data.hasOwnProperty('pieces')) merged.pieces = prev.pieces;
        if (!data.hasOwnProperty('players')) merged.players = prev.players;
        if (!data.hasOwnProperty('turn')) merged.turn = prev.turn;
        window.__lastSSE = merged;
    
        const myNick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
        if (merged.initial) sessionStorage.setItem('tt_initial', merged.initial);
        const initialNick = getInitialNick();
    
        if (waitingForPair && (merged.pieces || merged.turn)) {
            waitingForPair = false;
            gameActive = true;
            showMessage({ who: 'system', key: 'msg_game_started' });
            updatePlayButtonState();
            if (leaveButton) leaveButton.disabled = false;
        }
    
        const isMyTurn = (merged.turn === myNick);
        currentPlayerEl.textContent = isMyTurn ? "VOCÊ" : merged.turn;
        
        if (initialNick) {
            currentPlayer = (merged.turn === initialNick) ? 1 : 2;
            humanPlayerNum = (myNick === initialNick) ? 1 : 2;
        }
    
        // ATUALIZAR TABULEIRO
        if (Array.isArray(merged.pieces)) {
            renderPvPBoard(merged.pieces, merged.selected || []);
        }
    
        if (merged.winner) {
            gameActive = false;
            showMessage({ who: 'system', text: `Vencedor: ${merged.winner}` });
            endGame();
            return;
        }
    
        // LÓGICA DO DADO
        let diceValue = null;
        if (merged.dice !== null && merged.dice !== undefined) {
             diceValue = (typeof merged.dice === 'object') ? merged.dice.value : merged.dice;
        }
    
        // Reset base
        if (throwBtn) throwBtn.disabled = true;
        if (nextTurnBtn) nextTurnBtn.disabled = true;
    
        if (isMyTurn && gameActive) {
            // Se NÃO há dado, ativar botão
            if (diceValue === null || diceValue === undefined) {
                if (throwBtn) {
                    throwBtn.disabled = false;
                    throwBtn.classList.remove('disabled');
                }
                if (serverTurnNick !== merged.turn) showMessage({ who: 'system', key: 'msg_dice' });
            } 
            // Se HÁ dado
            else {
                lastDiceValue = diceValue;
                
                // Só toca animação/som se o valor for diferente do que já mostrámos
                // ou se o servidor mandou explicitamente um evento novo (ex: jogou duplo e repetiu o valor)
                if (serverDiceValue !== diceValue) {
                    serverDiceValue = diceValue;
                    try { window.tabGame.showRemoteRoll(diceValue); } catch (e) { }
                    showMessage({ who: 'system', text: `Dado: ${diceValue}` });
                }
    
                if (merged.mustPass && nextTurnBtn) nextTurnBtn.disabled = false;
                
                // Lógica de "keepPlaying" se existir no seu servidor
                if (merged.dice && merged.dice.keepPlaying && throwBtn) {
                     // Se o servidor pedir explicitamente para manter jogada (raro no Tâb standard sem mover)
                }
            }
        }
        
        serverTurnNick = merged.turn;
        if (merged.error) showMessage({ who: 'system', text: merged.error });
    }

    // ----------------------
    // Play/Leave control helpers
    // ----------------------
    function updatePlayButtonState() {
        if (!playButton) return;
        playButton.disabled = !isConfigValid() || gameActive || waitingForPair;
        if (leaveButton) leaveButton.disabled = !(gameActive || waitingForPair);
    }
    function setWaitingForPair(value) {
        waitingForPair = !!value;
        updatePlayButtonState();
    }

    function getLocalizedLabelsForPanels() {
        const lang = window.currentLang || 'pt';
        const dict = (typeof i18n !== 'undefined' ? i18n : window.i18n) || {};
        const L = dict[lang] || dict.en || {};
        const player1Label = L.player1 || (lang === 'pt' ? 'Jogador 1' : 'Player 1');
        const player2Label = (lang === 'pt' ? 'Jogador 2' : 'Player 2');
        const aiKey = (aiDifficulty === 'easy') ? 'easyIA' : (aiDifficulty === 'hard') ? 'hardIA' : 'normalIA';
        const aiLabel = L[aiKey] || (lang === 'pt' ? `IA (${aiDifficulty === 'easy' ? 'Fácil' : aiDifficulty === 'hard' ? 'Difícil' : 'Normal'})` : `AI (${aiDifficulty[0].toUpperCase()}${aiDifficulty.slice(1)})`);
        return { player1Label, player2Label, aiLabel };
    }

    function refreshCapturedTitles() {
        const elP1 = document.getElementById('capTitleP1');
        const elP2 = document.getElementById('capTitleP2');
        if (!elP1 || !elP2) return;
        const { player1Label, player2Label, aiLabel } = getLocalizedLabelsForPanels();
        if (vsAI) {
            if (aiPlayerNum === 1) {
                elP1.textContent = aiLabel;
                elP2.textContent = player1Label;
            } else {
                elP1.textContent = player1Label;
                elP2.textContent = aiLabel;
            }
        } else {
            elP1.textContent = player1Label;
            elP2.textContent = player2Label;
        }
    }
    window.__refreshCaptured = refreshCapturedTitles;

    // Leave game
    function leaveGame({ showStats = true, updateRank = true } = {}) {
        if (waitingForPair && !gameActive) {
            const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
            const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
            const gameId = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game');
            if (nick && password && gameId) {
                try { Network.leave({ nick, password, game: gameId }); } catch (e) { console.warn('leave failed', e); }
            }
            try { if (window.updateEventSource) { window.updateEventSource.close(); window.updateEventSource = null; } } catch (e) { }
            setWaitingForPair(false);
            showMessage({ who: 'system', key: 'msg_pairing_cancelled' });
            setConfigEnabled(true);
            renderBoard(parseInt(widthSelect.value, 10));
            return;
        }
        if (!gameActive) return;

        const lang = window.currentLang || 'pt';
        const dict = (typeof i18n !== 'undefined' ? i18n : window.i18n) || {};
        const L = dict[lang] || dict.en || {};
        const player1Label = L.player1 || (lang === 'pt' ? 'Jogador 1' : 'Player 1');
        const aiLabel = (() => {
            const key = aiDifficulty === 'easy' ? 'easyIA' : aiDifficulty === 'hard' ? 'hardIA' : 'normalIA';
            return L[key] || (lang === 'pt' ? `IA (${aiDifficulty === 'easy' ? 'Fácil' : aiDifficulty === 'hard' ? 'Difícil' : 'Normal'})` : `AI (${aiDifficulty[0].toUpperCase()}${aiDifficulty.slice(1)})`);
        })();

        let winnerNum = null;
        if (vsAI) {
            winnerNum = aiPlayerNum || 2;
        } else {
            winnerNum = currentPlayer === 1 ? 2 : 1;
        }

        if (showStats) { try { TabStats.setWinner(winnerNum); TabStats.showSummary(); } catch (e) { console.warn(e); } }
        if (showStats) showMessage({ who: 'system', key: 'msg_leave_game', params: { player: currentPlayer } });

        gameActive = false;
        currentPlayer = 1;
        selectedPiece = null;
        lastDiceValue = null;
        aiPlayerNum = null;
        humanPlayerNum = 1;
        vsAI = false;
        vsPlayer = false;

        refreshCapturedTitles();
        if (capturedP1) capturedP1.innerHTML = '';
        if (capturedP2) capturedP2.innerHTML = '';

        if (nextTurnBtn) nextTurnBtn.disabled = true;
        if (throwBtn) throwBtn.disabled = true;

        setConfigEnabled(true);
        if (playButton) playButton.disabled = !isConfigValid();
        if (leaveButton) leaveButton.disabled = true;

        renderBoard(parseInt(widthSelect.value, 10));
        updatePlayButtonState();
    }
    window.leaveGame = leaveGame;
    if (leaveButton) leaveButton.addEventListener('click', () => leaveGame({ showStats: true, updateRank: true }));

    if (modeSelect) modeSelect.addEventListener('change', () => { setConfigEnabled(true); updatePlayButtonState(); });
    if (iaLevelSelect) iaLevelSelect.addEventListener('change', updatePlayButtonState);
    updatePlayButtonState();

    // ----------------------
    // Rendering / local board (PvE fallback)
    // ----------------------
    function renderBoard(cols) {
        redPieces = cols;
        yellowPieces = cols;
        gameBoard.style.setProperty('--cols', cols);
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

                const piece = document.createElement('div');
                piece.setAttribute('move-state', 'not-moved');
                piece.classList.add('piece');

                if (r == 0) { piece.classList.add('yellow'); cell.appendChild(piece); }
                if (r == 3) { piece.classList.add('red'); cell.appendChild(piece); }

                cell.addEventListener('click', () => handleCellClick(cell));
                cell.appendChild(arrow);
                gameBoard.appendChild(cell);
            }
        }
    }

    // ----------------------
    // Selection / movement helpers (PvE preserved)
    // ----------------------
    function selectPiece(piece) {
        if (!gameActive) return;
        if (lastDiceValue == null) {
            showMessage({ who: 'system', text: t('msg_roll_first') || 'Lança o dado primeiro.' });
            return;
        }
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



    // ----------------------
    // Movement rules, captures, flipBoard, nextTurn, checkWin, etc.
    // (Kept unchanged from original — important PV E logic preserved)
    // ----------------------
    function getValidMoves(piece, diceValue = lastDiceValue) {
        if (!piece || diceValue == null) return [];
        const startCell = piece.parentElement;
        const cols = parseInt(gameBoard.style.getPropertyValue('--cols'), 10);

        const r = parseInt(startCell.dataset.r, 10);
        const c = parseInt(startCell.dataset.c, 10);
        const moveState = piece.getAttribute('move-state');
        const playerClass = piece.classList.contains('red') ? 'red' : 'yellow';

        const hasBasePieces = Array
            .from(gameBoard.querySelectorAll(`.piece.${playerClass}`))
            .some(p => parseInt(p.parentElement.dataset.r, 10) === 3);

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

                        currentCell = gameBoard.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
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

            currentCell = gameBoard.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
        }

        return currentCell ? [currentCell] : [];
    }

    function sendCapturedPieceToContainer(pieceEl, capturedByPlayer) {
        if (!pieceEl) return;
        const humanMadeCapture = capturedByPlayer === humanPlayerNum;
        const target = humanMadeCapture ? capturedP1 : capturedP2;
        if (!target) return;
        const isRed = pieceEl.classList.contains('red');
        const colorClass = isRed ? 'red' : 'yellow';
        const token = document.createElement('div');
        token.className = `captured-token ${colorClass}`;
        token.setAttribute('aria-label', colorClass === 'red' ? 'Captured red piece' : 'Captured yellow piece');
        target.appendChild(token);
        pieceEl.remove();
    }

    function movePieceTo(piece, destCell) {
        const existingPiece = destCell.querySelector('.piece');
        if (existingPiece) {
            const color = existingPiece.classList.contains('red') ? 'red' : 'yellow';
            TabStats.onCapture(currentPlayer, color);
            if (existingPiece.classList.contains('red')) {
                redPieces--;
                showMessage({ who: 'system', key: 'red_pieces', params: { count: redPieces } });
                sendCapturedPieceToContainer(existingPiece, currentPlayer);
            } else if (existingPiece.classList.contains('yellow')) {
                yellowPieces--;
                showMessage({ who: 'system', key: 'yellow_pieces', params: { count: yellowPieces } });
                sendCapturedPieceToContainer(existingPiece, currentPlayer);
            }
        }

        const destRow = parseInt(destCell.dataset.r, 10);
        const currentState = piece.getAttribute('move-state');
        if (destRow === 0 || currentState === 'row-four') {
            piece.setAttribute('move-state', 'row-four');
        }
        destCell.appendChild(piece);
        TabStats.onMove(currentPlayer);
    }

    function flipBoard() {
        lastDiceValue = null;

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

    function nextTurn() {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        currentPlayerEl.textContent = currentPlayer;
        TabStats.onTurnAdvance();
        showMessage({ who: 'system', key: 'msg_turn_of', params: { player: currentPlayer } });
        flipBoard();

        if (vsAI && currentPlayer === aiPlayerNum) {
            setTimeout(() => runAiTurnLoop().catch(err => console.warn('Erro no turno da IA:', err)), 200);
        } else {
            if (throwBtn && !throwBtn.disabled) {
                showMessage({ who: 'system', key: 'msg_dice' });
            }
        }
    }

    function checkWinCondition() {
        if (!gameActive) return false;
        if (redPieces === 0 && yellowPieces === 0) return false;

        let winnerNum = null;
        if (redPieces == 0) winnerNum = 1;
        else if (yellowPieces == 0) winnerNum = 2;
        else return false;

        showMessage({ who: 'system', key: 'msg_player_won', params: { player: winnerNum } });
        TabStats.setWinner(winnerNum);
        endGame();
        return true;
    }

    function endGame() {
        try { if (window.updateEventSource) { window.updateEventSource.close(); window.updateEventSource = null; } } catch (e) { console.warn(e); }
        TabStats.showSummary();
        currentPlayer = 1;
        gameActive = false;
        redPieces = 0;
        yellowPieces = 0;
        selectedPiece = null;
        vsAI = false;
        vsPlayer = false;
        aiPlayerNum = null;
        humanPlayerNum = 1;
        lastDiceValue = null;
        refreshCapturedTitles();
        if (capturedP1) capturedP1.innerHTML = '';
        if (capturedP2) capturedP2.innerHTML = '';
        renderBoard(parseInt(widthSelect.value, 10));
        if (nextTurnBtn) nextTurnBtn.disabled = true;
        if (throwBtn) throwBtn.disabled = true;
        setConfigEnabled(true);
        if (playButton) playButton.disabled = !isConfigValid();
        if (leaveButton) leaveButton.disabled = true;
        updatePlayButtonState();
    }

    // ----------------------
    // Messaging UI helper
    // ----------------------
    function showMessage({ who = 'system', player = null, text, key, params }) {
        const wrap = document.createElement('div');
        wrap.className = 'message';
        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        if (key) {
            bubble.dataset.i18nKey = key;
            if (params && Object.keys(params).length) bubble.dataset.i18nParams = JSON.stringify(params);
            bubble.textContent = t(key, params || {});
        } else {
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

    function refreshChatBubbles() {
        if (!messagesEl) return;
        const bubbles = messagesEl.querySelectorAll('.bubble[data-i18n-key]');
        bubbles.forEach(b => {
            const key = b.dataset.i18nKey;
            let params = {};
            if (b.dataset.i18nParams) {
                try { params = JSON.parse(b.dataset.i18nParams); } catch { }
            }
            b.textContent = t(key, params);
        });
    }
    window.__refreshChat = refreshChatBubbles;

    function clearMessages() { if (!messagesEl) return; messagesEl.innerHTML = ''; }
    window.clearMessages = clearMessages;

    // ----------------------
    // UI listeners (nextTurn, width, auth)
    // ----------------------
    if (nextTurnBtn) {
        nextTurnBtn.addEventListener('click', async () => {
            if (vsPlayer && currentPlayer === humanPlayerNum) {
                const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
                const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
                const game = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game');
                if (!nick || !password || !game) {
                    alert("Você precisa estar autenticado para jogar contra outro jogador.");
                    return;
                }
                try {
                    nextTurnBtn.disabled = true;
                    await Network.pass({ nick, password, game });
                } catch (err) {
                    console.warn('Erro ao passar o turno no modo PvP:', err);
                    alert('Erro ao passar o turno. Por favor, tente novamente.');
                    nextTurnBtn.disabled = false;
                }
                return;
            }
            TabStats.onPass(currentPlayer);
            nextTurn();
        });
    }
    if (widthSelect) widthSelect.addEventListener('change', () => renderBoard(parseInt(widthSelect.value, 10)));
    if (authForm) authForm.addEventListener('submit', (ev) => ev.preventDefault());

    // ----------------------
    // Start Game button handler (PvE preserved, PvP enhanced)
    // ----------------------
    if (playButton) playButton.addEventListener('click', async () => {
        if (!isConfigValid()) {
            showMessage({ who: 'system', key: 'select_mode' });
            updatePlayButtonState();
            return;
        }

        const modeVal = modeSelect.value;
        const diffSel = (modeVal === 'ia') ? iaLevelSelect.value : 'normal';
        const humanFirst = firstToPlayCheckbox ? !!firstToPlayCheckbox.checked : true;

        gameMode = modeVal;
        vsAI = (modeVal === 'ia');
        vsPlayer = (modeVal === 'player');
        aiDifficulty = diffSel;

        aiPlayerNum = vsAI ? (humanFirst ? 2 : 1) : null;
        humanPlayerNum = vsAI ? (humanFirst ? 1 : 2) : 1;
        refreshCapturedTitles();

        if (vsPlayer) {
            const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
            const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
            if (!nick || !password) {
                alert("Você precisa estar autenticado para jogar contra outro jogador.");
                return;
            }
            setWaitingForPair(true);
            playButton.disabled = true;
            showMessage({ who: 'system', key: 'msg_waiting_opponent' });
            const size = parseInt(widthSelect.value, 10);
            const group = 36;
            try {
                const joinResult = await Network.join({ group, nick, password, size });
                const gameId = joinResult.game;
                sessionStorage.setItem('tt_game', gameId);
                window.currentGameId = gameId;

                _mappingValidatedForGame = false; // reset for new game

                if (!window.updateEventSource) {
                    try {
                        window.updateEventSource = Network.createUpdateEventSource({ nick, game: gameId });

                        window.updateEventSource.onopen = () => {
                            console.debug('SSE open');
                            showMessage({ who: 'system', text: t('msg_connected') || 'Conectado ao servidor.' });
                        };
                        window.updateEventSource.onerror = (err) => {
                            console.warn('SSE error', err);
                            showMessage({ who: 'system', text: t('msg_sse_error') || 'Erro na ligação de atualizações.' });
                        };
                        window.updateEventSource.onmessage = handleUpdateMessage;

                        if (_sseInitialTimer) clearTimeout(_sseInitialTimer);
                        _sseInitialTimer = setTimeout(() => {
                            if (waitingForPair) {
                                showMessage({ who: 'system', text: t('msg_no_initial') || 'Aguardando estado inicial do servidor...' });
                            }
                        }, 8000);

                    } catch (e) {
                        console.warn('Erro ao criar EventSource para atualizações:', e);
                        showMessage({ who: 'system', text: t('msg_sse_create_failed') || 'Falha ao criar ligação de atualizações.' });
                    }
                }
            } catch (err) {
                console.warn('Erro ao entrar na partida PvP:', err);
                alert("Erro ao encontrar um oponente. Por favor, tente novamente mais tarde.");
                setWaitingForPair(false);
                updatePlayButtonState();
            }
            return;
        }

        if (vsAI) {
            currentPlayer = 1;
            currentPlayerEl.textContent = currentPlayer;
            TabStats.start({
                mode: gameMode,
                aiDifficulty: vsAI ? aiDifficulty : null,
                cols: parseInt(widthSelect.value, 10),
                firstPlayer: vsAI ? (humanFirst ? "Human" : "Ai") : null
            });
            TabStats.onTurnAdvance();
            showMessage({ who: 'system', key: 'msg_game_started' });

            gameActive = true;
            updatePlayButtonState();
            setConfigEnabled(false);

            if (nextTurnBtn) nextTurnBtn.disabled = true;
            if (throwBtn) throwBtn.disabled = (vsAI && aiPlayerNum === 1);
            if (playButton) playButton.disabled = true;
            if (leaveButton) leaveButton.disabled = false;
            if (isHumanTurn() && throwBtn && !throwBtn.disabled) {
                showMessage({ who: 'system', key: 'msg_dice' });
            }

            if (vsAI && 1 === aiPlayerNum) {
                setTimeout(() => runAiTurnLoop().catch(err => console.warn('Erro no turno inicial da IA:', err)), 250);
            }
        }
    });

    // ----------------------
    // Throw dice handler (PvP uses Network.roll)
    // ----------------------
    if (throwBtn) {
        throwBtn.addEventListener('click', async (e) => {
            const lang = window.currentLang || 'pt';
            console.debug('[UI] throwBtn clicked', {
                gameActive, vsAI, vsPlayer, currentPlayer, humanPlayerNum, throwBtnDisabled: throwBtn.disabled
            });

            if (vsAI && currentPlayer === aiPlayerNum) {
                console.debug('[UI] Ignoring throw: AI turn');
                if (e && e.preventDefault) e.preventDefault();
                return;
            }
            if (vsPlayer && currentPlayer !== humanPlayerNum) {
                console.debug('[UI] Ignoring throw: not our turn', { currentPlayer, humanPlayerNum });
                if (e && e.preventDefault) e.preventDefault();
                return;
            }
            if (!gameActive) {
                console.debug('[UI] Ignoring throw: gameActive=false');
                return;
            }

            if (vsPlayer && currentPlayer === humanPlayerNum) {
                const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
                const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
                const game = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game');
                if (!nick || password == null || game == null || game === '') {
                    alert((lang === 'pt' ? 'Você precisa estar autenticado para jogar contra outro jogador.' : 'You need to be authenticated to play against another player.'));
                    return;
                }
                try {
                    console.debug('[UI] Sending Network.roll', { nick, game });
                    throwBtn.disabled = true;
                    await Network.roll({ nick, password, game });
                    console.debug('[UI] Network.roll resolved');
                    showMessage({ who: 'system', key: 'msg_roll_sent' });
                } catch (err) {
                    console.warn('Erro ao enviar /roll:', err);
                    const msg = err && err.message ? err.message : (lang === 'pt' ? 'Erro ao enviar jogada para o servidor.' : 'Error sending move to server.');
                    alert((lang === 'pt' ? 'Erro ao enviar jogada para o servidor. Por favor, tente novamente mais tarde.' : 'Error sending move to server. Please try again later.'));
                    showMessage({ who: 'system', text: msg });
                    throwBtn.disabled = false;
                }
                return;
            }

            // PvE or fallback
            if (vsAI || vsPlayer) {
                try {
                    console.debug('[UI] Local dice (spawnAndLaunch) for player', currentPlayer);
                    const result = await window.tabGame.spawnAndLaunch();
                    processDiceResult(currentPlayer, result);
                } catch (err) {
                    console.warn('Erro ao lançar dados localmente:', err);
                }
            }
        });
    }

    // ----------------------
    // enumerateLegalMovesDOM, AI loop, dice mechanics, processDiceResult
    // (Kept intact from original implementation)
    // ----------------------
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
            const valids = getValidMoves(piece, diceValue);
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

    function countConvertiblePieces(playerNum) {
        const color = getColorForPlayerNum(playerNum);
        return Array.from(gameBoard.querySelectorAll('.piece.' + color))
            .filter(p => p.getAttribute('move-state') === 'not-moved').length;
    }

    async function runAiTurnLoop() {
        if (!vsAI || !gameActive || currentPlayer !== aiPlayerNum) return;
        if (throwBtn) throwBtn.disabled = true;
        if (nextTurnBtn) nextTurnBtn.disabled = true;
        const aiColor = getColorForPlayerNum(aiPlayerNum);
        const difficulty = aiDifficulty || 'normal';
        while (gameActive && currentPlayer === aiPlayerNum) {
            let result;
            try { result = await window.tabGame.spawnAndLaunch(); } catch (err) { console.warn('Falha ao lançar dados para IA:', err); break; }
            lastDiceValue = result;
            TabStats.onDice(currentPlayer, result);
            showMessage({ who: 'player', player: currentPlayer, key: 'msg_ai_dice', params: { value: result } });
            const domMoves = enumerateLegalMovesDOM(aiPlayerNum, result);
            if (domMoves.length === 0) {
                if (result === 1 || result === 4 || result === 6) {
                    showMessage({ who: 'system', key: 'msg_ai_no_moves_extra' });
                    TabStats.onExtraRoll(currentPlayer, result);
                    lastDiceValue = null;
                    continue;
                } else {
                    showMessage({ who: 'system', key: 'msg_ai_no_moves_pass' });
                    lastDiceValue = null;
                    TabStats.onPass(currentPlayer);
                    nextTurn();
                    break;
                }
            }
            let chosenMove = null;
            try {
                if (window.TAB_AI && typeof window.TAB_AI.getAIMove === 'function') {
                    const choice = window.TAB_AI.getAIMove(result, aiColor, difficulty);
                    if (choice && choice.from && choice.to) {
                        const fromCell = gameBoard.querySelector(`.cell[data-r="${choice.from.r}"][data-c="${choice.from.c}"]`);
                        const destCell = gameBoard.querySelector(`.cell[data-r="${choice.to.r}"][data-c="${choice.to.c}"]`);
                        const piece = fromCell ? fromCell.querySelector(`.piece.${aiColor}`) : null;
                        if (fromCell && destCell && piece) {
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
            } catch (e) { console.warn('Erro ao obter jogada da IA:', e); }

            if (!chosenMove) {
                const captureMoves = domMoves.filter(m => {
                    const occ = m.destCell.querySelector('.piece');
                    return occ && !occ.classList.contains(aiColor);
                });
                chosenMove = captureMoves[0] || domMoves[0];
                if (!chosenMove) {
                    console.warn('Sem fallback de jogada, a passar a vez.');
                    if (result === 1 || result === 4 || result === 6) {
                        showMessage({ who: 'system', key: 'msg_ai_no_moves_extra' });
                        lastDiceValue = null;
                        continue;
                    } else {
                        showMessage({ who: 'system', key: 'msg_ai_no_moves_pass' });
                        lastDiceValue = null;
                        nextTurn();
                        break;
                    }
                }
            }

            const piece = chosenMove.piece;
            const destCell = chosenMove.destCell;
            const state = piece.getAttribute('move-state');
            if (state === 'not-moved' && result === 1) piece.setAttribute('move-state', 'moved');
            movePieceTo(piece, destCell);
            if (checkWinCondition()) return;
            if (result === 1 || result === 4 || result === 6) {
                showMessage({ who: 'system', key: 'msg_ai_extra_roll' });
                TabStats.onExtraRoll(currentPlayer, result);
                lastDiceValue = null;
                continue;
            } else {
                lastDiceValue = null;
                nextTurn();
                break;
            }
        }
    }

    // ----------------------
    // Dice mechanics and animations (unchanged)
    // ----------------------
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

    function dropDiceSticks(pouch, arena, overlay, forcedValue = null) {
        const sticks = Array.from(pouch.querySelectorAll('.dice-stick'));
        let chosenUpCount;
        if (forcedValue != null) {
            chosenUpCount = (forcedValue === 6) ? 0 : forcedValue;
        } else {
            chosenUpCount = sampleFromDistribution(upCountProbs);
        }

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
                try { window.tabGame._resolveResult(gameValue); } catch (e) { console.warn('resolve falhou', e); }
                window.tabGame._resolveResult = null;
            }
        }, totalAnim + 40);
    }

    function showDiceResult(gameValue, upCount, overlay) {
        const prevBubble = overlay.querySelector('.dice-result-bubble');
        if (prevBubble) prevBubble.remove();
        const bubble = document.createElement('div'); bubble.className = 'dice-result-bubble';
        const big = document.createElement('div'); big.className = 'big'; big.textContent = String(gameValue);
        const label = document.createElement('div'); label.className = 'label';
        label.dataset.i18nKey = 'dice_label';
        label.dataset.diceUp = String(upCount);
        const diceName = t(`dice_name_${upCount}`);
        label.dataset.i18nParams = JSON.stringify({ name: diceName, up: upCount });
        label.textContent = t('dice_label', { name: diceName, up: upCount });
        const countdown = document.createElement('div'); countdown.className = 'dice-countdown';
        let secs = 1;
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
            if (overlay._countdownInterval) { clearInterval(overlay._countdownInterval); overlay._countdownInterval = null; }
            const ov = document.body.querySelector('.dice-overlay');
            if (ov) ov.remove();
        }, 1000);
    }

    function refreshDiceOverlay() {
        const ov = document.body.querySelector('.dice-overlay');
        if (!ov) return;
        ov.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.dataset.i18nKey;
            let params = {};
            if (key === 'dice_label') {
                const up = parseInt(el.dataset.diceUp || '0', 10);
                const name = t(`dice_name_${up}`);
                params = { name, up };
                el.dataset.i18nParams = JSON.stringify(params);
                el.textContent = t(key, params);
                return;
            }
            if (key === 'dice_countdown' && el.dataset.secs) {
                params = { secs: parseInt(el.dataset.secs, 10) };
                el.textContent = t(key, params);
                return;
            }
            el.textContent = t(key, params);
        });
    }
    window.__refreshDice = refreshDiceOverlay;

    window.tabGame.spawnAndLaunch = function () {
        return new Promise((resolve) => {
            const prev = document.body.querySelector('.dice-overlay');
            if (prev) {
                try {
                    if (prev._countdownInterval) { clearInterval(prev._countdownInterval); prev._countdownInterval = null; }
                    if (prev._autoCloseTimer) { clearTimeout(prev._autoCloseTimer); prev._autoCloseTimer = null; }
                } catch (e) { console.warn('Falha a limpar timers do overlay anterior:', e); }
                prev.remove();
            }
            window.tabGame._resolveResult = resolve;
            createDicePouch(true);
        });
    };
    window.tabGame.getLastValue = () => lastDiceValue;

    window.tabGame.showRemoteRoll = function (value) {
        return new Promise((resolve) => {
            const prev = document.body.querySelector('.dice-overlay');
            if (prev) prev.remove();
            createDicePouch(false);
            window.tabGame._resolveResult = resolve;
            const overlay = document.body.querySelector('.dice-overlay');
            const arena = overlay.querySelector('.dice-arena');
            const pouch = overlay.querySelector('.dice-pouch');

            setTimeout(() => {
                dropDiceSticks(pouch, arena, overlay, value);
            }, 100);
            lastDiceValue = value;
        });
    };

    function processDiceResult(playerNum, result) {
        lastDiceValue = result;
        showMessage({ who: 'player', player: playerNum, key: 'msg_dice_thrown', params: { value: result } });

        const isExtra = (result === 1 || result === 4 || result === 6);
        const isTab = (result === 1);
        const legalMoves = enumerateLegalMovesDOM(playerNum, result);
        const playerColor = getColorForPlayerNum(playerNum);

        const captureMoves = legalMoves.filter(m => {
            const occ = m.destCell.querySelector('.piece');
            return occ && !occ.classList.contains(playerColor);
        });

        if (legalMoves.length === 0) {
            if (isExtra) {
                showMessage({ who: 'system', key: 'msg_player_no_moves_extra' });
                try { TabStats.onDice(playerNum, result); TabStats.onExtraRoll(playerNum, result); } catch (e) { }
                if (playerNum === humanPlayerNum && throwBtn) {
                    throwBtn.disabled = false;
                    lastDiceValue = null;
                }
            } else {
                showMessage({ who: 'system', key: 'msg_player_no_moves_pass' });
                try { TabStats.onDice(playerNum, result); } catch (e) { }
                if (playerNum === humanPlayerNum && nextTurnBtn) {
                    nextTurnBtn.disabled = false;
                    if (throwBtn) throwBtn.disabled = true;
                }
            }
            return;
        }

        if (isTab) {
            const convertibleCount = countConvertiblePieces(playerNum);
            if (captureMoves.length > 0) {
                showMessage({ who: 'player', player: playerNum, key: 'msg_capture', params: { n: captureMoves.length } });
            } else if (convertibleCount > 0) {
                showMessage({ who: 'system', key: 'msg_dice_thrown_one', params: { n: convertibleCount } });
            }
            showMessage({ who: 'system', key: 'msg_dice_thrown_double', params: { value: result } });
        } else {
            if (isExtra) showMessage({ who: 'system', key: 'msg_dice_thrown_double', params: { value: result } });
            else showMessage({ who: 'system', key: 'msg_player_can_move' });
        }

        try {
            TabStats.onDice(playerNum, result);
            if (isExtra) TabStats.onExtraRoll(playerNum, result);
        } catch (e) { }

        if (playerNum === humanPlayerNum) {
            if (throwBtn) throwBtn.disabled = true;
            if (nextTurnBtn) nextTurnBtn.disabled = true;
        }
    }

    // ----------------------
    // i18n helper
    // ----------------------
    function t(key, params = {}) {
        const lang = window.currentLang || 'pt';
        const root = (typeof i18n !== 'undefined' ? i18n : window.i18n) || {};
        const dict = root[lang] || {};
        let str = dict[key] ?? root.en?.[key] ?? root.pt?.[key] ?? key;
        return String(str).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
    }

    // ----------------------
    // init
    // ----------------------
    function initGame({ initConfig = false } = {}) {
        const initialCols = widthSelect ? parseInt(widthSelect.value, 10) : 9;
        renderBoard(initialCols);
        showMessage({ who: 'system', key: 'select_mode' });
        if (initConfig) {
            if (modeSelect) { modeSelect.value = ''; modeSelect.selectedIndex = 0; }
            if (iaLevelSelect) { iaLevelSelect.value = ''; iaLevelSelect.selectedIndex = 0; }
            if (widthSelect) widthSelect.value = 9;
            if (firstToPlayCheckbox) firstToPlayCheckbox.checked = false;
        }
        if (nextTurnBtn) nextTurnBtn.disabled = true;
        if (throwBtn) throwBtn.disabled = true;

        setConfigEnabled(true);

        if (!widthSelect) console.warn('widthSelect not found');
        if (!gameBoard) console.warn('gameBoard not found');
        if (!messagesEl) console.warn('messagesEl not found');
    }

    window.initGame = initGame;
    initGame();
});