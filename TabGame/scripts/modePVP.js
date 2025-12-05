window.PVPController = (function () {
    let S, UI, Msg, Dice, Net;

    // Estado de seleção e espera de confirmação do servidor
    let waitingServer = false;
    let allowedDestSet = null;      // Set de índices (servidor) válidos para o destino
    let selectedOrigin = null;      // { r, c, idx }

    function init(GameState, GameUI, Messages, DiceModule, Network) {
        S = GameState; UI = GameUI; Msg = Messages; Dice = DiceModule; Net = Network;

        const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
        const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
        if (!nick || !password) { alert("Auth required."); return; }

        S.vsPlayer = true; S.vsAI = false;
        S.serverSelectedIndices = new Set();
        S.myServerColor = null;

        waitingServer = false;
        allowedDestSet = null;
        selectedOrigin = null;

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

    // Mapeamento CONSISTENTE com servidor: top-left, row-major
    function viewCellToServerIndex(r, c, totalCols) { return r * totalCols + c; }
    function serverIndexToViewCell(index, totalCols) {
        const r = Math.floor(index / totalCols);
        const c = index % totalCols;
        return { r, c };
    }

    function handleUpdateMessage(ev) {
        let payload; try { payload = JSON.parse(ev.data); } catch { return; }
        const localNick = sessionStorage.getItem('tt_nick');

        if (payload.initial) {
            sessionStorage.setItem('tt_initial', payload.initial);
            const isMe = (payload.initial.toLowerCase() === localNick.toLowerCase());
            S.humanPlayerNum = isMe ? 1 : 2;
            console.log(`[PvP] Initial: P${S.humanPlayerNum}`);
        }

        if (payload.players) {
            const playersMap = payload.players || {};
            const myColor = playersMap[localNick];
            if (myColor) S.myServerColor = String(myColor).toLowerCase();

            if (!S.gameActive) {
                S.setGameActive(true);
                S.waitingForPair = false;
                if (UI.updatePlayLeaveButtons) UI.updatePlayLeaveButtons();
                if (window.clearMessages) window.clearMessages();
                Msg.system('msg_game_started');

                UI.renderBoard(S.getCols());
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

            // Reset seleção a cada mudança de turno
            clearSelection();

            UI.clearHighlights();
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

                    // Se é o meu turno e tenho extra, valida se há moves
                    if (isMyTurn && keepPlaying) {
                        const legalMoves = Rules.enumerateLegalMovesDOM(S, playerNum, val);
                        if (legalMoves.length === 0) {
                            Msg.system('msg_player_no_moves_extra');
                            S.serverDiceValue = null;
                            S.lastDiceValue = null;
                        }
                    }
                    updatePvPControls();
                });
            }
            updatePvPControls();
        }

        S.currentServerStep = (typeof payload.step === 'string') ? payload.step : null;

        if (Array.isArray(payload.selected)) {
            const cols = S.getCols();
            S.serverSelectedIndices = new Set(payload.selected);

            // Realçar sugestões do servidor apenas se NÃO for o meu turno (para não duplicar highlight)
            const isMyTurn = (S.serverTurnNick === localNick);
            if (!isMyTurn) {
                UI.clearHighlights();
                payload.selected.forEach(idx => {
                    const { r, c } = serverIndexToViewCell(idx, cols);
                    const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
                    if (cell) cell.classList.add('green-glow');
                });
            }
        } else {
            S.serverSelectedIndices = new Set();
        }

        if (payload.pieces) {
            updateBoardFromRemote(payload.pieces);
            waitingServer = false;

            // Após atualização do servidor, limpa seleção e highlights
            clearSelection();
            UI.clearHighlights();
        }

        if (payload.winner) {
            const winnerNum = (payload.winner === localNick) ? S.humanPlayerNum : (S.humanPlayerNum === 1 ? 2 : 1);
            Msg.system('msg_player_won', { player: winnerNum });
            try { TabStats.setWinner(winnerNum); } catch { }
            Rules.endGame(S);
        }

        updatePvPControls();
    }

    function onCellClick(r, c, cellDOM) {
        if (!S.gameActive || waitingServer) return;

        const localNick = sessionStorage.getItem('tt_nick');
        if (S.serverTurnNick !== localNick) return; // só jogas no teu turno

        const cols = S.getCols();
        const cellIndex = viewCellToServerIndex(r, c, cols);
        const game = sessionStorage.getItem('tt_game');
        const password = sessionStorage.getItem('tt_password');

        // Se servidor pede 'take', apenas destino
        if (S.currentServerStep === 'take') {
            waitingServer = true;
            Net.notify({ nick: localNick, password, game, cell: cellIndex })
                .catch(err => { waitingServer = false; console.warn('notify error:', err); });
            return;
        }

        const pieceInCell = cellDOM.querySelector('.piece');
        const isMyPiece = !!(pieceInCell && (
            (S.currentPlayer == 1 && pieceInCell.classList.contains('red')) ||
            (S.currentPlayer == 2 && pieceInCell.classList.contains('yellow'))
        ));

        // 1) NADA selecionado ainda: selecionar peça minha (FROM)
        if (!S.selectedPiece) {
            if (!isMyPiece) return;
            selectPieceAt(r, c, pieceInCell);

            // envia FROM ao servidor
            Net.notify({ nick: localNick, password, game, cell: cellIndex })
                .catch(err => console.warn('notify error (from):', err));
            return;
        }

        // 2) Já existe uma seleção
        // a) Se clicaste na mesma origem, des-seleciona
        if (selectedOrigin && selectedOrigin.idx === cellIndex) {
            clearSelection();
            UI.clearHighlights();
            return;
        }

        // b) Clicaste noutra peça tua -> muda seleção
        if (isMyPiece) {
            selectPieceAt(r, c, pieceInCell);
            Net.notify({ nick: localNick, password, game, cell: cellIndex })
                .catch(err => console.warn('notify error (from-switch):', err));
            return;
        }

        // c) Clicaste num destino potencial -> só aceita se for destino válido
        const serverAllows = S.serverSelectedIndices && S.serverSelectedIndices.has(cellIndex);
        const localAllows = allowedDestSet && allowedDestSet.has(cellIndex);
        if (!(serverAllows || localAllows)) return;

        // Envia TO ao servidor, NÃO move localmente. Aguarda payload.pieces.
        waitingServer = true;
        Net.notify({ nick: localNick, password, game, cell: cellIndex })
            .then(() => {
                // aguardamos update 'pieces' para refletir o movimento
            })
            .catch(err => { waitingServer = false; console.warn('notify error (to):', err); });
    }

    function selectPieceAt(r, c, pieceEl) {
        if (S.selectedPiece) S.selectedPiece.classList.remove('selected');
        pieceEl.classList.add('selected');
        S.selectedPiece = pieceEl;

        selectedOrigin = { r, c, idx: viewCellToServerIndex(r, c, S.getCols()) };

        UI.clearHighlights();
        allowedDestSet = new Set();

        const roll = parseInt(S.lastDiceValue, 10);
        // regra Tâb: não sai da base sem 1
        const state = pieceEl.getAttribute('move-state');
        if (state === 'not-moved' && roll !== 1) return;

        const movesAllowed = Rules.getValidMoves(S, pieceEl, roll);
        movesAllowed.forEach(dest => {
            dest.classList.add('green-glow');
            const dr = parseInt(dest.dataset.r, 10);
            const dc = parseInt(dest.dataset.c, 10);
            allowedDestSet.add(viewCellToServerIndex(dr, dc, S.getCols()));
        });
    }

    function clearSelection() {
        if (S.selectedPiece) {
            S.selectedPiece.classList.remove('selected');
            S.selectedPiece = null;
        }
        selectedOrigin = null;
        allowedDestSet = null;
    }

    function updatePvPControls() {
        const localNick = sessionStorage.getItem('tt_nick');
        const isMyTurn = (S.serverTurnNick === localNick);
        const awaitingRoll = (S.serverDiceValue === null);
        if (S.elements.throwBtn) {
            const canThrow = isMyTurn && awaitingRoll && !S.serverMustPass && !waitingServer;
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
            const { r, c } = serverIndexToViewCell(index, cols);
            const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
            if (!cell) return;

            const piece = document.createElement('div');
            piece.classList.add('piece');

            // Minhas vermelhas, oponente amarelas, conforme cor do servidor
            const srvColor = String(pieceData.color || '').toLowerCase();
            const isMine = (S.myServerColor && srvColor === S.myServerColor);
            piece.classList.add(isMine ? 'red' : 'yellow');

            let moveState = 'not-moved';
            if (pieceData.reachedLastRow) moveState = 'row-four';
            else if (pieceData.inMotion) moveState = 'moved';
            piece.setAttribute('move-state', moveState);

            cell.appendChild(piece);
        });

        S.redPieces = document.querySelectorAll('.piece.red').length;
        S.yellowPieces = document.querySelectorAll('.piece.yellow').length;
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