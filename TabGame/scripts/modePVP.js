// PvP controller: uses Network and handles server payloads only here.

window.PVPController = (function () {
    let S, UI, Msg, Dice, Net;

    function init(GameState, GameUI, Messages, DiceModule, Network) {
        S = GameState; UI = GameUI; Msg = Messages; Dice = DiceModule; Net = Network;

        const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
        const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
        if (!nick || !password) {
            alert("Auth required."); return;
        }

        S.vsPlayer = true; S.vsAI = false;
        if (UI.updatePlayLeaveButtons) UI.updatePlayLeaveButtons();
        Msg.system('msg_waiting_opponent');

        const size = S.getCols();
        const group = 36;
        console.log(`[PvP] Grupo: ${group}`);

        Network.join({ group, nick, password, size }).then(joinResult => {
            if (joinResult.game) {
                const gameId = joinResult.game;
                console.log(`[PvP] Game ID: ${gameId}`);
                sessionStorage.setItem('tt_game', gameId);
                window.currentGameId = gameId;

                if (window.updateEventSource) window.updateEventSource.close();
                window.updateEventSource = Network.createUpdateEventSource({ nick, game: gameId });
                window.updateEventSource.onmessage = handleUpdateMessage;
            }
        }).catch(err => {
            console.warn(err); S.setGameActive(false); UI.updatePlayLeaveButtons();
        });
    }

    // --- HELPERS SIMPLIFICADOS ---
    // Como o renderBoard já mapeou o HTML corretamente, 
    // a célula com data-r="0" é a linha 0, não importa onde está no ecrã.
    
    function localToServerIndex(r, c, totalCols) {
        // Cálculo direto: Servidor espera 0 no canto inferior direito do P1.
        // Ou seja, Row 3 Lógica = Index Baixo.
        // Row 0 Lógica = Index Alto.
        const rowFromBottom = (S.rows - 1) - r;
        const colFromRight = (totalCols - 1) - c;
        return rowFromBottom * totalCols + colFromRight;
    }

    function serverIndexToLocalCell(index, totalCols) {
        const rowFromBottom = Math.floor(index / totalCols);
        const colFromRight = index % totalCols;
        const r = 3 - rowFromBottom;
        const c = (totalCols - 1) - colFromRight;
        return { r, c };
    }

    // --- HANDLER ---

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
            // Detetar inversão de cores
            const initialNick = sessionStorage.getItem('tt_initial');
            const p1Color = payload.players[initialNick];
            S.serverColorInverted = (p1Color && p1Color.toLowerCase() === 'blue');

            // Arrancar Jogo
            if (!S.gameActive) {
                S.setGameActive(true);
                S.waitingForPair = false;
                if (UI.updatePlayLeaveButtons) UI.updatePlayLeaveButtons();
                if (window.clearMessages) window.clearMessages();
                Msg.system('msg_game_started');
                
                // IMPORTANTÍSSIMO: Se sou P2, tenho de redesenhar o tabuleiro 
                // para aplicar a perspetiva correta (amarelas em baixo).
                if (S.humanPlayerNum === 2) {
                    UI.renderBoard(S.getCols());
                }
                if (window.__refreshCaptured) window.__refreshCaptured();
            }
        }

        // Resto das propriedades igual (Game, Turn, Dice...)
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
                if (S.lastDiceValue !== val) {
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
                        // Re-roll deadlock fix
                        if (isMyTurn && keepPlaying) {
                            const legalMoves = Rules.enumerateLegalMovesDOM(S, playerNum, val);
                            if (legalMoves.length === 0) {
                                Msg.system('msg_player_no_moves_extra');
                                S.serverDiceValue = null; S.lastDiceValue = null;
                            }
                        }
                        updatePvPControls();
                    });
                } else {
                    S.lastDiceValue = val;
                }
            }
            updatePvPControls();
        }

        if (payload.step) S.currentServerStep = payload.step;

        if (payload.pieces) {
            const initialNick = payload.initial || sessionStorage.getItem('tt_initial');
            updateBoardFromRemote(payload.pieces, initialNick);
        }

        if (payload.selected) {
            if (!payload.pieces) UI.clearHighlights();
            payload.selected.forEach(idx => {
                const { r, c } = serverIndexToLocalCell(idx, S.getCols());
                const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
                if (cell) cell.classList.add('green-glow');
            });
        }

        if (payload.winner) {
            const winnerNum = (payload.winner === localNick) ? S.humanPlayerNum : (S.humanPlayerNum === 1 ? 2 : 1);
            Msg.system('msg_player_won', { player: winnerNum });
            try { TabStats.setWinner(winnerNum); } catch { }
            Rules.endGame(S);
        }
        updatePvPControls();
    }

    // ... (onThrow, onPass, onCellClick iguais, mas o onCellClick já usa os helpers simples) ...
    // A única coisa a confirmar no onCellClick é o uso dos helpers.
    
    function onCellClick(r, c, cellDOM) {
        if (!S.gameActive) return;
        const localNick = sessionStorage.getItem('tt_nick');
        if (S.serverTurnNick !== localNick) return;

        const cols = S.getCols();
        const cellIndex = localToServerIndex(r, c, cols); // Helper simples!
        const game = sessionStorage.getItem('tt_game');
        const password = sessionStorage.getItem('tt_password');

        if (S.currentServerStep === 'take') {
            Net.notify({ nick: localNick, password, game, cell: cellIndex });
            return;
        }

        const pieceInCell = cellDOM.querySelector('.piece');
        const isMyPiece = !!(pieceInCell && ((S.currentPlayer == 1 && pieceInCell.classList.contains('red')) || (S.currentPlayer == 2 && pieceInCell.classList.contains('yellow'))));

        if (isMyPiece) {
            // Seleção visual...
            if (S.selectedPiece) S.selectedPiece.classList.remove('selected');
            pieceInCell.classList.add('selected');
            S.selectedPiece = pieceInCell;
            UI.clearHighlights();
            const roll = parseInt(S.lastDiceValue, 10);
            const moves = Rules.getValidMoves(S, pieceInCell); // Lógica nativa funciona pq HTML tem coordenadas lógicas
            moves.forEach(d => d.classList.add('green-glow'));
            
            Net.notify({ nick: localNick, password, game, cell: cellIndex });
            return;
        }

        if (S.selectedPiece) {
            // Movimento...
            Net.notify({ nick: localNick, password, game, cell: cellIndex }).then(() => {
                const movedValue = parseInt(S.lastDiceValue, 10);
                const state = S.selectedPiece.getAttribute('move-state');
                if (state === 'not-moved' && movedValue === 1) S.selectedPiece.setAttribute('move-state', 'moved');
                UI.movePieceTo(S.selectedPiece, cellDOM);
                UI.clearHighlights();
                S.selectedPiece.classList.remove('selected');
                S.selectedPiece = null;
                S.lastDiceValue = null;
                updatePvPControls();
            });
        }
    }

    function updatePvPControls() {
        const localNick = sessionStorage.getItem('tt_nick');
        const isMyTurn = (S.serverTurnNick === localNick);
        const awaitingRoll = (S.serverDiceValue === null);
        if (S.elements.throwBtn) {
            const canThrow = isMyTurn && awaitingRoll && !S.serverMustPass && (S.currentServerStep !== 'take' && S.currentServerStep !== 'to');
            S.elements.throwBtn.disabled = !canThrow;
        }
        if (S.elements.nextTurnBtn) S.elements.nextTurnBtn.disabled = !(isMyTurn && S.serverMustPass);
    }

    function updateBoardFromRemote(piecesArray, initialNick) {
        if (!Array.isArray(piecesArray)) return;
        const allCells = document.querySelectorAll('.cell');
        allCells.forEach(cell => {
            const p = cell.querySelector('.piece'); if (p) p.remove();
            cell.classList.remove('green-glow', 'selected');
        });
        const cols = S.getCols();

        piecesArray.forEach((pieceData, index) => {
            if (!pieceData) return;
            const coords = serverIndexToLocalCell(index, cols);
            const cell = document.querySelector(`.cell[data-r="${coords.r}"][data-c="${coords.c}"]`);
            if (!cell) return;

            const piece = document.createElement('div');
            piece.classList.add('piece');
            let serverColor = (pieceData.color || '').toLowerCase();
            if (S.serverColorInverted) {
                if (serverColor === 'blue') serverColor = 'red'; else if (serverColor === 'red') serverColor = 'blue';
            }
            if (serverColor === 'red') piece.classList.add('red'); else piece.classList.add('yellow');
            let moveState = 'not-moved';
            if (pieceData.reachedLastRow) moveState = 'row-four'; else if (pieceData.inMotion) moveState = 'moved';
            piece.setAttribute('move-state', moveState);
            cell.appendChild(piece);
        });
        S.redPieces = document.querySelectorAll('.piece.red').length;
        S.yellowPieces = document.querySelectorAll('.piece.yellow').length;
    }

    function onThrow() { /* igual ao anterior */ 
        const n=sessionStorage.getItem('tt_nick'), p=sessionStorage.getItem('tt_password'), g=sessionStorage.getItem('tt_game');
        if(n&&g) { S.elements.throwBtn.disabled=true; Net.roll({nick:n,password:p,game:g}).catch(()=>{S.elements.throwBtn.disabled=false;}); }
    }
    function onPass() { 
        const n=sessionStorage.getItem('tt_nick'), p=sessionStorage.getItem('tt_password'), g=sessionStorage.getItem('tt_game');
        if(n&&g) { S.elements.nextTurnBtn.disabled=true; Net.pass({nick:n,password:p,game:g}); }
    }

    return { init, onThrow, onPass, onCellClick };
})();