// PvP controller: fixed-view (human at bottom), local move highlighting & server sync.

window.PVPController = (function () {
    let S, UI, Msg, Dice, Net;

    function init(GameState, GameUI, Messages, DiceModule, Network) {
        S = GameState; UI = GameUI; Msg = Messages; Dice = DiceModule; Net = Network;

        const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
        const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
        if (!nick || !password) { alert("Auth required."); return; }

        S.vsPlayer = true; S.vsAI = false;
        S.serverSelectedIndices = new Set();
        S.myServerColor = null;
        S.oppServerColor = null;

        if (UI.updatePlayLeaveButtons) UI.updatePlayLeaveButtons();
        Msg.system('msg_waiting_opponent');

        const size = S.getCols();
        const group = 36;
        console.log(`[PvP] Grupo: ${group}`);

        Net.join({ group, nick, password, size }).then(joinResult => {
            if (joinResult.game) {
                const gameId = joinResult.game;
                console.log(`[PvP] Game ID: ${gameId}`);
                sessionStorage.setItem('tt_game', gameId);
                window.currentGameId = gameId;

                if (window.updateEventSource) window.updateEventSource.close();
                window.updateEventSource = Net.createUpdateEventSource({ nick, game: gameId });
                window.updateEventSource.onmessage = handleUpdateMessage;
            }
        }).catch(err => {
            console.warn(err); S.setGameActive(false); if (UI.updatePlayLeaveButtons) UI.updatePlayLeaveButtons();
        });
    }

    // ----- Mapping server <-> view (server indices are from initial player's perspective)
    // IMPORTANT: Flip é apenas visual. data-r/data-c continuam com 0 = topo, 3 = base.
    // Por isso, SEMPRE usar a convenção do servidor independentemente de S.viewFlipped.
    // ...

    // Flag: sou eu o jogador inicial?
    // Define-a quando chega payload.initial
    // S.isInitialMe = boolean

    function serverIndexToViewCell(index, totalCols) {
        const rows = S.rows;
        const rowFromBottom = Math.floor(index / totalCols);
        const colFromRight = index % totalCols;

        if (S.isInitialMe) {
            // Perspetiva do inicial → vista do cliente (tua base em baixo)
            return {
                r: (rows - 1) - rowFromBottom,
                c: (totalCols - 1) - colFromRight
            };
        } else {
            // Somos o segundo: a nossa base (em baixo) é o topo para o servidor inicial
            // Logo mapeamos diretamente sem inversão
            return {
                r: rowFromBottom,
                c: colFromRight
            };
        }
    }

    function viewCellToServerIndex(r, c, totalCols) {
        const rows = S.rows;
        let rowFromBottom, colFromRight;

        if (S.isInitialMe) {
            // Cliente → servidor (inversão padrão)
            rowFromBottom = (rows - 1) - r;
            colFromRight = (totalCols - 1) - c;
        } else {
            // Somos o segundo: cliente em baixo = topo para servidor inicial
            // Mapeia diretamente
            rowFromBottom = r;
            colFromRight = c;
        }

        return rowFromBottom * totalCols + colFromRight;
    }



    function applyFixedOrientationIfNeeded() {
        const shouldFlip = (S.humanPlayerNum === 2);
        S.viewFlipped = shouldFlip;
        if (!!S.boardIsFlipped !== shouldFlip) {
            try { if (typeof UI.flipBoard === 'function') UI.flipBoard(); } catch { }
            S.boardIsFlipped = shouldFlip;
        }
    }

    function updateStatusPanel() {
        const who = (S.elements?.currentPlayerEl?.textContent || '').trim();
        const step = S.currentServerStep || '—';
        const dice = (S.lastDiceValue != null) ? String(S.lastDiceValue) : '—';
        if (typeof UI.setStatusPanel === 'function') {
            UI.setStatusPanel({ turnLabel: who || '—', stepLabel: step, diceLabel: dice });
        }
    }

    function handleUpdateMessage(ev) {
        let payload; try { payload = JSON.parse(ev.data); } catch { return; }
        const localNick = sessionStorage.getItem('tt_nick');

        // Dentro de handleUpdateMessage(ev):
        if (payload.initial) {
            sessionStorage.setItem('tt_initial', payload.initial);
            const isMe = (payload.initial.toLowerCase() === localNick.toLowerCase());
            S.humanPlayerNum = isMe ? 1 : 2;
            S.isInitialMe = isMe; // <<< importante
            console.log(`[PvP] Initial: P${S.humanPlayerNum}`);
        }

        // ...

        if (payload.players) {
            const playersMap = payload.players || {};
            const myColor = playersMap[localNick];
            if (myColor) {
                S.myServerColor = String(myColor).toLowerCase();
                S.oppServerColor = (S.myServerColor === 'red' ? 'blue' : 'red');
            }

            const initialNick = sessionStorage.getItem('tt_initial');
            const p1Color = playersMap[initialNick];
            S.serverColorInverted = (p1Color && String(p1Color).toLowerCase() === 'blue');

            if (!S.gameActive) {
                S.setGameActive(true);
                S.waitingForPair = false;
                if (UI.updatePlayLeaveButtons) UI.updatePlayLeaveButtons();
                if (window.clearMessages) window.clearMessages();
                Msg.system('msg_game_started');

                applyFixedOrientationIfNeeded();
                UI.renderBoard(S.getCols());
                updateStatusPanel();
                if (window.__refreshCaptured) window.__refreshCaptured();
            }
        }

        if (payload.turn !== undefined) {
            if (S.serverTurnNick !== payload.turn) {
                S.serverMustPass = false; S.serverDiceValue = null; S.lastDiceValue = null;
                try { TabStats.onTurnAdvance(); } catch { }
            }
            S.serverTurnNick = payload.turn;
            const isMyTurn = (S.serverTurnNick === localNick);
            S.currentPlayer = isMyTurn ? S.humanPlayerNum : (S.humanPlayerNum === 1 ? 2 : 1);
            if (S.elements.currentPlayerEl) S.elements.currentPlayerEl.textContent = isMyTurn ? 'EU' : S.serverTurnNick;
            Msg.system('msg_turn_of', { player: S.currentPlayer });
            UI.clearHighlights();
            if (S.selectedPiece) { S.selectedPiece.classList.remove('selected'); S.selectedPiece = null; }
            updatePvPControls();
        }

        if (payload.mustPass !== undefined) {
            S.serverMustPass = payload.mustPass;
            if (S.serverMustPass && S.serverTurnNick === localNick) Msg.system('msg_player_no_moves_pass');
            updatePvPControls();
        }

        if (payload.dice !== undefined) {
            if (payload.dice === null) {
                S.serverDiceValue = null; S.lastDiceValue = null;
            } else {
                const val = payload.dice.value;
                const keepPlaying = payload.dice.keepPlaying;
                S.serverDiceValue = val;

                Dice.showRemoteRoll(val).then(() => {
                    S.lastDiceValue = val;
                    const isMyTurn = (S.serverTurnNick === localNick);
                    const playerNum = isMyTurn ? S.humanPlayerNum : (S.humanPlayerNum === 1 ? 2 : 1);
                    Msg.player(playerNum, 'msg_dice_thrown', { value: val });
                    if (keepPlaying) {
                        if (val === 1) {
                            const conv = Rules.countConvertiblePieces(S, playerNum);
                            if (conv > 0) Msg.system('msg_dice_thrown_one', { n: conv });
                        }
                        Msg.system('msg_dice_thrown_double', { value: val });
                    }

                    if (isMyTurn && keepPlaying) {
                        const legalMoves = Rules.enumerateLegalMovesDOM(S, playerNum, val);
                        if (legalMoves.length === 0) {
                            Msg.system('msg_player_no_moves_extra');
                            S.serverDiceValue = null;
                            S.lastDiceValue = null;
                        }
                    }
                    updatePvPControls();
                    updateStatusPanel();
                });
            }
            updatePvPControls();
        }

        // Step pode vir mal definido; guardar como está ou null
        if (typeof payload.step === 'string') {
            S.currentServerStep = payload.step; // 'from' | 'to' | 'take'
        } else {
            S.currentServerStep = null;
        }

        if (payload.pieces) {
            updateBoardFromRemote(payload.pieces);
            if (S.selectedPiece) { S.selectedPiece.classList.remove('selected'); S.selectedPiece = null; }
            UI.clearHighlights();
        }

        if (Array.isArray(payload.selected)) {
            const cols = S.getCols();
            S.serverSelectedIndices = new Set(payload.selected);

            const isMyTurn = (S.serverTurnNick === localNick);
            if (!isMyTurn) {
                UI.clearHighlights();
                payload.selected.forEach(idx => {
                    const { r, c } = serverIndexToViewCell(idx, cols);
                    const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
                    if (cell) cell.classList.add('green-glow');
                });
            }
        }

        if (payload.winner) {
            const winnerNum = (payload.winner === localNick) ? S.humanPlayerNum : (S.humanPlayerNum === 1 ? 2 : 1);
            Msg.system('msg_player_won', { player: winnerNum });
            try { TabStats.setWinner(winnerNum); } catch { }
            Rules.endGame(S);
        }
        updatePvPControls();
        updateStatusPanel();
    }

    function onCellClick(r, c, cellDOM) {
        if (!S.gameActive) return;
        const localNick = sessionStorage.getItem('tt_nick');
        if (S.serverTurnNick !== localNick) return;

        const cols = S.getCols();
        const game = sessionStorage.getItem('tt_game');
        const password = sessionStorage.getItem('tt_password');

        let step = S.currentServerStep;
        if (!step || typeof step !== 'string') {
            step = S.selectedPiece ? 'to' : 'from';
        }

        const pieceInCell = cellDOM.querySelector('.piece');
        const isMyPiece = !!(pieceInCell && (
            (S.currentPlayer == 1 && pieceInCell.classList.contains('red')) ||
            (S.currentPlayer == 2 && pieceInCell.classList.contains('yellow'))
        ));

        if (step === 'from') {
            if (!isMyPiece) return;

            if (S.selectedPiece && S.selectedPiece !== pieceInCell) S.selectedPiece.classList.remove('selected');
            pieceInCell.classList.add('selected');
            S.selectedPiece = pieceInCell;

            UI.clearHighlights();
            const state = pieceInCell.getAttribute('move-state');
            const roll = parseInt(S.lastDiceValue, 10);
            const movesAllowed = (state === 'not-moved' && roll !== 1) ? [] : Rules.getValidMoves(S, pieceInCell);
            movesAllowed.forEach(dest => dest.classList.add('green-glow'));

            const fromIdxServer = viewCellToServerIndex(r, c, cols);
            console.debug('[PvP] FROM click', { r, c, fromIdxServer });
            Net.notify({ nick: localNick, password, game, cell: fromIdxServer })
                .catch(err => console.warn('notify error:', err));
            updateStatusPanel();
            return;
        }

        if (step === 'to' || step === 'take') {
            if (!S.selectedPiece) return;

            const destIdxServer = viewCellToServerIndex(r, c, cols);
            const serverOptions = S.serverSelectedIndices ? Array.from(S.serverSelectedIndices) : [];
            console.debug('[PvP] TO/TAKE click', { r, c, destIdxServer, serverOptions });

            if (!S.serverSelectedIndices || !S.serverSelectedIndices.has(destIdxServer)) {
                return;
            }

            const state = S.selectedPiece.getAttribute('move-state');
            const roll = parseInt(S.lastDiceValue, 10);
            if (state === 'not-moved' && roll !== 1) return;

            UI.clearHighlights();
            Net.notify({ nick: localNick, password, game, cell: destIdxServer })
                .catch(err => console.warn('notify error:', err));
            updateStatusPanel();
            return;
        }
    }

    function updatePvPControls() {
        const localNick = sessionStorage.getItem('tt_nick');
        const isMyTurn = (S.serverTurnNick === localNick);
        const awaitingRoll = (S.serverDiceValue === null);
        if (S.elements.throwBtn) {
            const canThrow = isMyTurn && awaitingRoll && !S.serverMustPass;
            S.elements.throwBtn.disabled = !canThrow;
        }
        if (S.elements.nextTurnBtn) S.elements.nextTurnBtn.disabled = !(isMyTurn && S.serverMustPass);
    }

    function updateBoardFromRemote(piecesArray) {
        if (!Array.isArray(piecesArray)) return;
        const allCells = document.querySelectorAll('.cell');
        allCells.forEach(cell => {
            const p = cell.querySelector('.piece'); if (p) p.remove();
            cell.classList.remove('green-glow', 'selected');
        });
        const cols = S.getCols();

        piecesArray.forEach((pieceData, index) => {
            if (!pieceData) return;
            const coords = serverIndexToViewCell(index, cols);
            const cell = document.querySelector(`.cell[data-r="${coords.r}"][data-c="${coords.c}"]`);
            if (!cell) return;

            const piece = document.createElement('div');
            piece.classList.add('piece');

            // TU SEMPRE VERMELHO na UI, ADVERSÁRIO AMARELO
            let srvColor = (pieceData.color || '').toLowerCase();
            let isMine = false;
            if (S.myServerColor) {
                isMine = (srvColor === S.myServerColor);
            } else {
                let serverColorAdj = srvColor;
                if (S.serverColorInverted) {
                    if (serverColorAdj === 'blue') serverColorAdj = 'red';
                    else if (serverColorAdj === 'red') serverColorAdj = 'blue';
                }
                isMine = (S.humanPlayerNum === 1 ? serverColorAdj === 'red' : serverColorAdj === 'blue');
            }

            if (isMine) piece.classList.add('red'); else piece.classList.add('yellow');

            let moveState = 'not-moved';
            if (pieceData.reachedLastRow) moveState = 'row-four';
            else if (pieceData.inMotion) moveState = 'moved';
            piece.setAttribute('move-state', moveState);

            cell.appendChild(piece);
        });

        S.redPieces = document.querySelectorAll('.piece.red').length;
        S.yellowPieces = document.querySelectorAll('.piece.yellow').length;
        updateStatusPanel();
    }

    function onThrow() {
        const n = sessionStorage.getItem('tt_nick'), p = sessionStorage.getItem('tt_password'), g = sessionStorage.getItem('tt_game');
        if (n && g) { S.elements.throwBtn.disabled = true; Net.roll({ nick: n, password: p, game: g }).catch(() => { S.elements.throwBtn.disabled = false; }); }
    }
    function onPass() {
        const n = sessionStorage.getItem('tt_nick'), p = sessionStorage.getItem('tt_password'), g = sessionStorage.getItem('tt_game');
        if (n && g) { S.elements.nextTurnBtn.disabled = true; Net.pass({ nick: n, password: p, game: g }); }
    }

    return { init, onThrow, onPass, onCellClick };
})();