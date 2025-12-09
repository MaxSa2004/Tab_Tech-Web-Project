// DOMContentLoaded ensures that all html is loaded before script runs
document.addEventListener("DOMContentLoaded", () => {
    const widthSelect = document.getElementById('width');
    const gameBoard = document.getElementById('gameBoard');
    const messagesEl = document.getElementById('messages');
    const currentPlayerEl = document.getElementById('currentPlayer');
    const nextTurnBtn = document.getElementById('nextTurn');
    const throwBtn = document.getElementById('throwDiceBtn'); // mover para o topo
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
    let waitingForPair = false;
    let serverInitialNick = null;
    let serverStep = null;
    let shownOpponentNick = null;
    let onlineSourceCell = null; // cell selected in online mode
    let isBoardFlipped = false;

    // AI state and mode
    let gameMode = 'player';      // 'player' | 'ia'
    let vsAI = false;   // true if playing against AI
    let aiDifficulty = 'normal';  // 'easy' | 'normal' | 'hard'
    let aiPlayerNum = null;       // 1 (red) ou 2 (yellow)
    let humanPlayerNum = 1;    // 1 (red) ou 2 (yellow) || 1 is default

    // pieces
    let redPieces = 0;
    let yellowPieces = 0;
    let selectedPiece = null;

    // dice
    let lastDiceValue = null;

    // helper function to get color by player number
    function getColorForPlayerNum(n) { return n === 1 ? 'red' : 'yellow'; }
    // helper function to check if it's human's turns
    function isHumanTurn() {
        return !vsAI || currentPlayer !== aiPlayerNum;
    }

    // config validation helper
    function isConfigValid() {
        const modeVal = modeSelect ? modeSelect.value : '';
        if (modeVal !== 'player' && modeVal !== 'ia') return false;
        if (modeVal === 'ia') {
            const diff = iaLevelSelect ? iaLevelSelect.value : '';
            if (!['easy', 'normal', 'hard'].includes(diff)) return false;
        }
        return true;
    }
    // helper to enable/disable config UI during game or not
    function setConfigEnabled(enabled) {
        if (widthSelect) widthSelect.disabled = !enabled;
        if (modeSelect) modeSelect.disabled = !enabled;
        if (iaLevelSelect) iaLevelSelect.disabled = !enabled;
        if (firstToPlayCheckbox) firstToPlayCheckbox.disabled = !enabled;
    }
    // helper to update play and leave button state based on config validity and game state (if playing, play button disabled and leave button enabled, else the opposite)
    function updatePlayButtonState() {
        if (!playButton) return;
        playButton.disabled = !isConfigValid() || gameActive === true;
        if (leaveButton) leaveButton.disabled = !gameActive;
    }
    // helper: get localized labels for captured panels
    function getLocalizedLabelsForPanels() {
        const lang = window.currentLang || 'pt';
        const dict = (typeof i18n !== 'undefined' ? i18n : window.i18n) || {};
        const L = dict[lang] || dict.en || {};
        // get labels with fallbacks
        const player1Label = L.player1 || (lang === 'pt' ? 'Jogador 1' : 'Player 1');
        const player2Label = (lang === 'pt' ? 'Jogador 2' : 'Player 2');
        // AI label based on difficulty
        const aiKey = (aiDifficulty === 'easy') ? 'easyIA'
            : (aiDifficulty === 'hard') ? 'hardIA'
                : 'normalIA';
        const aiLabel =
            L[aiKey] ||
            (lang === 'pt'
                ? `IA (${aiDifficulty === 'easy' ? 'Fácil' : aiDifficulty === 'hard' ? 'Difícil' : 'Normal'})`
                : `AI (${aiDifficulty[0].toUpperCase()}${aiDifficulty.slice(1)})`);

        return { player1Label, player2Label, aiLabel }; // return labels
    }

    // update captured panels titles based on mode and localization
    function refreshCapturedTitles() {
        const elP1 = document.getElementById('capTitleP1'); // (capturedP1)
        const elP2 = document.getElementById('capTitleP2'); // (capturedP2)
        if (!elP1 || !elP2) return; // skip

        const { player1Label, player2Label, aiLabel } = getLocalizedLabelsForPanels();

        if (vsAI) { // PvE mode
            if (aiPlayerNum === 1) {
                elP1.textContent = aiLabel;
                elP2.textContent = player1Label;
            } else { // aiPlayerNum === 2
                elP1.textContent = player1Label;
                elP2.textContent = aiLabel;
            }
        } else {
            // PvP 
            elP1.textContent = player1Label;
            elP2.textContent = player2Label;
        }
    }

    // expose refreshCapturedTitles globally
    window.__refreshCaptured = refreshCapturedTitles;

    // Destaca células visualmente (converte índice linear para DOM)
    function highlightCell(index, type) {
        const cols = parseInt(widthSelect.value, 10);
        const r = Math.floor(index / cols);
        const c = index % cols;
        const cell = gameBoard.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);

        if (!cell) return;

        if (type === 'selected') {
            // Destacar a peça selecionada (origem)
            const piece = cell.querySelector('.piece');
            if (piece) piece.classList.add('selected');
        } else if (type === 'green-glow') {
            // Destacar destino válido
            cell.classList.add('green-glow');
        } else if (type === 'red-glow') {
            // Destacar alvo de captura (se implementado visualmente no CSS)
            cell.classList.add('green-glow'); // Reutiliza green-glow se não houver CSS para red
            cell.style.boxShadow = "inset 0 0 15px red"; // Fallback inline
        }
    }

    // Gere o fim do jogo online
    function handleOnlineWinner(winnerNick, myNick) {
        // IMPORTANTE: Fechar a conexão SSE imediatamente
        Network.stopUpdateEventSource();

        console.log("Fim de jogo. Vencedor:", winnerNick);

        if (winnerNick === null) {
            showMessage({ who: 'system', text: 'O jogo terminou empatado (ou cancelado).' });
        } else if (winnerNick === myNick) {
            showMessage({ who: 'system', key: 'msg_you_won' });
        } else {
            showMessage({ who: 'system', key: 'msg_you_lost', params: { winner: winnerNick } });
        }

        // Reset de interface
        gameActive = false;
        waitingForPair = false;
        serverStep = null;
        onlineSourceCell = null;

        if (nextTurnBtn) nextTurnBtn.disabled = true;
        if (throwBtn) throwBtn.disabled = true;

        // Reativar botões de configuração
        setConfigEnabled(true);
        playButton.disabled = !isConfigValid();
        leaveButton.disabled = true;
    }

    // --- LÓGICA DE COORDENADAS (SNAKE) ---

    /// --- LÓGICA DE COORDENADAS (SNAKE - Baseado no OnlineController) ---

    // --- LÓGICA DE COORDENADAS (SNAKE + ROTAÇÃO) ---

    // 1. Converter (Linha/Coluna Visual) -> (Linha/Coluna Lógica do Servidor)
    function getLogicalCoords(visualR, visualC) {
        const cols = parseInt(widthSelect.value, 10);
        
        if (isBoardFlipped) {
            // Se o tabuleiro está rodado (sou P2):
            // O meu Visual Baixo (3) corresponde ao Lógico Topo (0) do servidor
            return {
                r: 3 - visualR,
                c: (cols - 1) - visualC
            };
        }
        // Se não está rodado (sou P1): Visual = Lógico
        return { r: visualR, c: visualC };
    }

    // 2. Converter (Linha/Coluna Lógica) -> Visual
    function getVisualCoords(logicalR, logicalC) {
        const cols = parseInt(widthSelect.value, 10);
        
        if (isBoardFlipped) {
            return {
                r: 3 - logicalR,
                c: (cols - 1) - logicalC
            };
        }
        return { r: logicalR, c: logicalC };
    }

    // 3. Converter (Linha/Coluna Lógica) -> Índice Linear do Servidor (Snake)
    // Baseado estritamente no OnlineController.js do professor
    function getIndexFromLogical(r, c) {
        const cols = parseInt(widthSelect.value, 10);
        let indexBase = 0;

        if (r === 3) indexBase = 0;          // Fundo (Home P1)
        if (r === 2) indexBase = cols;       // Linha 2
        if (r === 1) indexBase = 2 * cols;   // Linha 1
        if (r === 0) indexBase = 3 * cols;   // Topo (Home P2)

        let offset = c;
        // Inversão Snake nas linhas 0 e 2
        if (r === 2 || r === 0) {
            offset = (cols - 1) - c;
        }
        
        return indexBase + offset;
    }

    // 4. Inverso: Índice Servidor -> Lógico
    function getLogicalFromIndex(index) {
        const cols = parseInt(widthSelect.value, 10);
        const rowIdx = Math.floor(index / cols); 
        const offset = index % cols;
        
        let r = 3 - rowIdx; 
        let c = offset;
        
        if (r === 2 || r === 0) {
            c = (cols - 1) - offset;
        }
        
        return { r, c };
    }

    // Helper para desenhar o tabuleiro com dados do servidor
    // Helper para desenhar o tabuleiro online
    function renderOnlineBoard(pieces) {
        const cols = parseInt(widthSelect.value, 10);
        const myServerColor = document.body.dataset.myColor; // 'Blue' ou 'Red'

        // Limpar
        gameBoard.querySelectorAll('.piece').forEach(p => p.remove());

        pieces.forEach((pieceObj, serverIndex) => {
            if (!pieceObj) return;

            // 1. Descobrir posição lógica
            const logical = getLogicalFromIndex(serverIndex);
            // 2. Converter para visual (aplica rotação se necessário)
            const visual = getVisualCoords(logical.r, logical.c);

            const cell = gameBoard.querySelector(`.cell[data-r="${visual.r}"][data-c="${visual.c}"]`);
            if (!cell) return;

            // 3. Decidir Cor Visual (Relativa)
            let cssColor;
            if (pieceObj.color === myServerColor) {
                cssColor = 'red';
            } else {
                cssColor = 'yellow';
            }
            
            // --- CORREÇÃO DO ESTADO DA PEÇA ---
            let moveState = 'moved'; // Default
            
            if (pieceObj.reachedLastRow) {
                moveState = 'row-four';
            } else if (pieceObj.inMotion === false) {
                // SE inMotion É FALSE, ESTÁ NA BASE -> 'not-moved'
                // Antes estava 'moved', o que causava o erro do 6 bloqueado
                moveState = 'not-moved'; 
            } else {
                moveState = 'moved';
            }

            const newPiece = document.createElement('div');
            newPiece.classList.add('piece', cssColor);
            newPiece.setAttribute('move-state', moveState);
            
            if (onlineSourceCell === serverIndex) {
                newPiece.classList.add('selected');
            }

            cell.appendChild(newPiece);
        });
    }
    function highlightCell(serverIndex, type) {
        const logical = getLogicalFromIndex(serverIndex);
        const visual = getVisualCoords(logical.r, logical.c);

        const cell = gameBoard.querySelector(`.cell[data-r="${visual.r}"][data-c="${visual.c}"]`);
        if (!cell) return;

        if (type === 'selected') {
            const piece = cell.querySelector('.piece');
            if (piece) piece.classList.add('selected');
        } 
        else if (type === 'green-glow') {
            cell.classList.add('green-glow');
        } 
        else if (type === 'red-glow') {
            cell.classList.add('red-glow'); 
            cell.style.boxShadow = "inset 0 0 15px rgba(255, 0, 0, 0.8)";
            cell.style.cursor = "pointer";
        }
    }
    // Verifica se existem movimentos possíveis para o valor do dado (Modo Online)
    function checkOnlineMovesAvailable(diceValue) {
        // No modo relativo, "as minhas peças" são sempre renderizadas como 'red' (baixo)
        // independentemente se sou Blue ou Red no servidor.
        const myPieces = Array.from(document.querySelectorAll('.piece.red'));

        for (const piece of myPieces) {
            const state = piece.getAttribute('move-state');
            if (state === 'not-moved' && diceValue !== 1) continue;
            const moves = getValidMoves(piece, diceValue); 
            if (moves.length > 0) return true;
        }
        return false;
    }
    // server data handler 
    // server data handler 
    // server data handler 
    async function dataHandler(data) {
        console.log("📥 [SERVER UPDATE]:", data);

        if (!data) return;
        if (!gameActive && (data.turn || data.pieces)) gameActive = true;

        const myNick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');

        // Erros
        if (data.error) {
            console.warn('Server error:', data.error);
            showMessage({ who: 'system', text: data.error });
            // Se der erro de "já lançaste", garante que os botões ficam certos
            if (data.error.includes("already rolled")) {
                if (throwBtn) throwBtn.disabled = true;
            }
            return;
        }

        if (data.ranking) window.updatePvPLeaderboard(data.ranking);

        // Cor e Rotação
        // ...
        // 3. Jogadores e Rotação
        if (data.players) {
            const myServerColor = data.players[myNick];
            if (myServerColor) {
                document.body.dataset.myColor = myServerColor;
                // SE SOU RED (P2), RODO O TABULEIRO
                isBoardFlipped = (myServerColor === 'Red'); 
            }
        }
        // ...

        // --- DADOS (DICE) COM CORREÇÃO DE BLOQUEIO ---
        if (data.dice !== undefined) {
            if (data.dice && data.dice.value) {
                lastDiceValue = data.dice.value;
                if (window.tabGame && window.tabGame.spawnAndLaunch) {
                    window.tabGame.spawnAndLaunch(data.dice.value);
                }

                // Lógica de Desbloqueio
                if (data.turn === myNick) {
                    const canMove = checkOnlineMovesAvailable(data.dice.value);
                    const keepPlaying = data.dice.keepPlaying; // true se for 1, 4 ou 6

                    if (canMove) {
                        // Fluxo Normal: Tem jogada -> Bloqueia tudo até mover
                        if (throwBtn) throwBtn.disabled = true;
                        if (nextTurnBtn) nextTurnBtn.disabled = true;
                        showMessage({ who: 'system', key: 'msg_dice_value', params: { value: data.dice.value } });
                    } else {
                        // Sem jogada (ex: Saiu 6 na base)
                        if (keepPlaying) {
                            // Tem extra (6,4,1) -> DEIXA LANÇAR DE NOVO
                            showMessage({ who: 'system', text: `Saiu ${data.dice.value} mas não tens movimentos. Lança novamente!` });
                            if (throwBtn) throwBtn.disabled = false; // <--- AQUI ESTÁ A CORREÇÃO
                            if (nextTurnBtn) nextTurnBtn.disabled = true;
                            // Resetar o lastDiceValue para permitir o clique no botão (handler do clique verifica null)
                            // Nota: No handler do clique, não verificamos lastDiceValue no online, apenas enviamos Network.roll()
                        } else {
                            // Não tem extra (2,3,5) -> TEM DE PASSAR
                            showMessage({ who: 'system', text: `Sem movimentos com ${data.dice.value}. Passa a vez.` });
                            if (throwBtn) throwBtn.disabled = true;
                            if (nextTurnBtn) nextTurnBtn.disabled = false;
                        }
                    }
                }

            } else {
                lastDiceValue = null;
            }
        }

        // Peças
        if (data.pieces) renderOnlineBoard(data.pieces);

        // Vitória
        if (data.winner !== undefined) {
            handleOnlineWinner(data.winner, myNick);
            return;
        }

        // Turno
        if (data.turn) {
            const previousTurn = document.body.dataset.lastTurn;
            const isMyTurn = data.turn === myNick;

            if (previousTurn !== data.turn) lastDiceValue = null;

            document.body.dataset.lastTurn = data.turn;
            if (currentPlayerEl) currentPlayerEl.textContent = (isMyTurn) ? "TU" : data.turn;

            if (data.mustPass) {
                if (data.mustPass === myNick) {
                    showMessage({ who: 'system', text: 'Sem movimentos. Tens de passar.' });
                    if (nextTurnBtn) nextTurnBtn.disabled = false;
                    if (throwBtn) throwBtn.disabled = true;
                }
            } else if (isMyTurn) {
                // Se é minha vez e não tenho dado (ou acabei de desbloquear acima), ativo botão
                // Nota: A lógica do dice acima já tratou do estado disabled/enabled se recebemos dados.
                // Aqui tratamos apenas do início do turno limpo.
                if (lastDiceValue === null) {
                    if (throwBtn) throwBtn.disabled = false;
                    if (nextTurnBtn) nextTurnBtn.disabled = true;
                    if (previousTurn !== data.turn) showMessage({ who: 'system', key: 'msg_your_turn' });
                }
            } else {
                if (throwBtn) throwBtn.disabled = true;
                if (nextTurnBtn) nextTurnBtn.disabled = true;
            }
        }

        // Passos
        if (data.step) {
            serverStep = data.step;
            clearHighlights();
            if (serverStep === 'from') {
                onlineSourceCell = null;
                if (data.selected) data.selected.forEach(idx => highlightCell(idx, 'green-glow'));
            } else if (serverStep === 'to') {
                if (data.cell !== undefined) {
                    onlineSourceCell = data.cell;
                    highlightCell(data.cell, 'selected');
                }
                if (data.selected) data.selected.forEach(idx => highlightCell(idx, 'green-glow'));
            } else if (serverStep === 'take') {
                showMessage({ who: 'system', text: 'CAPTURA: Clica na peça do adversário!' });
                if (data.selected) data.selected.forEach(idx => highlightCell(idx, 'red-glow'));
            }
        }
    }

    // leave button click handler
    leaveButton.addEventListener('click', async () => {
        if (!gameActive) return; // if game is not active, do nothing (safety check, because it's disabled in that case)

        // Helpers to obtain localized player labels for leaderboard update
        const lang = window.currentLang || 'pt'; // default to 'pt' if not set
        const dict = (typeof i18n !== 'undefined' ? i18n : window.i18n) || {}; // access i18n dictionary in languageScript
        const L = dict[lang] || dict.en || {}; // fallback to English if current language not found

        const player1Label = L.player1 || (lang === 'pt' ? 'Jogador 1' : 'Player 1'); // Player 1/Jogador 1
        const aiLabel = (() => { // AI label based on difficulty
            const key = aiDifficulty === 'easy' ? 'easyIA'
                : aiDifficulty === 'hard' ? 'hardIA'
                    : 'normalIA';
            return L[key] || // IA (Fácil)/AI (Easy) etc. 
                (lang === 'pt'
                    ? `IA (${aiDifficulty === 'easy' ? 'Fácil' : aiDifficulty === 'hard' ? 'Difícil' : 'Normal'})` // IA (Fácil/Difícil/Normal)
                    : `AI (${aiDifficulty[0].toUpperCase()}${aiDifficulty.slice(1)})`); // AI (Easy/Normal/Hard)
        })();

        let winnerName = '';
        let loserName = '';
        let winnerNum = null;

        if (vsAI) { // PvE mode
            // The player clicks leave, so the AI wins
            winnerName = aiLabel;
            loserName = player1Label;
            winnerNum = aiPlayerNum || 2;
        } else {
            // PvP : the other player wins (not implemented yet)
            if (currentPlayer === 1) {
                winnerName = lang === 'pt' ? 'Jogador 2' : 'Player 2';
                loserName = lang === 'pt' ? 'Jogador 1' : 'Player 1';
                winnerNum = 2;
            } else {
                winnerName = lang === 'pt' ? 'Jogador 1' : 'Player 1';
                loserName = lang === 'pt' ? 'Jogador 2' : 'Player 2';
                winnerNum = 1;
            }
            try {
                Network.leave();
            } catch (err) {
                showMessage({ who: 'system', text: err.message });
                return;
            }
        }

        // Update leaderboard (winner GW+GP, loser GP) while leaving
        window.updateLeaderboard(winnerName, loserName);

        // Update TabStats to show summary with the winner before resetting
        TabStats.setWinner(winnerNum);
        TabStats.showSummary();

        // system message that the player has left the game
        showMessage({ who: 'system', key: 'msg_leave_game', params: { player: currentPlayer } });

        // Reset game state & UI
        gameActive = false;
        currentPlayer = 1;
        selectedPiece = null;
        lastDiceValue = null;
        aiPlayerNum = null;
        humanPlayerNum = 1;

        refreshCapturedTitles(); // reset captured titles

        if (capturedP1) capturedP1.innerHTML = '';
        if (capturedP2) capturedP2.innerHTML = '';

        if (nextTurnBtn) nextTurnBtn.disabled = true;
        if (throwBtn) throwBtn.disabled = true;

        setConfigEnabled(true);
        playButton.disabled = !isConfigValid();
        leaveButton.disabled = true;

        renderBoard(parseInt(widthSelect.value, 10));
        updatePlayButtonState();
        clearMessages();
    });

    if (modeSelect) modeSelect.addEventListener('change', updatePlayButtonState); // update play button state on mode change, if mode is PvP, else waits for AI level
    if (iaLevelSelect) iaLevelSelect.addEventListener('change', updatePlayButtonState); // update play button state on AI level change, to Start Game
    updatePlayButtonState(); // initial state

    // ---- RENDER BOARD ----
    function renderBoard(cols) {
        redPieces = cols;
        yellowPieces = cols;
        gameBoard.style.setProperty('--cols', cols); // set style property of cols to be --cols (editable in style.css)
        gameBoard.innerHTML = ''; // clear html content of gameBoard as we will need to generate the board in next loop

        // generate the board
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // create cell
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.r = r;
                cell.dataset.c = c;

                // place arrow in cell accordingly
                const arrow = document.createElement('i');
                if (r === 0) arrow.className = 'arrow ' + (c === 0 ? 'down' : 'left');
                else if (r === 1) arrow.className = 'arrow ' + (c === cols - 1 ? 'up down' : 'right');
                else if (r === 2) arrow.className = 'arrow ' + (c === 0 ? 'up' : 'left');
                else if (r === 3) arrow.className = 'arrow ' + (c === cols - 1 ? 'up' : 'right');

                // place initial pieces
                const piece = document.createElement('div');
                piece.setAttribute('move-state', 'not-moved');
                piece.classList.add('piece');

                if (r == 0) { piece.classList.add('yellow'); cell.appendChild(piece); }
                if (r == 3) { piece.classList.add('red'); cell.appendChild(piece); }

                // give each cell a click handler (used to select and place pieces in game)
                cell.addEventListener('click', () => handleCellClick(cell));

                cell.appendChild(arrow);
                gameBoard.appendChild(cell);
            }
        }
    }

    // piece selection operator - only selects if game is active
    function selectPiece(piece) {
        if (!gameActive) return;
        // if selecting the currently selected piece we deselect it
        if (selectedPiece == piece) {
            selectedPiece.classList.remove('selected');
            selectedPiece = null;
            clearHighlights(); // clear highlights of moves for previously selected piece
            return;
        }
        // current player selecting their own piece
        if ((currentPlayer == 1 && piece.classList.contains('red')) ||
            (currentPlayer == 2 && piece.classList.contains('yellow'))) {
            if (selectedPiece) selectedPiece.classList.remove('selected');
            selectedPiece = piece;
            piece.classList.add('selected');
        }
    }

    // helper function to ensure that all cells are NOT highlighted
    function clearHighlights() {
        gameBoard.querySelectorAll('.cell.green-glow').forEach(c => {
            c.classList.remove('green-glow', 'pulse');
        });
    }

    // manage the clicks on a cell (used by event listener click) - only if game is active
    function handleCellClick(cell) {
        if (!gameActive) return;
        // --- MODO ONLINE (PvP) ---
        if (!vsAI) {
            const myNick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
            const isMyTurn = document.body.dataset.lastTurn === myNick;

            if (!isMyTurn) {
                showMessage({ who: 'system', text: 'Aguarda a tua vez.' });
                return;
            }

            let visualR = parseInt(cell.dataset.r, 10);
            let visualC = parseInt(cell.dataset.c, 10);
            
            // 1. Visual -> Lógico (Desfaz a rotação)
            const logical = getLogicalCoords(visualR, visualC);
            
            // 2. Lógico -> Índice Servidor (Snake)
            const cellIndex = getIndexFromLogical(logical.r, logical.c);
            
            console.log(`🖱️ CLIQUE: Visual(${visualR},${visualC}) -> Lógico(${logical.r},${logical.c}) -> Server[${cellIndex}]`);

            if (throwBtn && !throwBtn.disabled) {
                showMessage({ who: 'system', text: 'Tens de lançar o dado primeiro!' });
                return;
            }

            Network.notify({ cell: cellIndex })
                .then(() => {
                    // SUCESSO: Limpar highlights visualmente para dar feedback imediato
                    // Se estavamos no passo 'to' (a mover), isto apaga o verde e a seleção
                    clearHighlights();
                    if (selectedPiece) {
                        selectedPiece.classList.remove('selected');
                        selectedPiece = null;
                    }
                })
                .catch(err => {
                    const msg = err.message ? err.message.toLowerCase() : "";
                    // Filtra erros não críticos
                    if (!msg.includes("valid") && !msg.includes("piece")) {
                        showMessage({ who: 'system', text: err.message });
                    }
                });
            return;
        }
        // don't allow input when AI is playing
        if (vsAI && currentPlayer === aiPlayerNum) return;

        const pieceInCell = cell.querySelector('.piece'); // piece in selected cell

        // selecting current player's piece (non-empty cell and cell selected must contain piece belonging to current player)
        if (pieceInCell && ((currentPlayer == 1 && pieceInCell.classList.contains('red')) ||
            (currentPlayer == 2 && pieceInCell.classList.contains('yellow')))) {
            selectPiece(pieceInCell);
            if (!selectedPiece) return; // fail-safe if no piece to select
            clearHighlights(); // clear old highlights

            // get a list of all valid moves for the selected piece and highlight each one of legal moves cells
            const state = pieceInCell.getAttribute('move-state');
            const movesAllowed = (state === 'not-moved' && lastDiceValue !== 1) ? [] : getValidMoves(pieceInCell);
            movesAllowed.forEach(dest => dest.classList.add('green-glow'));
            return;
        }

        // try moving selected piece to a clicked cell (dice rolled and a piece is selected)
        if (selectedPiece && lastDiceValue != null) {
            const state = selectedPiece.getAttribute('move-state');
            if (state === 'not-moved' && lastDiceValue !== 1) return; // first move of a piece must be 1

            const possibleMoves = getValidMoves(selectedPiece);
            const isValidMove = possibleMoves.some(dest => dest === cell);

            // check if the selected cell is a valid move
            if (isValidMove) {
                if (state === 'not-moved' && lastDiceValue === 1) {
                    selectedPiece.setAttribute('move-state', 'moved'); // update atribute of a piece on its first ever move
                }

                // place selected piece in new cell after move and clear highlights and make sure selectedPiece is null
                movePieceTo(selectedPiece, cell);
                clearHighlights();
                selectedPiece.classList.remove('selected');
                selectedPiece = null;

                if (checkWinCondition()) return; // check if someone won

                // check if current player gets another turn based on their dice roll
                if (lastDiceValue === 4 || lastDiceValue === 6 || lastDiceValue === 1) {
                    throwBtn.disabled = false;
                    nextTurnBtn.disabled = true;
                } else {
                    nextTurn();
                }
                lastDiceValue = null; // reset dice value (awaits for new value from next dice roll)
            }
        }
    }

    // returns a list of all valid moves for a given piece and dice value
    function getValidMoves(piece, diceValue = lastDiceValue) {
        if (!piece || diceValue == null) return []; // if no piece selected or no dice rolled return nothing

        const startCell = piece.parentElement;
        const cols = parseInt(gameBoard.style.getPropertyValue('--cols'), 10);

        const r = parseInt(startCell.dataset.r, 10);
        const c = parseInt(startCell.dataset.c, 10); // start cells properties
        const moveState = piece.getAttribute('move-state');
        const playerClass = piece.classList.contains('red') ? 'red' : 'yellow';

        // rule: cannot enter top row if still has pieces in base row
        const hasBasePieces = Array
            .from(gameBoard.querySelectorAll(`.piece.${playerClass}`))
            .some(p => parseInt(p.parentElement.dataset.r, 10) === 3);

        // "special" case - 2nd to top row
        if (r === 1) {
            let remaining = diceValue;
            let currentC = c;

            const stepsToRightEnd = cols - 1 - currentC; // num steps left to reach end of row
            const horizontalMove = Math.min(remaining, stepsToRightEnd);
            currentC += horizontalMove;
            remaining -= horizontalMove; // update col index accordingly

            if (remaining === 0) { // if doesn't spill out of row index 1
                const targetCell = gameBoard.querySelector(`.cell[data-r="1"][data-c="${currentC}"]`);
                return targetCell ? [targetCell] : [];
            }

            const targets = [];
            const upCell = gameBoard.querySelector(`.cell[data-r="0"][data-c="${currentC}"]`);
            const downCell = gameBoard.querySelector(`.cell[data-r="2"][data-c="${currentC}"]`);

            // if possible to move into top row add possible moves
            if (!hasBasePieces && moveState !== 'row-four' && upCell) {
                targets.push({ cell: upCell, r: 0, c: currentC });
            }
            // add downward possible moves
            if (downCell) targets.push({ cell: downCell, r: 2, c: currentC });

            // if got spill over follow arrows and add new possible moves to further targets based on 'targets'
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

            // if no more spaces left unadded to move, return the possible moves
            return targets.map(t => t.cell);
        }

        // normal movement rows/cases: following the arrow tags
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

    // if a piece is captured, send it to the captured pieces container (The player who captured it container)
    function sendCapturedPieceToContainer(pieceEl, capturedByPlayer) {
        if (!pieceEl) return; // safety check
        const humanMadeCapture = capturedByPlayer === humanPlayerNum; // check if human made the capture
        const target = humanMadeCapture ? capturedP1 : capturedP2; // determine target container (capturedP1 or capturedP2)
        if (!target) return; // safety check
        // determine color
        const isRed = pieceEl.classList.contains('red');
        const colorClass = isRed ? 'red' : 'yellow';

        // creates a token representing the captured piece
        const token = document.createElement('div');
        token.className = `captured-token ${colorClass}`; // add color class
        token.setAttribute('aria-label', colorClass === 'red' ? 'Captured red piece' : 'Captured yellow piece'); // add attribute for accessibility

        target.appendChild(token); // append to the correct container

        // removes the original piece from the board
        pieceEl.remove();
    }

    // place parsed piece in destCell
    function movePieceTo(piece, destCell) {
        const existingPiece = destCell.querySelector('.piece');
        // check if piece already in destCell (capture)
        if (existingPiece) {
            // get colour of existingPiece
            const color = existingPiece.classList.contains('red') ? 'red' : 'yellow';
            TabStats.onCapture(currentPlayer, color);
            if (existingPiece.classList.contains('red')) {
                // red piece captured
                redPieces--;
                showMessage({ who: 'system', key: 'red_pieces', params: { count: redPieces } });
                sendCapturedPieceToContainer(existingPiece, currentPlayer);
            } else if (existingPiece.classList.contains('yellow')) {
                // yellow piece captured
                yellowPieces--;
                showMessage({ who: 'system', key: 'yellow_pieces', params: { count: yellowPieces } });
                sendCapturedPieceToContainer(existingPiece, currentPlayer);
            }
        }

        // check if move-state needs to be updated (moving into top row)
        const destRow = parseInt(destCell.dataset.r, 10);
        const currentState = piece.getAttribute('move-state');
        if (destRow === 0 || currentState === 'row-four') {
            piece.setAttribute('move-state', 'row-four');
        }
        destCell.appendChild(piece); // place piece in cell
        TabStats.onMove(currentPlayer);
    }

    // board flip is done at each turn swap between players
    function flipBoard() {
        lastDiceValue = null;

        // UI if AI's turn
        if (throwBtn) throwBtn.disabled = (vsAI && (currentPlayer === aiPlayerNum));
        if (nextTurnBtn) nextTurnBtn.disabled = true;

        const cols = parseInt(gameBoard.style.getPropertyValue('--cols'), 10);
        const cells = Array.from(gameBoard.querySelectorAll('.cell'));

        // make sure no pieces actively selected
        if (selectedPiece) {
            selectedPiece.classList.remove('selected');
            selectedPiece = null;
        }

        // mirror/invert each piece from their original positions so it looks like we are viewing board from opponent's perspective
        const newPositions = []; // array of new positions
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

        // clear all cells of pieces
        cells.forEach(cell => {
            const piece = cell.querySelector('.piece');
            if (piece) piece.remove();
        });

        // place pieces in their "new" positions
        newPositions.forEach(({ piece, newR, newC }) => {
            const dest = gameBoard.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
            if (dest) dest.appendChild(piece);
        });
    }

    // switch turns handler
    function nextTurn() {
        // change currentPlayer to other player and notify in message system
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        currentPlayerEl.textContent = currentPlayer;
        TabStats.onTurnAdvance();
        showMessage({ who: 'system', key: 'msg_turn_of', params: { player: currentPlayer } });
        flipBoard();

        // if it is AI turn, play AI turn
        if (vsAI && currentPlayer === aiPlayerNum) {
            setTimeout(() => runAiTurnLoop().catch(err => console.warn('Erro no turno da IA:', err)), 200);
        } else {
            if (throwBtn && !throwBtn.disabled) {
                showMessage({ who: 'system', key: 'msg_dice' });
            }
        }
    }

    function checkWinCondition() {
        let winnerNum = null;
        if (redPieces == 0) {
            // player 2 (yellow) wins
            winnerNum = 2;
        } else if (yellowPieces == 0) {
            // player 1 (red) wins
            winnerNum = 1;
        } else {
            return false; // no winner yet
        }
        // winning msg
        showMessage({ who: 'system', key: 'msg_player_won', params: { player: winnerNum } });
        TabStats.setWinner(winnerNum); // update stats
        // Helpers to obtain localized player labels for leaderboard update (same as leave button)
        const lang = window.currentLang || 'pt';
        const dict = (typeof i18n !== 'undefined' ? i18n : window.i18n) || {};
        const L = dict[lang] || dict.en || {};
        const player1Label = L.player1 || (lang === 'pt' ? 'Jogador 1' : 'Player 1');
        const aiLabel = (() => {
            const key = aiDifficulty === 'easy' ? 'easyIA'
                : aiDifficulty === 'hard' ? 'hardIA'
                    : 'normalIA';
            return L[key] || // IA (Fácil)/AI (Easy) etc.
                (lang === 'pt'
                    ? `IA (${aiDifficulty === 'easy' ? 'Fácil' : aiDifficulty === 'hard' ? 'Difícil' : 'Normal'})`
                    : `AI (${aiDifficulty[0].toUpperCase()}${aiDifficulty.slice(1)})`);
        })();
        let winnerName = '';
        let loserName = '';
        if (vsAI) {
            if (winnerNum === aiPlayerNum) {
                winnerName = aiLabel;
                loserName = player1Label;
            } else {
                winnerName = player1Label;
                loserName = aiLabel;
            }
        } else {
            // Local PvP labels (not implemented yet)
            const loserNum = (winnerNum === 1 ? 2 : 1);
            winnerName = lang === 'pt' ? `Jogador ${winnerNum}` : `Player ${winnerNum}`;
            loserName = lang === 'pt' ? `Jogador ${loserNum}` : `Player ${loserNum}`;
        }
        window.updateLeaderboard(winnerName, loserName); // update leaderboard
        endGame(); // end game
        return true;

    }

    // end game helper - resets all "global" variables and reset board and button states
    function endGame() {
        TabStats.showSummary();
        currentPlayer = 1;
        gameActive = false;

        redPieces = 0;
        yellowPieces = 0;
        selectedPiece = null;

        vsAI = false;
        aiPlayerNum = null;
        humanPlayerNum = 1;

        lastDiceValue = null;
        refreshCapturedTitles();
        if (capturedP1) capturedP1.innerHTML = '';
        if (capturedP2) capturedP2.innerHTML = '';
        gameActive = false;
        renderBoard(parseInt(widthSelect.value, 10));
        if (nextTurnBtn) nextTurnBtn.disabled = true;
        if (throwBtn) throwBtn.disabled = true;

        // reactivate settings options
        setConfigEnabled(true);
        if (playButton) playButton.disabled = !isConfigValid();
        if (leaveButton) leaveButton.disabled = true;
        updatePlayButtonState();
    }

    // messages
    function showMessage({ who = 'system', player = null, text, key, params }) {
        const wrap = document.createElement('div'); // message wrapper
        wrap.className = 'message';

        const bubble = document.createElement('div'); // message bubble
        bubble.className = 'bubble';

        if (key) { // i18n key provided
            // use i18n translation
            bubble.dataset.i18nKey = key;
            if (params && Object.keys(params).length) { // store params as JSON string if provided
                bubble.dataset.i18nParams = JSON.stringify(params);
            }
            bubble.textContent = t(key, params || {}); // set translated text
        } else {
            // fallback: use raw text
            bubble.textContent = text ?? '';
        }

        if (who === 'system') { // system message
            wrap.classList.add('msg-server');
            wrap.appendChild(bubble);
        } else { // player message
            wrap.classList.add(player === 1 ? 'msg-player1' : 'msg-player2');
            const avatar = document.createElement('div');
            avatar.className = 'avatar'; // player avatar
            avatar.textContent = 'P' + player;
            const stack = document.createElement('div');
            stack.appendChild(bubble);
            wrap.appendChild(avatar);
            wrap.appendChild(stack);
        }

        messagesEl.appendChild(wrap);
        messagesEl.scrollTop = messagesEl.scrollHeight; // auto-scroll to bottom
    }

    // translate existing chat bubbles if language changes
    function refreshChatBubbles() {
        if (!messagesEl) return; // safety check
        const bubbles = messagesEl.querySelectorAll('.bubble[data-i18n-key]'); // only those with i18n data, bubbles are all the chat messages 
        bubbles.forEach(b => { // for each bubble
            const key = b.dataset.i18nKey; // get the key/id (e.g., 'msg_player_won')
            let params = {}; // default empty params
            if (b.dataset.i18nParams) { // if there are params
                try { params = JSON.parse(b.dataset.i18nParams); } catch { } // parse safely
            }
            b.textContent = t(key, params); // re-translate and update text content
        });
    }

    // expose refreshChatBubbles globally
    window.__refreshChat = refreshChatBubbles;

    //clearing messages
    function clearMessages() {
        if (messagesEl) messagesEl.innerHTML = '';
    }


    // UI listeners
    // next turn button
    if (nextTurnBtn) {
        nextTurnBtn.addEventListener('click', async () => {
            TabStats.onPass(currentPlayer); // stats
            if (vsAI) {
                nextTurn(); // advance turn
            } else {
                try {
                    await Network.pass();
                    nextTurnBtn.disabled = true; // evita múltiplos passes até SSE chegar
                } catch (err) {
                    showMessage({ who: 'system', text: err.message });
                    return;
                }
            }
        });
    }
    // width select change
    if (widthSelect) widthSelect.addEventListener('change', () => renderBoard(parseInt(widthSelect.value, 10))); // re-render board on width change
    if (authForm) authForm.addEventListener('submit', (ev) => ev.preventDefault());

    // Start Game button handler
    if (playButton) playButton.addEventListener('click', async () => {
        // 1. Validação
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
        aiDifficulty = diffSel;

        aiPlayerNum = vsAI ? (humanFirst ? 2 : 1) : null;
        humanPlayerNum = vsAI ? (humanFirst ? 1 : 2) : 1;
        refreshCapturedTitles();
        renderBoard(parseInt(widthSelect.value, 10));

        // ---------------------------------------------------------
        // CAMINHO A: MODO ONLINE (PvP)
        // ---------------------------------------------------------
        if (!vsAI) {
            const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
            const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
            const size = parseInt(widthSelect.value, 10);

            try {
                // 1. Join
                const joinData = await Network.join({ nick, password, size });
                gameId = joinData.game;
                sessionStorage.setItem('tt_gameId', gameId);

                // 2. Estado de Espera
                waitingForPair = true;
                showMessage({ who: 'system', key: 'msg_waiting_pair' });

                // 3. UI Bloqueada (Obrigatório!)
                if (throwBtn) throwBtn.disabled = true;
                if (nextTurnBtn) nextTurnBtn.disabled = true;
                if (playButton) playButton.disabled = true;
                if (leaveButton) leaveButton.disabled = false;
                setConfigEnabled(false);

                // 4. Ligar SSE
                Network.createUpdateEventSource(dataHandler);

            } catch (err) {
                showMessage({ who: 'system', text: err.message });
                // Se falhar, reativa os botões para tentar de novo
                updatePlayButtonState();
                setConfigEnabled(true);
            }

            // IMPORTANTE: O código PÁRA aqui. 
            // Não deixamos correr a inicialização local lá em baixo.
            return;
        }

        // ---------------------------------------------------------
        // CAMINHO B: MODO LOCAL / IA (Só corre se o return acima não acontecer)
        // ---------------------------------------------------------

        currentPlayer = 1;
        currentPlayerEl.textContent = currentPlayer;

        // Iniciar Stats
        TabStats.start({
            mode: gameMode,
            aiDifficulty,
            cols: parseInt(widthSelect.value, 10),
            firstPlayer: vsAI ? (humanFirst ? "Human" : "Ai") : null
        });
        TabStats.onTurnAdvance();

        // Mensagem imediata
        showMessage({ who: 'system', key: 'msg_game_started' });

        gameActive = true;

        updatePlayButtonState();
        setConfigEnabled(false);

        if (nextTurnBtn) nextTurnBtn.disabled = true;
        // Lógica do botão dado para IA
        if (vsAI) {
            // Se for contra IA, só desativa se a IA for o Jogador 1 (Red)
            throwBtn.disabled = (aiPlayerNum === 1);
        } else {
            // Se for PvP Local (Human vs Human), o botão deve estar ATIVO para o Jogador 1 começar
            throwBtn.disabled = false;
        }

        if (playButton) playButton.disabled = true;
        if (leaveButton) leaveButton.disabled = false;

        if (isHumanTurn() && throwBtn && !throwBtn.disabled) {
            showMessage({ who: 'system', key: 'msg_dice' });
        }

        if (vsAI && 1 === aiPlayerNum) {
            setTimeout(() => runAiTurnLoop().catch(err => console.warn('Erro IA:', err)), 250);
        }
    });

    // throw dice button
    if (throwBtn) {
        throwBtn.addEventListener('click', async (e) => {
            if (vsAI && currentPlayer === aiPlayerNum) {
                e.preventDefault();
                return;
            }
            if (!gameActive) return;
            if (vsAI) {
                try {
                    const result = await window.tabGame.spawnAndLaunch();
                    lastDiceValue = result;

                    // indicate value of dice rolled
                    showMessage({ who: 'player', player: currentPlayer, key: 'msg_dice_thrown', params: { value: result } });

                    // special roll cases
                    const isExtra = (result === 1 || result === 4 || result === 6);
                    const isTab = (result === 1);

                    // calculate moves/captures
                    const playerColor = getColorForPlayerNum(currentPlayer);
                    const legalMoves = enumerateLegalMovesDOM(currentPlayer, result);
                    const captureMoves = legalMoves.filter(m => {
                        const occ = m.destCell.querySelector('.piece');
                        return occ && !occ.classList.contains(playerColor);
                    });

                    // no possible moves - if extra move allowed, indicate to roll... otherwise indicate to skip turn
                    if (legalMoves.length === 0) {
                        if (isExtra) {
                            // primeiro o “double”, depois o aviso de sem jogadas extra
                            showMessage({ who: 'system', key: 'msg_player_no_moves_extra' });

                            TabStats.onDice(currentPlayer, result);
                            TabStats.onExtraRoll(currentPlayer, result);

                            // volta a lançar
                            throwBtn.disabled = false;
                            nextTurnBtn.disabled = true;
                        } else {
                            showMessage({ who: 'system', key: 'msg_player_no_moves_pass' });

                            TabStats.onDice(currentPlayer, result);

                            throwBtn.disabled = true;
                            nextTurnBtn.disabled = false;
                        }
                        return; // termina este lançamento
                    }

                    // moves possible
                    if (isTab) {
                        // Tâb: prioritise capture
                        const convertibleCount = countConvertiblePieces(currentPlayer);

                        if (captureMoves.length > 0) { // make a capture and indicate reroll
                            // captura primeiro, depois "double"
                            showMessage({
                                who: 'player',
                                player: currentPlayer,
                                key: 'msg_capture',
                                params: { n: captureMoves.length }
                            });
                            showMessage({ who: 'system', key: 'msg_dice_thrown_double', params: { value: result } });
                        } else if (convertibleCount > 0) {
                            // conersion before double
                            showMessage({ who: 'system', key: 'msg_dice_thrown_one', params: { n: convertibleCount } });
                            showMessage({ who: 'system', key: 'msg_dice_thrown_double', params: { value: result } });
                        } else {
                            // nothing to convert
                            showMessage({ who: 'system', key: 'msg_dice_thrown_double', params: { value: result } });
                            showMessage({ who: 'system', key: 'msg_player_can_move' });
                        }
                    } else {
                        // 4 or 6: double roll... 2/3: no double
                        if (isExtra) {
                            showMessage({ who: 'system', key: 'msg_dice_thrown_double', params: { value: result } });
                        }
                        if (captureMoves.length > 0) {
                            showMessage({
                                who: 'player',
                                player: currentPlayer,
                                key: 'msg_capture',
                                params: { n: captureMoves.length }
                            });
                        } else {
                            showMessage({ who: 'system', key: 'msg_player_can_move' });
                        }
                    }

                    // UI and stats
                    nextTurnBtn.disabled = true;
                    throwBtn.disabled = true;

                    TabStats.onDice(currentPlayer, result);
                    if (isExtra) TabStats.onExtraRoll(currentPlayer, result);

                } catch (err) {
                    console.warn('Erro ao lançar dados:', err);
                }
            } else {
                try {
                    // Bloqueia imediatamente para não clicar 2 vezes
                    throwBtn.disabled = true;

                    // Pede ao servidor para lançar
                    await Network.roll();

                    // Não animar nem mostrar valor aqui.
                    // A UI será atualizada quando chegar o SSE com data.dice.
                    // O servidor é a fonte da verdade.
                } catch (err) {
                    console.warn('Erro ao lançar dados (PvP):', err);
                    showMessage({ who: 'system', text: err.message });
                    // Em erro, permitir tentar de novo
                    throwBtn.disabled = false;
                }

            }

        });
    }

    // helper: enumerate legal moves
    function enumerateLegalMovesDOM(playerNum, diceValue) {
        const color = getColorForPlayerNum(playerNum); // 'red' ou 'yellow'
        const moves = []; // legal moves list
        const pieces = Array.from(gameBoard.querySelectorAll('.piece.' + color)); // array of player's pieces

        for (const piece of pieces) { // for each piece
            const state = piece.getAttribute('move-state'); // determine its state
            if (state === 'not-moved' && diceValue !== 1) continue; // if not moved and dice != 1, skip
            // get current position from cell
            const fromCell = piece.parentElement;
            const fromR = parseInt(fromCell.dataset.r, 10);
            const fromC = parseInt(fromCell.dataset.c, 10);

            const valids = getValidMoves(piece, diceValue); // get valid moves for this piece
            for (const dest of valids) { // for each valid destination
                const occ = dest.querySelector('.piece'); // check occupation
                if (occ && occ.classList.contains(color)) continue; // if blocked by own piece, skip
                // record the move
                const toR = parseInt(dest.dataset.r, 10);
                const toC = parseInt(dest.dataset.c, 10);
                moves.push({ piece, from: { r: fromR, c: fromC }, destCell: dest, to: { r: toR, c: toC } }); // store move details in moves array
            }
        }
        return moves;
    }

    // counts how many pieces can be converted (state "not-moved")
    function countConvertiblePieces(playerNum) {
        const color = getColorForPlayerNum(playerNum);
        return Array.from(gameBoard.querySelectorAll('.piece.' + color))
            .filter(p => p.getAttribute('move-state') === 'not-moved').length;
    }

    // AI TURN 
    async function runAiTurnLoop() { // async makes a function return a Promise, A Promise is an Object that links Producing code and Consuming code
        if (!vsAI || !gameActive || currentPlayer !== aiPlayerNum) return; // safety checks

        // blocks UI input during AI turn
        if (throwBtn) throwBtn.disabled = true;
        if (nextTurnBtn) nextTurnBtn.disabled = true;
        // determine AI color and difficulty
        const aiColor = getColorForPlayerNum(aiPlayerNum);
        const difficulty = aiDifficulty || 'normal';
        // AI turn loop
        while (gameActive && currentPlayer === aiPlayerNum) {
            let result;
            try {
                result = await window.tabGame.spawnAndLaunch(); // launch dice asynchronously
            } catch (err) {
                console.warn('Falha ao lançar dados para IA:', err);
                break;
            }

            // saves dice value for move calculations
            lastDiceValue = result;
            TabStats.onDice(currentPlayer, result); // stats

            showMessage({ who: 'player', player: currentPlayer, key: 'msg_ai_dice', params: { value: result } });

            // legal moves
            const domMoves = enumerateLegalMovesDOM(aiPlayerNum, result);

            if (domMoves.length === 0) { // if legal moves are zero
                if (result === 1 || result === 4 || result === 6) { // check for extra roll
                    showMessage({ who: 'system', key: 'msg_ai_no_moves_extra' });
                    TabStats.onExtraRoll(currentPlayer, result);
                    lastDiceValue = null;
                    continue; // AI rolls again
                } else {
                    showMessage({ who: 'system', key: 'msg_ai_no_moves_pass' });
                    lastDiceValue = null;
                    TabStats.onPass(currentPlayer);
                    nextTurn();
                    break; // end AI turn
                }
            }
            // try to get AI move from TAB_AI
            let chosenMove = null;

            try {
                if (window.TAB_AI && typeof window.TAB_AI.getAIMove === 'function') { // check if TAB_AI is available
                    const choice = window.TAB_AI.getAIMove(result, aiColor, difficulty); // get AI move
                    if (choice && choice.from && choice.to) { // validate choice structure
                        // map choice to DOM elements
                        const fromCell = gameBoard.querySelector(`.cell[data-r="${choice.from.r}"][data-c="${choice.from.c}"]`);
                        const destCell = gameBoard.querySelector(`.cell[data-r="${choice.to.r}"][data-c="${choice.to.c}"]`);
                        const piece = fromCell ? fromCell.querySelector(`.piece.${aiColor}`) : null;
                        // validate move legality
                        if (fromCell && destCell && piece) {
                            const legalCells = getValidMoves(piece, result); // get legal moves for the piece
                            const isInLegalList = legalCells.some(cell => cell === destCell); // check if destCell is legal
                            const occ = destCell.querySelector('.piece'); // check occupation
                            const blockedByOwn = occ && occ.classList.contains(aiColor); // check if blocked by own piece

                            if (isInLegalList && !blockedByOwn) { // if legal and not blocked
                                chosenMove = { piece, from: choice.from, destCell, to: choice.to };
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('Erro ao obter jogada da IA:', e);
            }

            if (!chosenMove) { // if no valid AI move chosen
                // Fallback: chooses first capture move, else first legal move
                const captureMoves = domMoves.filter(m => { // filter capture moves
                    const occ = m.destCell.querySelector('.piece');
                    return occ && !occ.classList.contains(aiColor);
                });
                chosenMove = captureMoves[0] || domMoves[0]; // choose first capture or first legal move
                // note: chosenMove contains { piece, from, destCell, to }
                if (!chosenMove) { // if still no move (found, should not happen) -> fallback
                    console.warn('Sem fallback de jogada, embora domMoves > 0 — a passar a vez.');
                    if (result === 1 || result === 4 || result === 6) { // check for extra roll
                        showMessage({ who: 'system', key: 'msg_ai_no_moves_extra' });
                        lastDiceValue = null;
                        continue; // IA rolls again
                    } else {
                        showMessage({ who: 'system', key: 'msg_ai_no_moves_pass' });
                        lastDiceValue = null;
                        nextTurn();
                        break; // end AI turn
                    }
                }
            }

            // execute chosen move
            const piece = chosenMove.piece;
            const destCell = chosenMove.destCell;

            // if not moved and dice = 1, update state to moved
            const state = piece.getAttribute('move-state');
            if (state === 'not-moved' && result === 1) {
                piece.setAttribute('move-state', 'moved');
            }

            movePieceTo(piece, destCell); // move piece

            if (checkWinCondition()) return; // check for win condition

            // extra throw rules
            if (result === 1 || result === 4 || result === 6) {
                showMessage({ who: 'system', key: 'msg_ai_extra_roll' });
                TabStats.onExtraRoll(currentPlayer, result);
                lastDiceValue = null;
                continue; // IA rolls again
            } else {
                lastDiceValue = null;
                nextTurn(); // skip turn
                break;
            }
        }
    }

    //  Dice (sticks) 
    const upCountProbs = [0.06, 0.25, 0.38, 0.25, 0.06]; // probabilities for 0 to 4 sticks up
    const namesMap = { 0: "Sitteh", 1: "Tâb", 2: "Itneyn", 3: "Teláteh", 4: "Arba'ah" };
    // returns index based on probs array
    function sampleFromDistribution(probs) {
        const r = Math.random();
        let c = 0;
        for (let i = 0; i < probs.length; i++) {
            c += probs[i];
            if (r <= c) return i;
        }
        return probs.length - 1;
    }

    window.tabGame = window.tabGame || {}; // ensure tabGame namespace
    window.tabGame._resolveResult = null; // internal resolver for dice result
    // spawns dice pouch and launches dice, returns Promise with game value (1-6)
    function createDicePouch(autoDrop = false, forcedValue = null) {
        const prev = document.body.querySelector('.dice-overlay'); // remove existing overlay
        if (prev) prev.remove();
        // create overlay elements
        const overlay = document.createElement('div');
        overlay.className = 'dice-overlay';
        if (forcedValue !== null) overlay.dataset.forcedValue = forcedValue;
        // arena where dice are thrown
        const arena = document.createElement('div');
        arena.className = 'dice-arena';
        overlay.appendChild(arena);
        // text (Automatic drop hint) 
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
        // dice pouch
        const pouch = document.createElement('div');
        pouch.className = 'dice-pouch';
        arena.appendChild(pouch);
        // style pouch position
        for (let i = 0; i < 4; i++) {
            const s = document.createElement('div');
            s.className = 'dice-stick initial';
            s.dataset.index = i;
            s.style.left = "50%";
            s.style.top = "50%";
            const randZ = (Math.random() * 8 - 4);
            s.style.transform = `translate(-50%,-50%) rotateX(-90deg) rotateZ(${randZ}deg)`;
            s.style.transformOrigin = '50% 85%';
            // faces
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

        document.body.appendChild(overlay); // add to body

        if (throwBtn) throwBtn.disabled = true; // disable throw button while dice are active
        if (autoDrop) setTimeout(() => dropDiceSticks(pouch, arena, overlay), 120); // auto drop after short delay
    }
    // drops the dice sticks with animation, computes result, shows bubble
    function dropDiceSticks(pouch, arena, overlay) {
        const sticks = Array.from(pouch.querySelectorAll('.dice-stick')); // get sticks
        let chosenUpCount;
        let forcedIndices = null;
        if (overlay.dataset.forcedValue) {
            const val = parseInt(overlay.dataset.forcedValue, 10);
            chosenUpCount = (val === 6) ? 0 : val;
        } else {
            chosenUpCount = sampleFromDistribution(upCountProbs); // sample up count
        }

        const indices = [0, 1, 2, 3]; // shuffle indices
        for (let i = indices.length - 1; i > 0; i--) { // Fisher-Yates shuffle
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const results = new Array(4).fill(false); // all down
        for (let k = 0; k < chosenUpCount; k++) results[indices[k]] = true; // set chosen sticks up

        const maxWide = Math.min(window.innerWidth, 900); // max width for calculations
        const gapPx = Math.max(54, Math.round(maxWide * 0.08)); // gap between sticks
        sticks.forEach((s, i) => { // animate each stick
            s.classList.remove('initial');
            void s.offsetWidth;
            s.classList.add('fallen');
            // compute final position and rotation
            const posIndex = i - 1.5;
            const offsetX = Math.round(posIndex * gapPx);
            const offsetY = Math.round(6 + (Math.random() * 6 - 3));

            const isUp = results[i];
            const rotX = isUp ? 0 : 180;
            const rotZ = (Math.random() * 6 - 3);
            // apply styles
            s.style.left = `calc(50% + ${offsetX}px)`;
            s.style.top = `calc(50% + ${offsetY}px)`;
            s.style.transform = `translate(-50%,-50%) rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
            s.style.transitionDelay = `${i * 80}ms`;
        });

        const totalAnim = 700 + (sticks.length - 1) * 80; // total animation time
        setTimeout(() => { // after animation
            const actualUp = results.reduce((a, b) => a + (b ? 1 : 0), 0);
            const gameValue = (actualUp === 0) ? 6 : actualUp;

            lastDiceValue = gameValue;
            showDiceResult(gameValue, actualUp, overlay); // show result bubble

            if (window.tabGame && typeof window.tabGame._resolveResult === 'function') { // resolve promise
                try {
                    window.tabGame._resolveResult(gameValue);
                } catch (e) {
                    console.warn('resolve falhou', e);
                }
                window.tabGame._resolveResult = null;
            }
        }, totalAnim + 40);
    }
    // shows the dice result bubble with countdown and auto-close
    function showDiceResult(gameValue, upCount, overlay) {
        // remove previous bubble if any
        const prevBubble = overlay.querySelector('.dice-result-bubble');
        if (prevBubble) prevBubble.remove();
        // create bubble elements
        const bubble = document.createElement('div');
        bubble.className = 'dice-result-bubble';
        // big number
        const big = document.createElement('div'); big.className = 'big';
        big.textContent = String(gameValue);
        // label with name and up count
        const label = document.createElement('div'); label.className = 'label';
        label.dataset.i18nKey = 'dice_label';
        label.dataset.diceUp = String(upCount);
        const diceName = t(`dice_name_${upCount}`);
        label.dataset.i18nParams = JSON.stringify({ name: diceName, up: upCount });
        label.textContent = t('dice_label', { name: diceName, up: upCount });
        // countdown to close
        const countdown = document.createElement('div');
        countdown.className = 'dice-countdown';
        let secs = 1;
        countdown.dataset.i18nKey = 'dice_countdown';
        countdown.dataset.secs = String(secs);
        countdown.textContent = t('dice_countdown', { secs });
        /// assemble bubble
        bubble.appendChild(big);
        bubble.appendChild(label);
        bubble.appendChild(countdown);

        overlay.appendChild(bubble);
        setTimeout(() => bubble.classList.add('show'), 20);
        // start countdown
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
    // re-translates the dice overlay (called on language change)
    function refreshDiceOverlay() {
        const ov = document.body.querySelector('.dice-overlay');
        if (!ov) return;

        // Re-translate everything with data-i18n-key
        ov.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.dataset.i18nKey;
            let params = {};

            // label: reaply with name and up count
            if (key === 'dice_label') {
                const up = parseInt(el.dataset.diceUp || '0', 10);
                const name = t(`dice_name_${up}`);
                params = { name, up };
                el.dataset.i18nParams = JSON.stringify(params);
                el.textContent = t(key, params);
                return;
            }

            // countdown: reaply with secs
            if (key === 'dice_countdown' && el.dataset.secs) {
                params = { secs: parseInt(el.dataset.secs, 10) };
                el.textContent = t(key, params);
                return;
            }
            // default case: no params
            el.textContent = t(key, params);
        });
    }

    // expose refreshDiceOverlay globally
    window.__refreshDice = refreshDiceOverlay;

    // debug helpers to inspect closure state
    window.__getServerStep = () => serverStep;
    window.__getLastDiceValue = () => lastDiceValue;

    // public API
    window.tabGame.spawnAndLaunch = function (forcedValue = null) {
        return new Promise((resolve) => {
            // closes previous overlay if any
            const prev = document.body.querySelector('.dice-overlay');
            if (prev) {
                try { // clear timers
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

            // saves resolver and creates new pouch
            window.tabGame._resolveResult = resolve;
            createDicePouch(true, forcedValue);
        });
    };
    window.tabGame.getLastValue = () => lastDiceValue; // getter for last dice value

    // --- initialization ---
    const initialCols = widthSelect ? parseInt(widthSelect.value, 10) : 9;
    renderBoard(initialCols);
    showMessage({ who: 'system', key: 'select_mode' });

    if (nextTurnBtn) nextTurnBtn.disabled = true;
    if (throwBtn) throwBtn.disabled = true;

    //  debug warnings
    if (!widthSelect) console.warn('widthSelect not found');
    if (!gameBoard) console.warn('gameBoard not found');
    if (!messagesEl) console.warn('messagesEl not found');

    // i18n helper function to translate keys with params
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