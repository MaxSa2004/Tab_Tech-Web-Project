// DOMContentLoaded ensures that all html is loaded before script runs
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

    // configuration selects
    const modeSelect = document.getElementById('game_mode');
    const iaLevelSelect = document.getElementById('ia_lvl');
    const firstToPlayCheckbox = document.getElementById('first_to_play');

    const rows = 4; // fixed number of rows 

    // state
    let currentPlayer = 1; // 1 or 2
    let gameActive = false;

    // AI state and mode
    let gameMode = 'player';      // 'player' | 'ia'
    let vsAI = false;             // true if playing against AI
    let vsPlayer = false;
    let aiDifficulty = 'normal';  // 'easy' | 'normal' | 'hard'
    let aiPlayerNum = null;       // 1 (red) ou 2 (yellow)
    let humanPlayerNum = 1;       // 1 (red) ou 2 (yellow) || 1 is default
    let waitingForPair = false;

    let currentServerStep = null; // 'from' | 'to' | 'take' | null
    let allowReRoll = false;
    let lastLegalServerDestIndices = [];
    let lastServerFromIndex = null; 
    let pendingToIndex = null;
    let lastServerTurnNick = null; // quem o servidor diz que tem a vez

    // control flags
    let passInFlight = false;

    // pieces
    let redPieces = 0;
    let yellowPieces = 0;
    let selectedPiece = null;

    // dice
    let lastDiceValue = null;

    // Debug helper
    window.__dbgState = function () {
        return {
            humanPlayerNum, currentPlayer, gameActive, vsAI, vsPlayer, aiPlayerNum, waitingForPair,
            throwBtnDisabled: throwBtn ? throwBtn.disabled : null,
            nextTurnBtnDisabled: nextTurnBtn ? nextTurnBtn.disabled : null,
            tt_nick: sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick'),
            tt_game: sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game'),
            eventSourceReadyState: window.updateEventSource ? window.updateEventSource.readyState : null,
            currentServerStep, lastDiceValue, lastServerTurnNick, pendingToIndex, lastServerFromIndex
        };
    };

    function getColorForPlayerNum(n) { return n === 1 ? 'red' : 'yellow'; }
    function isHumanTurn() { return currentPlayer === humanPlayerNum; }
    function getInitialNick() { return sessionStorage.getItem('tt_initial') || localStorage.getItem('tt_initial') || null; }

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

    function isMyTurnByServer() {
        const me = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
        if (!me) return false;
        const t = lastServerTurnNick;
        if (typeof t === 'string') {
            const lc = t.toLowerCase();
            if (lc === 'red') return (humanPlayerNum === 1);
            if (lc === 'yellow' || lc === 'blue') return (humanPlayerNum === 2);
            return (t === me);
        }
        if (typeof t === 'number') return (t === humanPlayerNum);
        return (currentPlayer === humanPlayerNum);
    }

    async function handleUpdateMessage(ev) {
        let payload;
        try { payload = JSON.parse(ev.data); } catch { return; }

        const localNick = sessionStorage.getItem('tt_nick');

        // turn
        if (payload.turn !== undefined) {
            lastServerTurnNick = payload.turn || null;

            let turnPlayerNum = null;
            const t = payload.turn;

            if (typeof t === 'number') {
                turnPlayerNum = (t === 1 ? 1 : 2);
            } else if (typeof t === 'string') {
                if (t === localNick) {
                    turnPlayerNum = humanPlayerNum;
                } else {
                    const lc = t.toLowerCase();
                    if (lc === 'red') turnPlayerNum = 1;
                    else if (lc === 'yellow' || lc === 'blue') turnPlayerNum = 2;
                    else {
                        const maybeNum = parseInt(t, 10);
                        if (!isNaN(maybeNum) && (maybeNum === 1 || maybeNum === 2)) turnPlayerNum = maybeNum;
                        else turnPlayerNum = (humanPlayerNum === 1 ? 2 : 1);
                    }
                }
            }

            if (turnPlayerNum != null) {
                const isMyTurn = (turnPlayerNum === humanPlayerNum);
                const changed = (turnPlayerNum !== currentPlayer);
                allowReRoll = false;
                currentPlayer = turnPlayerNum;

                if (currentPlayerEl) {
                    if (isMyTurn) currentPlayerEl.textContent = 'EU';
                    else if (typeof t === 'string' && t !== 'red' && t !== 'yellow' && t !== 'Blue' && t !== 'blue') {
                        currentPlayerEl.textContent = String(t);
                    } else {
                        currentPlayerEl.textContent = (currentPlayer === 1 ? 'P1' : 'P2');
                    }
                }

                if (changed) {
                    selectedPiece = null;
                    lastDiceValue = null;
                    clearHighlights();
                    try { TabStats.onTurnAdvance(); } catch {}
                }

                if (throwBtn) throwBtn.disabled = !isMyTurn;
                if (nextTurnBtn) nextTurnBtn.disabled = true;
            }
        }

        // dice
        if (payload.dice !== undefined) {
            const isMyTurn = isMyTurnByServer();
            if (payload.dice === null) {
                allowReRoll = false;
                lastDiceValue = null;
                if (throwBtn) throwBtn.disabled = !isMyTurn;
                if (nextTurnBtn) nextTurnBtn.disabled = true;
                if (isMyTurn) showMessage({ who: 'system', key: 'msg_dice' });
            } else {
                const diceObj = payload.dice || {};
                const val = diceObj.value;
                const keepPlaying = !!diceObj.keepPlaying;
                window.tabGame.showRemoteRoll(val).then(() => {
                    lastDiceValue = val;
                    const meNum = humanPlayerNum;
                    const oppNum = (meNum === 1) ? 2 : 1;
                    showMessage({ who: 'player', player: isMyTurn ? meNum : oppNum, key: 'msg_dice_thrown', params: { value: val } });
                    try { TabStats.onDice(currentPlayer, val); } catch {}
                    if (keepPlaying) {
                        if (val === 1) {
                            const n = countConvertiblePieces(isMyTurn ? meNum : oppNum);
                            if (n > 0) showMessage({ who: 'system', key: 'msg_dice_thrown_one', params: { n } });
                        }
                        showMessage({ who: 'system', key: 'msg_dice_thrown_double', params: { value: val } });
                        try { TabStats.onExtraRoll(currentPlayer, val); } catch {}
                    }
                    allowReRoll = false;
                    if (isMyTurn && keepPlaying) {
                        const noMovesNow = enumerateLegalMovesDOM(meNum, val).length === 0;
                        if (noMovesNow) {
                            allowReRoll = true;
                            showMessage({ who: 'system', key: 'msg_player_no_moves_extra' });
                            lastDiceValue = null;
                            if (throwBtn) throwBtn.disabled = false;
                            if (nextTurnBtn) nextTurnBtn.disabled = true;
                            return;
                        }
                    }
                    let enablePass = false;
                    if (isMyTurn) {
                        const isExtra = (val === 1 || val === 4 || val === 6);
                        if (!isExtra) {
                            const noMoves = enumerateLegalMovesDOM(humanPlayerNum, val).length === 0;
                            if (noMoves) {
                                enablePass = true;
                                showMessage({ who: 'system', key: 'msg_player_no_moves_pass' });
                            }
                        }
                    }
                    if (throwBtn) throwBtn.disabled = true;
                    if (nextTurnBtn) nextTurnBtn.disabled = !enablePass;
                });
            }
        }

        // step
        if (payload.step !== undefined) {
            const step = payload.step;
            const isMyTurnSrv = isMyTurnByServer();
            const changed = (step !== currentServerStep);
            currentServerStep = step;

            if (throwBtn) {
                const canRollNow =
                    isMyTurnSrv &&
                    (allowReRoll ||
                     (payload.dice === null && step !== 'from' && step !== 'to' && step !== 'take') ||
                     (payload.dice === undefined && lastDiceValue == null && step !== 'from' && step !== 'to' && step !== 'take'));
                throwBtn.disabled = !canRollNow;
            }

            if (nextTurnBtn) {
                let enableSkip = false;
                if (isMyTurnSrv) {
                    const isExtra = (lastDiceValue === 1 || lastDiceValue === 4 || lastDiceValue === 6);
                    if (lastDiceValue != null && !isExtra && step === 'from') {
                        const noMoves = enumerateLegalMovesDOM(humanPlayerNum, lastDiceValue).length === 0;
                        if (noMoves) enableSkip = true;
                    }
                }
                nextTurnBtn.disabled = !enableSkip;
            }

            if (!isMyTurnSrv) {
                if (throwBtn) throwBtn.disabled = true;
                if (changed) showMessage({ who: 'system', key: 'msg_wait_opponent_move' });
                clearHighlights();
                return;
            }

            if (step === 'from') {
                const hasServerDice = (payload.dice !== undefined && payload.dice !== null) || (lastDiceValue !== null);
                if (changed) {
                    if (!hasServerDice) showMessage({ who: 'system', key: 'msg_dice' });
                    else showMessage({ who: 'system', key: 'msg_select_piece_move' });
                }
            } else if (step === 'to') {
                if (changed) showMessage({ who: 'system', key: 'msg_select_destination' });
                if (throwBtn) throwBtn.disabled = true;
                if (isMyTurnSrv && pendingToIndex != null) {
                    try {
                        const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
                        const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
                        const game = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game');
                        const toSend = pendingToIndex;
                        pendingToIndex = null;
                        console.debug('[AUTO NOTIFY TO pendente]', { toSend });
                        await Network.notify({ nick, password, game, cell: toSend });
                    } catch (e) {
                        console.warn('Falha no AUTO TO:', e);
                    }
                }
                if (nextTurnBtn) nextTurnBtn.disabled = true;
            } else if (step === 'take') {
                if (changed) showMessage({ who: 'system', key: 'msg_select_opponent_piece' });
                if (throwBtn) throwBtn.disabled = true;
                if (nextTurnBtn) nextTurnBtn.disabled = true;
            }
        }

        // mustPass
        if (payload.mustPass !== undefined) {
            const isMyTurnSrv = isMyTurnByServer();
            if (payload.mustPass === true) {
                if (isMyTurnSrv) {
                    if (nextTurnBtn) nextTurnBtn.disabled = false;
                    if (throwBtn) throwBtn.disabled = true;
                    showMessage({ who: 'system', key: 'msg_player_no_moves_pass' });
                } else {
                    if (nextTurnBtn) nextTurnBtn.disabled = true;
                    if (throwBtn) throwBtn.disabled = true;
                }
            } else {
                if (nextTurnBtn) nextTurnBtn.disabled = true;
            }
        }

        // error
        if (payload.error) {
            console.warn('Server Error:', payload.error);
            showMessage({ who: 'system', key: 'msg_server_error', params: { error: payload.error } });
            if (throwBtn) throwBtn.disabled = true;
            if (nextTurnBtn) nextTurnBtn.disabled = true;
            if (waitingForPair && !gameActive) {
                setWaitingForPair(false);
                setConfigEnabled(true);
            }
            const emsg = String(payload.error).toLowerCase();
            const looksFatal = (emsg.includes('game') || emsg.includes('jogo') || emsg.includes('partida')) &&
                (emsg.includes('not found') || emsg.includes('inexistente') ||
                 emsg.includes('invalid') || emsg.includes('termin') || emsg.includes('ended') ||
                 emsg.includes('finished'));
            if (looksFatal && gameActive) {
                endGame();
            }
        }

        // game id / EventSource update
        if (payload.game) {
            const prev = sessionStorage.getItem('tt_game') || '';
            if (payload.game !== prev) sessionStorage.setItem('tt_game', payload.game);
            window.currentGameId = payload.game;
            try {
                if (window.updateEventSource && window.updateEventSource.readyState !== 2) {
                    const currentUrl = window.updateEventSource.url || '';
                    const hasGameParam = currentUrl.includes('game=');
                    if (!hasGameParam) {
                        const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
                        if (nick) {
                            window.updateEventSource.close();
                            window.updateEventSource = Network.createUpdateEventSource({ nick, game: payload.game });
                            window.updateEventSource.onmessage = handleUpdateMessage;
                            window.updateEventSource.onerror = (err) => {
                                console.warn('EventSource error:', err);
                            };
                        }
                    }
                }
            } catch (e) {
                console.warn('Erro ao atualizar EventSource com novo ID de jogo:', e);
            }
        }

        // initial (first player nick)
        if (payload.initial) {
            sessionStorage.setItem('tt_initial', payload.initial);
            humanPlayerNum = (payload.initial === localNick) ? 1 : 2;
            if (!gameActive) {
                gameActive = true;
                if (vsPlayer) {
                    try {
                        TabStats.start({ mode: 'player', aiDifficulty: null, cols: parseInt(widthSelect?.value || '9', 10), firstPlayer: 1, firstStarterRole: null });
                    } catch {}
                }
                waitingForPair = false;
                setConfigEnabled(false);
                if (playButton) playButton.disabled = true;
                if (leaveButton) leaveButton.disabled = false;
                if (nextTurnBtn) nextTurnBtn.disabled = true;
                if (throwBtn) throwBtn.disabled = true;
                refreshCapturedTitles();
                showMessage({ who: 'system', key: 'msg_game_started' });
            }
        }

        // pieces — render authoritative board
        if (payload.pieces) {
            let sizeFromServer = null;
            if (Array.isArray(payload.pieces) && payload.pieces.length % 4 === 0) {
                sizeFromServer = payload.pieces.length / 4;
            }
            if (sizeFromServer && widthSelect) {
                const cur = parseInt(widthSelect.value, 10);
                if (cur !== sizeFromServer) {
                    widthSelect.value = String(sizeFromServer);
                    renderBoard(sizeFromServer);
                } else if (!gameBoard.querySelector('.cell')) {
                    renderBoard(sizeFromServer);
                }
            }
            const initialNick = payload.initial || getInitialNick();
            updateBoardFromRemote(payload.pieces, initialNick);
        }

        // players (colors mapping)
        if (payload.players && typeof payload.players === 'object') {
            try { sessionStorage.setItem('tt_players', JSON.stringify(payload.players)); } catch {}
            const myColor = localNick ? payload.players[localNick] : null;
            if (myColor) {
                const myNum = (String(myColor).toLowerCase() === 'red') ? 1 : 2;
                if (humanPlayerNum !== myNum) {
                    humanPlayerNum = myNum;
                    refreshCapturedTitles();
                }
            }
            const nicks = Object.keys(payload.players);
            const opponentNick = localNick ? nicks.find(n => n !== localNick) : null;
            if (opponentNick) sessionStorage.setItem('tt_opponent', opponentNick);
            if (!gameActive) {
                gameActive = true;
                waitingForPair = false;
                setConfigEnabled(false);
                if (playButton) playButton.disabled = true;
                if (leaveButton) leaveButton.disabled = false;
                if (nextTurnBtn) nextTurnBtn.disabled = true;
                if (throwBtn) throwBtn.disabled = true;
                showMessage({ who: 'system', key: 'msg_game_started' });
            }
        }

        // ranking feedback
        if (payload.ranking !== undefined) {
            const list = Array.isArray(payload.ranking) ? payload.ranking : [];
            try {
                if (list.length > 0) sessionStorage.setItem('tt_ranking', JSON.stringify(list));
                else sessionStorage.removeItem('tt_ranking');
            } catch {}
            if (list.length === 0) {
                showMessage({ who: 'system', key: 'msg_ranking_cleared' });
            } else {
                const me = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
                const topN = Math.min(list.length, 10);
                const lines = list.slice(0, topN).map((row, i) => {
                    const mark = (row.nick === me) ? '<- você' : '';
                    const victories = (row.victories ?? 0);
                    const games = (row.games ?? 0);
                    return `${i + 1}. ${row.nick} - Vitórias: ${victories}, Jogos: ${games} ${mark}`;
                });
                showMessage({ who: 'system', key: 'msg_ranking_updated', params: { ranking: lines.join('\n') } });
            }
        }

        // selected cells highlighting from server
        if (payload.selected !== undefined) {
            clearHighlights();
            if (selectedPiece) {
                selectedPiece.classList.remove('selected');
                selectedPiece = null;
            }
            const indices = Array.isArray(payload.selected) ? payload.selected : [];
            const cols = parseInt((widthSelect && widthSelect.value) || '9', 10);
            const initialNick = payload.initial || getInitialNick();

            indices.forEach(idx => {
                const { r, c } = serverIndexToLocalCell(idx, cols, initialNick);
                const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
                if (!cell) return;
                cell.classList.add('green-glow', 'pulse');
                setTimeout(() => cell.classList.remove('pulse'), 900);
            });
        }
    }

    // index conversions
    function serverIndexToLocalCell(index, totalCols, initialPlayerNick) {
        const localNick = sessionStorage.getItem('tt_nick');
        const rowFromBottom = Math.floor(index / totalCols);
        const colFromRight = index % totalCols;

        let r = (rows - 1) - rowFromBottom;
        let c = (totalCols - 1) - colFromRight;

        if (localNick !== initialPlayerNick) {
            r = (rows - 1) - r;
            c = (totalCols - 1) - c;
        }
        return { r, c };
    }
    function localCellToServerIndex(r, c, cols, nick, initialNick) {
        const isInitial = (nick === initialNick);
        let rRef = r, cRef = c;
        if (!isInitial) {
            rRef = (rows - 1) - rRef;
            cRef = (cols - 1) - cRef;
        }
        const rowFromBottom = (rows - 1) - rRef;
        const colFromRight = (cols - 1) - cRef;
        return rowFromBottom * cols + colFromRight;
    }
    function computeServerIndexForCell(cell, cols, nick, initialNick) {
        const r = parseInt(cell.dataset.r, 10);
        const c = parseInt(cell.dataset.c, 10);
        return localCellToServerIndex(r, c, cols, nick, initialNick);
    }

    // render board from server pieces
    function updateBoardFromRemote(piecesArray, initialNick) {
        if (!Array.isArray(piecesArray)) return;
        const allCells = document.querySelectorAll('.cell');
        allCells.forEach(cell => {
            const p = cell.querySelector('.piece');
            if (p) p.remove();
            cell.classList.remove('green-glow', 'selected', 'pulse');
        });

        const cols = widthSelect ? parseInt(widthSelect.value, 10) : 9;

        piecesArray.forEach((pieceData, index) => {
            if (!pieceData) return;
            const coords = serverIndexToLocalCell(index, cols, initialNick);
            const cell = document.querySelector(`.cell[data-r="${coords.r}"][data-c="${coords.c}"]`);
            if (cell) {
                const piece = document.createElement('div');
                piece.classList.add('piece');
                const serverColor = (pieceData.color || '').toLowerCase();
                const cssColor = (serverColor === 'red') ? 'red' : 'yellow';
                piece.classList.add(cssColor);

                let moveState = 'not-moved';
                if (pieceData.reachedLastRow) moveState = 'row-four';
                else if (pieceData.inMotion) moveState = 'moved';
                piece.setAttribute('move-state', moveState);
                cell.appendChild(piece);
            }
        });

        redPieces = document.querySelectorAll('.piece.red').length;
        yellowPieces = document.querySelectorAll('.piece.yellow').length;
        rebuildCapturedPanelsFromBoard(cols);
    }

    function rebuildCapturedPanelsFromBoard(cols) {
        if (!capturedP1 || !capturedP2) return;
        const redOnBoard = document.querySelectorAll('.piece.red').length;
        const yellowOnBoard = document.querySelectorAll('.piece.yellow').length;
        const redCaptured = Math.max(0, cols - redOnBoard);
        const yellowCaptured = Math.max(0, cols - yellowOnBoard);

        const rebuild = (container, count, color) => {
            container.innerHTML = '';
            for (let i = 0; i < count; i++) {
                const token = document.createElement('div');
                token.className = `captured-token ${color}`;
                token.setAttribute('aria-label', color === 'red' ? 'Captured red piece' : 'Captured yellow piece');
                container.appendChild(token);
            }
        };
        rebuild(capturedP1, yellowCaptured, 'yellow');
        rebuild(capturedP2, redCaptured, 'red');
    }

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
        const aiLabel = L[aiKey] || (lang === 'pt'
            ? `IA (${aiDifficulty === 'easy' ? 'Fácil' : aiDifficulty === 'hard' ? 'Difícil' : 'Normal'})`
            : `AI (${aiDifficulty[0].toUpperCase()}${aiDifficulty.slice(1)})`);
        return { player1Label, player2Label, aiLabel };
    }
    function refreshCapturedTitles() {
        const elP1 = document.getElementById('capTitleP1');
        const elP2 = document.getElementById('capTitleP2');
        if (!elP1 || !elP2) return;
        const { player1Label, player2Label, aiLabel } = getLocalizedLabelsForPanels();
        if (vsAI) {
            if (aiPlayerNum === 1) { elP1.textContent = aiLabel; elP2.textContent = player1Label; }
            else { elP1.textContent = player1Label; elP2.textContent = aiLabel; }
        } else {
            elP1.textContent = player1Label;
            elP2.textContent = player2Label;
        }
    }
    window.__refreshCaptured = refreshCapturedTitles;

    function leaveGame({ showStats = true } = {}) {
        if (waitingForPair && !gameActive) {
            const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
            const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
            const gameId = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game');
            if (nick && password && gameId) {
                try { Network.leave({ nick, password, game: gameId }); } catch (e) { console.warn('Erro ao sair da partida:', e); }
            }
            try { if (window.updateEventSource) { window.updateEventSource.close(); window.updateEventSource = null; } } catch (e) {}
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

        let winnerNum = null;
        if (vsAI) {
            winnerNum = aiPlayerNum || 2;
        } else {
            winnerNum = (currentPlayer === 1 ? 2 : 1);
        }

        if (showStats) {
            try { TabStats.setWinner(winnerNum); TabStats.showSummary(); } catch (e) {}
            showMessage({ who: 'system', key: 'msg_leave_game', params: { player: currentPlayer } });
        }

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
        playButton.disabled = !isConfigValid();
        leaveButton.disabled = true;

        renderBoard(parseInt(widthSelect.value, 10));
        updatePlayButtonState();
    }
    window.leaveGame = leaveGame;
    if (leaveButton) leaveButton.addEventListener('click', () => leaveGame({ showStats: true }));

    if (modeSelect) modeSelect.addEventListener('change', () => { setConfigEnabled(true); updatePlayButtonState(); });
    if (iaLevelSelect) iaLevelSelect.addEventListener('change', updatePlayButtonState);
    updatePlayButtonState();

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
        rebuildCapturedPanelsFromBoard(cols);
    }

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

    async function handleCellClick(cell) {
        if (!gameActive) return;
        if (vsAI && currentPlayer === aiPlayerNum) return;
        if (vsPlayer && currentPlayer !== humanPlayerNum) return;

        if (vsPlayer && currentPlayer === humanPlayerNum) {
            const pieceInCell = cell.querySelector('.piece');

            // select/toggle own piece (no notify)
            if (pieceInCell) {
                const isMyPiece =
                    ((currentPlayer == 1 && pieceInCell.classList.contains('red')) ||
                     (currentPlayer == 2 && pieceInCell.classList.contains('yellow')));
                if (isMyPiece) {
                    if (selectedPiece === pieceInCell && currentServerStep === 'from') {
                        pieceInCell.classList.remove('selected');
                        selectedPiece = null;
                        lastServerFromIndex = null;
                        lastLegalServerDestIndices = [];
                        clearHighlights();
                        return;
                    }
                    const prev = document.querySelector('.piece.selected');
                    if (prev) prev.classList.remove('selected');

                    pieceInCell.classList.add('selected');
                    selectedPiece = pieceInCell;

                    clearHighlights();
                    const state = pieceInCell.getAttribute('move-state');
                    const movesAllowed = (state === 'not-moved' && lastDiceValue !== 1) ? [] : getValidMoves(pieceInCell);
                    movesAllowed.forEach(dest => dest.classList.add('green-glow'));

                    lastLegalServerDestIndices = [];
                    try {
                        const cols = parseInt(widthSelect.value, 10) || 9;
                        const initialNick = getInitialNick();
                        const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
                        const fromCell = selectedPiece.parentElement;
                        lastServerFromIndex = computeServerIndexForCell(fromCell, cols, nick, initialNick);
                        movesAllowed.forEach(destCell => {
                            const idx = computeServerIndexForCell(destCell, cols, nick, initialNick);
                            lastLegalServerDestIndices.push(idx);
                        });
                        console.debug('[SELECT FROM cached]', { fromIndex: lastServerFromIndex, step: currentServerStep, lastDiceValue });
                    } catch (e) {
                        console.debug('[LEGAL DEST] Falhou a gerar índices destino:', e);
                        lastServerFromIndex = null;
                        lastLegalServerDestIndices = [];
                    }
                    return;
                }
            }

            // creds
            const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
            const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
            const game = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game');
            const cols = parseInt(widthSelect.value, 10) || 9;
            const initialNick = getInitialNick();

            // movement: click a legal destination
            if (selectedPiece) {
                const destIndex = computeServerIndexForCell(cell, cols, nick, initialNick);
                const isLegalDest = lastLegalServerDestIndices.includes(destIndex);
                if (isLegalDest) {
                    try {
                        console.debug('[MOVE attempt]', { fromIndex: lastServerFromIndex, destIndex, step: currentServerStep });

                        if (lastDiceValue == null || currentServerStep !== 'from') {
                            console.debug('[ABORT FROM] dado ausente ou step !== "from"', { lastDiceValue, currentServerStep });
                            return;
                        }

                        if (lastServerFromIndex == null) {
                            const fromCell = selectedPiece.parentElement;
                            lastServerFromIndex = computeServerIndexForCell(fromCell, cols, nick, initialNick);
                        }

                        // send FROM
                        await Network.notify({ nick, password, game, cell: lastServerFromIndex });

                        // cache destination; TO will be sent when server switches to 'to'
                        pendingToIndex = destIndex;
                        console.debug('[FROM enviado; destino pendente]', { pendingToIndex });
                        return;
                    } catch (err) {
                        console.warn('Erro ao notificar movimento (FROM):', err);
                        // não limpar brutalmente a UI; só reset de caches
                        lastServerFromIndex = null;
                        lastLegalServerDestIndices = [];
                    }
                    return;
                }
            }

            // capture: only in 'take'
            if (currentServerStep === 'take') {
                const occ = cell.querySelector('.piece');
                const isOppPiece = occ && !(
                    (currentPlayer == 1 && occ.classList.contains('red')) ||
                    (currentPlayer == 2 && occ.classList.contains('yellow'))
                );
                if (!isOppPiece) {
                    console.debug('[IGNORA TAKE] Célula sem peça adversária válida');
                    return;
                }
                try {
                    const takeIndex = computeServerIndexForCell(cell, cols, nick, initialNick);
                    console.debug('[NOTIFY TAKE]', { takeIndex, step: currentServerStep });
                    await Network.notify({ nick, password, game, cell: takeIndex });
                } catch (err) {
                    console.warn('Erro ao notificar TAKE:', err);
                }
                return;
            }

            // empty click in 'from' cancels selection
            const pieceInCell2 = cell.querySelector('.piece');
            if (!pieceInCell2 && selectedPiece && currentServerStep === 'from') {
                selectedPiece.classList.remove('selected');
                selectedPiece = null;
                lastServerFromIndex = null;
                lastLegalServerDestIndices = [];
                clearHighlights();
                return;
            }
            return;
        }

        // PvE/local logic
        const pieceInCell = cell.querySelector('.piece');
        if (pieceInCell && ((currentPlayer == 1 && pieceInCell.classList.contains('red')) ||
            (currentPlayer == 2 && pieceInCell.classList.contains('yellow')))) {
            if (selectedPiece === pieceInCell) {
                selectedPiece.classList.remove('selected');
                selectedPiece = null;
                clearHighlights();
                return;
            }
            if (selectedPiece) selectedPiece.classList.remove('selected');
            selectPiece(pieceInCell);
            if (!selectedPiece) return;
            clearHighlights();
            const state = pieceInCell.getAttribute('move-state');
            const movesAllowed = (state === 'not-moved' && lastDiceValue !== 1) ? [] : getValidMoves(pieceInCell);
            movesAllowed.forEach(dest => dest.classList.add('green-glow'));
            return;
        }

        if (selectedPiece && lastDiceValue != null) {
            const state = selectedPiece.getAttribute('move-state');
            if (state === 'not-moved' && lastDiceValue !== 1) return;

            const possibleMoves = getValidMoves(selectedPiece);
            const isValidMove = possibleMoves.some(dest => dest === cell);

            if (isValidMove) {
                if (state === 'not-moved' && lastDiceValue === 1) selectedPiece.setAttribute('move-state', 'moved');
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
            } else if (!cell.querySelector('.piece')) {
                selectedPiece.classList.remove('selected');
                selectedPiece = null;
                clearHighlights();
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
        const target = capturedByPlayer === 1 ? capturedP1 : capturedP2;
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
            if (throwBtn && !throwBtn.disabled) showMessage({ who: 'system', key: 'msg_dice' });
        }
    }

    function checkWinCondition() {
        let winnerNum = null;
        if (redPieces == 0) winnerNum = 2;
        else if (yellowPieces == 0) winnerNum = 1;
        else return false;

        showMessage({ who: 'system', key: 'msg_player_won', params: { player: winnerNum } });
        TabStats.setWinner(winnerNum);
        endGame();
        return true;
    }

    function endGame() {
        try {
            if (window.updateEventSource) { window.updateEventSource.close(); window.updateEventSource = null; }
        } catch {}
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
            if (b.dataset.i18nParams) { try { params = JSON.parse(b.dataset.i18nParams); } catch {} }
            b.textContent = t(key, params);
        });
    }
    function clearMessages() {
        if (!messagesEl) return;
        messagesEl.innerHTML = '';
        return;
    }
    window.clearMessages = clearMessages;
    window.__refreshChat = refreshChatBubbles;

    if (nextTurnBtn) {
        nextTurnBtn.addEventListener('click', async () => {
            if (vsPlayer) {
                if (!isMyTurnByServer()) {
                    alert('Ainda não é a sua vez segundo o servidor.');
                    return;
                }
                const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
                const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
                const game = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game');
                if (!nick || !password || !game) {
                    alert("Você precisa estar autenticado para jogar contra outro jogador.");
                    return;
                }
                if (passInFlight) return;
                passInFlight = true;
                nextTurnBtn.disabled = true;
                console.debug('[UI] Sending Network.pass', { nick, game, lastDiceValue, currentServerStep, lastServerTurnNick });
                try {
                    await Network.pass({ nick, password, game });
                } catch (err) {
                    console.warn('Erro ao passar o turno no modo PvP:', err);
                    const isExtra = (lastDiceValue === 1 || lastDiceValue === 4 || lastDiceValue === 6);
                    const noMoves = (lastDiceValue != null && !isExtra) ? (enumerateLegalMovesDOM(humanPlayerNum, lastDiceValue).length === 0) : false;
                    nextTurnBtn.disabled = !noMoves;
                    alert('Não foi possível passar o turno. Verifique se ainda existem jogadas válidas para o lançamento atual.');
                } finally {
                    passInFlight = false;
                }
                return;
            }
            TabStats.onPass(currentPlayer);
            nextTurn();
        });
    }

    if (widthSelect) widthSelect.addEventListener('change', () => renderBoard(parseInt(widthSelect.value, 10)));
    if (authForm) authForm.addEventListener('submit', (ev) => ev.preventDefault());

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
                if (!window.updateEventSource) {
                    try {
                        window.updateEventSource = Network.createUpdateEventSource({ nick, game: gameId });
                        window.updateEventSource.onmessage = handleUpdateMessage;
                        window.updateEventSource.onerror = (err) => {
                            console.warn('Erro na conexão com o servidor de atualizações:', err);
                        };
                    } catch (e) {
                        console.warn('Erro ao criar EventSource para atualizações:', e);
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
            try {
                TabStats.start({
                    mode: gameMode,
                    aiDifficulty: vsAI ? aiDifficulty : null,
                    cols: parseInt(widthSelect.value, 10),
                    firstPlayer: vsAI ? (humanFirst ? "Human" : "Ai") : null
                });
                TabStats.onTurnAdvance();
            } catch {}
            showMessage({ who: 'system', key: 'msg_game_started' });

            gameActive = true;
            updatePlayButtonState();
            setConfigEnabled(false);

            if (nextTurnBtn) nextTurnBtn.disabled = true;
            if (throwBtn) throwBtn.disabled = (vsAI && aiPlayerNum === 1);
            if (playButton) playButton.disabled = true;
            if (leaveButton) leaveButton.disabled = false;
            if (isHumanTurn() && throwBtn && !throwBtn.disabled) showMessage({ who: 'system', key: 'msg_dice' });

            if (vsAI && 1 === aiPlayerNum) {
                setTimeout(() => runAiTurnLoop().catch(err => console.warn('Erro no turno inicial da IA:', err)), 250);
            }
        }
    });

    if (throwBtn) {
        throwBtn.addEventListener('click', async (e) => {
            const lang = window.currentLang || 'pt';
            console.debug('[UI] throwBtn clicked', {
                gameActive, vsAI, vsPlayer, currentPlayer, humanPlayerNum, throwBtnDisabled: throwBtn.disabled
            });

            if (vsAI && currentPlayer === aiPlayerNum) {
                console.debug('[UI] Ignoring throw: AI turn (local state)');
                if (e && e.preventDefault) e.preventDefault();
                return;
            }
            if (!gameActive) {
                console.debug('[UI] Ignoring throw: gameActive=false');
                return;
            }

            if (vsPlayer) {
                if (!isMyTurnByServer()) {
                    console.debug('[UI] Ignoring roll: not server turn');
                    return;
                }
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
                    alert((lang === 'pt' ? 'Erro ao enviar jogada para o servidor. Por favor, tente novamente mais tarde.' : 'Error sending move to server. Please try again later.'));
                    throwBtn.disabled = false;
                }
                return;
            }

            // Local dice for PvE
            try {
                console.debug('[UI] Local dice (spawnAndLaunch) for player', currentPlayer);
                const result = await window.tabGame.spawnAndLaunch();
                processDiceResult(currentPlayer, result);
            } catch (err) {
                console.warn('Erro ao lançar dados localmente:', err);
            }
        });
    }

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
                    console.warn('Fallback sem jogada válida — a passar a vez.');
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

    const upCountProbs = [0.06, 0.25, 0.38, 0.25, 0.06];
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
        const chosenUpCount = (forcedValue != null) ? ((forcedValue === 6) ? 0 : forcedValue) : sampleFromDistribution(upCountProbs);
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
            s.classList.remove('initial'); void s.offsetWidth;
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
                try { window.tabGame._resolveResult(gameValue); } catch (e) {}
                window.tabGame._resolveResult = null;
            }
        }, totalAnim + 40);
    }

    function showDiceResult(gameValue, upCount, overlay) {
        const prevBubble = overlay.querySelector('.dice-result-bubble');
        if (prevBubble) prevBubble.remove();
        const bubble = document.createElement('div');
        bubble.className = 'dice-result-bubble';
        const big = document.createElement('div'); big.className = 'big'; big.textContent = String(gameValue);
        const label = document.createElement('div'); label.className = 'label';
        label.dataset.i18nKey = 'dice_label';
        label.dataset.diceUp = String(upCount);
        const diceName = t(`dice_name_${upCount}`);
        label.dataset.i18nParams = JSON.stringify({ name: diceName, up: upCount });
        label.textContent = t('dice_label', { name: diceName, up: upCount });
        const countdown = document.createElement('div');
        countdown.className = 'dice-countdown';
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
            if (overlay._countdownInterval) {
                clearInterval(overlay._countdownInterval);
                overlay._countdownInterval = null;
            }
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
                } catch (e) {}
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
            setTimeout(() => { dropDiceSticks(pouch, arena, overlay, value); }, 100);
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
                TabStats.onDice(playerNum, result);
                TabStats.onExtraRoll(playerNum, result);
                if (playerNum === humanPlayerNum && throwBtn) throwBtn.disabled = false;
            } else {
                showMessage({ who: 'system', key: 'msg_player_no_moves_pass' });
                TabStats.onDice(playerNum, result);
                if (playerNum === humanPlayerNum && nextTurnBtn) nextTurnBtn.disabled = false;
                return;
            }
            if (isTab) {
                const convertibleCount = countConvertiblePieces(playerNum);
                if (captureMoves.length > 0) {
                    showMessage({ who: 'player', player: playerNum, key: 'msg_capture', params: { n: captureMoves.length } });
                    showMessage({ who: 'system', key: 'msg_dice_thrown_double', params: { value: result } });
                } else if (convertibleCount > 0) {
                    showMessage({ who: 'system', key: 'msg_dice_thrown_one', params: { n: convertibleCount } });
                    showMessage({ who: 'system', key: 'msg_dice_thrown_double', params: { value: result } });
                } else {
                    showMessage({ who: 'system', key: 'msg_dice_thrown_double', params: { value: result } });
                    showMessage({ who: 'system', key: 'msg_player_can_move' });
                }
            } else {
                if (isExtra) showMessage({ who: 'system', key: 'msg_dice_thrown_double', params: { value: result } });
                if (captureMoves.length > 0) {
                    showMessage({ who: 'player', player: playerNum, key: 'msg_capture', params: { n: captureMoves.length } });
                } else {
                    showMessage({ who: 'system', key: 'msg_player_can_move' });
                }
            }
            TabStats.onDice(playerNum, result);
            if (isExtra) TabStats.onExtraRoll(playerNum, result);
            if (playerNum === humanPlayerNum) {
                if (throwBtn) throwBtn.disabled = true;
                if (nextTurnBtn) nextTurnBtn.disabled = true;
            }
        }
    }

    function t(key, params = {}) {
        const lang = window.currentLang || 'pt';
        const root = (typeof i18n !== 'undefined' ? i18n : window.i18n) || {};
        const dict = root[lang] || {};
        let str = dict[key] ?? root.en?.[key] ?? root.pt?.[key] ?? key;
        return String(str).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
    }

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