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

    // state (mostly for PVP)
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

    // --- CONFIGURATION HELPERS --- //

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

    // --- GENERAL HELPERS --- //

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

    //clearing messages
    function clearMessages() {
        if (messagesEl) messagesEl.innerHTML = '';
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

    // helper function to get color by player number
    function getColorForPlayerNum(n) { return n === 1 ? 'red' : 'yellow'; }

    // --- interface logic : blocks other selections when choosing vsPlayer mode ---
    function handleModeChange() {
        const mode = modeSelect.value;
        const isAI = (mode === 'ia');

        // manage difficulty select
        if (iaLevelSelect) {
            iaLevelSelect.disabled = !isAI; // if not IA, disable
            if (!isAI) iaLevelSelect.value = ''; // reset visual (optional)
        }

        //manage first to play checkbox
        if (firstToPlayCheckbox) {
            firstToPlayCheckbox.disabled = !isAI; // disable if not IA
            if (!isAI) firstToPlayCheckbox.checked = true; // reset visual (optional)
        }
        // finally update play button state
        updatePlayButtonState();
    }


    // --- GAME LOGIC HELPERS --- //

    // render board with given cols
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

    // helper function to ensure that all cells are NOT highlighted
    function clearHighlights() {
        //clear highlighted cells
        gameBoard.querySelectorAll('.cell[data-highlight]').forEach(c => {
            c.style.boxShadow = '';
            c.style.border = '';
            c.style.backgroundColor = '';
            c.style.cursor = '';
            delete c.dataset.highlight;

            // clear piece styles too (in case of playable piece)
            const p = c.querySelector('.piece');
            if (p) {
                p.style.boxShadow = '';
                p.style.border = '';
                p.style.transform = '';
                p.style.zIndex = '';
            }
        });

        // fallback: clear glow classes (as sometimes they persist)
        gameBoard.querySelectorAll('.cell.green-glow, .cell.red-glow').forEach(c => {
            c.classList.remove('green-glow', 'red-glow', 'pulse');
            c.style.cursor = '';
        });

        // Durante PvP na etapa 'to', manter a peça selecionada (onlineSourceCell) marcada.
        const keepSelection = (!vsAI && serverStep === 'to' && onlineSourceCell != null);
        gameBoard.querySelectorAll('.piece.selected').forEach(p => {
            if (keepSelection) return; // não remove a seleção ativa
            p.classList.remove('selected');
        });
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

    // In scripts/gameScript.js

function sendCapturedPieceToContainer(pieceEl, capturedByPlayer) {
    if (!pieceEl) return;
    
    const humanMadeCapture = capturedByPlayer === humanPlayerNum;
    const targetContainer = humanMadeCapture ? capturedP1 : capturedP2;
    
    if (!targetContainer) return;

    const isRed = pieceEl.classList.contains('red');
    const colorClass = isRed ? 'red' : 'yellow';

    // 1. Remove piece from board immediately (gameplay logic)
    pieceEl.remove();

    // 2. Define what happens AFTER visual animation (update UI panel)
    const addToPanel = () => {
        const token = document.createElement('div');
        token.className = `captured-token ${colorClass}`;
        token.setAttribute('aria-label', `Captured ${colorClass} piece`);
        targetContainer.appendChild(token);
    };

    // 3. Trigger the Visual Animation
    if (window.CaptureAnim) {
        // Use the new script
        window.CaptureAnim.play(colorClass, targetContainer, addToPanel);
    } else {
        addToPanel(); // Fallback
    }
}
    // --- ONLINE HELPERS --- //

    // coords logic: snake board representation

    // converts visual coords to logical coords
    function getLogicalCoords(visualR, visualC) {
        const cols = parseInt(widthSelect.value, 10);

        if (isBoardFlipped) {
            // if I'm player 2, the board is flipped: Logical = Invert(Visual)
            return {
                r: 3 - visualR,
                c: (cols - 1) - visualC
            };
        }
        // if I'm player 1, Logical = Visual
        return { r: visualR, c: visualC };
    }

    // converts logical coords to visual coords (same logic as above, but inverted)
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

    // converts logical coords to server index
    function getIndexFromLogical(r, c) {
        const cols = parseInt(widthSelect.value, 10);
        let indexBase = 0;

        if (r === 3) indexBase = 0;          // Base (Home P1)
        if (r === 2) indexBase = cols;       // row 2
        if (r === 1) indexBase = 2 * cols;   // row 1
        if (r === 0) indexBase = 3 * cols;   // Top row (Home P2 for P1, i.e., in the perspetive of Player 1)

        let offset = c;
        // reverse offset for rows 0 and 2
        if (r === 2 || r === 0) {
            offset = (cols - 1) - c;
        }

        return indexBase + offset;
    }

    // converts server index to logical coords (inverse of above)
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
    // helper to update captured panels based on online game state
    function updateOnlineCapturedPanels(myCount, oppCount) {
        const totalPieces = parseInt(widthSelect.value, 10);

        // calculate losses
        const myLosses = totalPieces - myCount;     // my pieces (captured by the enemy) (Reds in opponent's panel)
        const oppLosses = totalPieces - oppCount;   // opponent's pieces (captured by me) (Yellows in my panel)

        // clean captured panels
        if (capturedP1) capturedP1.innerHTML = ''; // my panel
        if (capturedP2) capturedP2.innerHTML = ''; // op's panel

        // adding captured tokens to panels
        // mine
        for (let i = 0; i < oppLosses; i++) {
            const token = document.createElement('div');
            token.className = 'captured-token yellow';
            capturedP1.appendChild(token);
        }

        //op's
        for (let i = 0; i < myLosses; i++) {
            const token = document.createElement('div');
            token.className = 'captured-token red';
            capturedP2.appendChild(token);
        }

        // update count variables
        redPieces = myCount;
        yellowPieces = oppCount;
    }

    // --- PVP FUNCTIONS --- //

    // manage end of game when winner is announced from server
    function handleOnlineWinner(winnerNick, myNick) {
        console.log("Processar Vencedor:", winnerNick);

        // show msg based on winner
        if (winnerNick === null) {
            showMessage({ who: 'system', key: 'msg_drawn' });
        } else if (winnerNick === myNick) {
            showMessage({ who: 'system', key: 'msg_you_won' });
            if (window.TabConfetti){
                window.TabConfetti.start();
            }
        } else {
            const wName = (winnerNick && winnerNick !== myNick) ? (shownOpponentNick || winnerNick) : "Oponente";
            showMessage({ who: 'system', key: 'msg_you_lost', params: { winner: wName } });
        }

        // close connection SSE
        Network.stopUpdateEventSource();

        // variable reset
        gameActive = false;
        waitingForPair = false;
        serverStep = null;
        onlineSourceCell = null;
        lastDiceValue = null;

        // opponent name reset
        shownOpponentNick = null;
        delete document.body.dataset.lastTurn;
        if (currentPlayerEl) currentPlayerEl.textContent = '-';

        // HTML clean up
        if (capturedP1) capturedP1.innerHTML = '';
        if (capturedP2) capturedP2.innerHTML = '';

        // board reset
        const cols = parseInt(widthSelect.value, 10);
        redPieces = cols;
        yellowPieces = cols;
        renderBoard(cols);


        // block game buttons
        if (nextTurnBtn) nextTurnBtn.disabled = true;
        if (throwBtn) throwBtn.disabled = true;

        // reenable config
        setConfigEnabled(true);
        if (playButton) playButton.disabled = !isConfigValid();
        if (leaveButton) leaveButton.disabled = true;
    }

    // Helper to render online board based on pieces array from server
    function renderOnlineBoard(pieces) {
        clearHighlights();
        const myServerColor = document.body.dataset.myColor; // 'Blue' or 'Red'
        let currentMyPieces = 0;
        let currentEnemyPieces = 0;

        // 1. Clean up existing pieces on the board
        gameBoard.querySelectorAll('.piece').forEach(p => p.remove());

        // 2. Render new pieces from server data
        pieces.forEach((pieceObj, serverIndex) => {
            if (!pieceObj) return;

            const logical = getLogicalFromIndex(serverIndex);
            const visual = getVisualCoords(logical.r, logical.c);
            const cell = gameBoard.querySelector(`.cell[data-r="${visual.r}"][data-c="${visual.c}"]`);
            
            if (!cell) return;

            let cssColor;
            if (pieceObj.color === myServerColor) {
                cssColor = 'red';
                currentMyPieces++;
            } else {
                cssColor = 'yellow';
                currentEnemyPieces++;
            }

            let moveState = 'moved';
            if (pieceObj.reachedLastRow || (visual.r === 0 && cssColor === 'red')) {
                moveState = 'row-four';
            } else if (pieceObj.inMotion === false) {
                moveState = 'not-moved';
            }

            const newPiece = document.createElement('div');
            newPiece.classList.add('piece', cssColor);
            newPiece.setAttribute('move-state', moveState);
            
            if (onlineSourceCell === serverIndex) {
                newPiece.classList.add('selected');
            }

            cell.appendChild(newPiece);
        });

        // 3. CAPTURE DETECTION & ANIMATION
        // We compare the new counts (currentMyPieces) with the old global counts (redPieces)
        
        // A. Check if MY pieces (Red) were captured -> They go to Opponent Panel (capturedP2)
        const redLost = redPieces - currentMyPieces;
        if (redLost > 0 && capturedP2) {
            showMessage({ who: 'system', key: 'red_pieces', params: { count: currentMyPieces } });
            triggerPvPCaptureAnim('red', capturedP2, redLost);
        }

        // B. Check if ENEMY pieces (Yellow) were captured -> They go to My Panel (capturedP1)
        const yellowLost = yellowPieces - currentEnemyPieces;
        if (yellowLost > 0 && capturedP1) {
            showMessage({ who: 'system', key: 'yellow_pieces', params: { count: currentEnemyPieces } });
            triggerPvPCaptureAnim('yellow', capturedP1, yellowLost);
        }

        // 4. Update the side panels (This function also updates the global redPieces/yellowPieces variables)
        updateOnlineCapturedPanels(currentMyPieces, currentEnemyPieces);
    }

    // Helper function to manage the specific PvP visual sequence
    function triggerPvPCaptureAnim(color, targetContainer, count) {
        // We schedule this slightly after the panels update so we can hide the real token
        setTimeout(() => {
            if (!window.CaptureAnim) return;

            // The panels have just been rebuilt by updateOnlineCapturedPanels.
            // The newest tokens are at the end of the list.
            const tokens = targetContainer.children;
            const startIndex = tokens.length - count;

            for (let i = 0; i < count; i++) {
                const tokenIndex = startIndex + i;
                const tokenElement = tokens[tokenIndex];

                if (tokenElement) {
                    // 1. Hide the real token immediately so it doesn't duplicate
                    tokenElement.style.opacity = '0';

                    // 2. Play the animation flying to the container
                    setTimeout(() => {
                        window.CaptureAnim.play(color, targetContainer, () => {
                            // 3. When animation lands, reveal the real token
                            tokenElement.style.opacity = '1';
                            tokenElement.style.transition = 'opacity 0.3s';
                        });
                    }, i * 300); // Stagger animations if multiple pieces captured
                }
            }
        }, 50); // Small delay to ensure DOM is ready
    }

    // helper to highlight a cell based on server index and type of highlight
    function highlightCell(serverIndex, type) {
        // get logical and visual coords
        const logical = getLogicalFromIndex(serverIndex);
        const visual = getVisualCoords(logical.r, logical.c);
        // find the cell in the DOM
        const cell = gameBoard.querySelector(`.cell[data-r="${visual.r}"][data-c="${visual.c}"]`);

        if (!cell) {
            console.warn("⚠️ Célula não encontrada no DOM!", visual);
            return;
        }
        // apply highlight based on type
        if (type === 'selected') {
            const piece = cell.querySelector('.piece');
            if (piece) piece.classList.add('selected');
        }
        // green glow for when a piece has more than 1 move avaliable (without validating the forth row logic), the glow is for the destinations (step === 'to')
        else if (type === 'green-glow') {
            cell.classList.add('green-glow');
            cell.dataset.highlight = 'green';
        }
        // red glow for when a piece is threatened (step === 'take'), with the same logic as the green glow, but instead of a safe destination, it's an enemy piece that can be captured
        else if (type === 'red-glow') {
            cell.classList.add('red-glow');
            cell.dataset.highlight = 'red';

            // visual effects on the enemy piece
            const enemyPiece = cell.querySelector('.piece');
            if (enemyPiece) {
                enemyPiece.style.boxShadow = "0 0 20px 8px rgba(255, 0, 0, 1)";
                enemyPiece.style.border = "2px solid #fff";
                enemyPiece.style.transform = "scale(1.15)";
                enemyPiece.style.zIndex = "100";
            }
        }
    }

    // helper to highlight pieces that can be moved and returns the number of threats available (to know how many captures are available in that turn)
    function highlightPlayablePieces(diceValue) {
        //clean up previous highlights and styles
        const allPieces = document.querySelectorAll('.piece');
        allPieces.forEach(p => {
            p.classList.remove('playable', 'playable-threat', 'can-unlock');
            p.style.zIndex = '';
        });

        if (!diceValue) return 0; // safety check, because without a dice value, no pieces can be playable

        // in online mode, "my pieces" are always rendered as 'red' (bottom), so this is a init point
        const myPieces = Array.from(document.querySelectorAll('.piece.red'));
        let threatsCount = 0;
        // check each piece for valid moves
        myPieces.forEach(piece => {
            const state = piece.getAttribute('move-state');
            if (state === 'not-moved' && diceValue !== 1) return; // not moved and not tab, can't move
            // get valid moves for this piece (locally calculated)
            const rawMoves = getValidMoves(piece, diceValue);

            // filter out moves that land on my own pieces
            const validMoves = rawMoves.filter(destCell => {
                const existingPiece = destCell.querySelector('.piece');
                if (existingPiece && existingPiece.classList.contains('red')) return false;
                return true;
            });
            // if there are valid moves, highlight the piece as playable
            if (validMoves.length > 0) {
                piece.classList.add('playable');
                piece.style.zIndex = '100';

                // if any of the valid moves can capture an enemy piece, mark as threat
                const isThreat = validMoves.some(destCell => {
                    const enemy = destCell.querySelector('.piece.yellow');
                    return enemy !== null;
                });

                if (isThreat) {
                    piece.classList.add('playable-threat'); //agressive visual indication
                    piece.style.zIndex = '105';
                    threatsCount++; // counter update
                }
                else if (diceValue === 1 && state === 'not-moved') {
                    piece.classList.add('can-unlock'); // convertible pieces visual indication
                }
            }
        });

        return threatsCount; // return the number of threats found
    }


    // checking if any online moves are available for the current player with the given dice value (used to determine if player can move or must pass)
    function checkOnlineMovesAvailable(diceValue) {

        const myPieces = Array.from(document.querySelectorAll('.piece.red'));

        for (const piece of myPieces) {
            const state = piece.getAttribute('move-state');
            if (state === 'not-moved' && diceValue !== 1) continue;
            const moves = getValidMoves(piece, diceValue);
            if (moves.length > 0) return true;
        }
        return false;
    }
    // server data handler - THE MOST IMPORTANT FUNCTION FOR ONLINE MODE, receives the server responses and updates the game state accordingly
    async function dataHandler(data) {
        console.log("[SERVER UPDATE]:", data);

        if (!data) return;
        if (!gameActive && (data.turn || data.pieces)) gameActive = true; // if game wasn't active but now there's a turn or pieces, set it active

        const myNick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick'); // my nickname from storage
        const currentTurnNick = data.turn || document.body.dataset.lastTurn; // current turn from server or last known turn
        const isMyTurn = (currentTurnNick === myNick); // check if it's my turn

        // error handling
        if (data.error) {
            console.warn('Server error:', data.error);
            showMessage({ who: 'system', text: data.error });
            if (data.error.includes("already rolled") && throwBtn) {
                throwBtn.disabled = true;
            }
            return;
        }
        // ranking handling (connects to leaderBoard.js)
        if (data.ranking) window.updatePvPLeaderboard(data.ranking);

        // players handling
        if (data.players) {
            const myServerColor = data.players[myNick]; // my color from server perspective
            if (myServerColor) { // set my color in dataset for reference
                document.body.dataset.myColor = myServerColor;
                isBoardFlipped = (myServerColor === 'Red');
            }
            const playerNames = Object.keys(data.players); // list of player nicknames
            const opponentName = playerNames.find(nick => nick !== myNick); // find opponent's nickname to use later

            if (opponentName && shownOpponentNick !== opponentName) {
                shownOpponentNick = opponentName;
                showMessage({ who: 'system', key: 'msg_paired', params: { opponent: opponentName } });

            }
        }


        // pieces handling - rendering the board in accord to server data
        if (data.pieces) renderOnlineBoard(data.pieces);

        // dice value handling
        if (data.dice !== undefined) {
            if (data.dice && data.dice.value) {
                lastDiceValue = data.dice.value;
                const val = data.dice.value;
                const isTab = (val === 1);
                const isExtra = (val === 1 || val === 4 || val === 6);


                // if this is my turn
                if (isMyTurn) {
                    // the message is from me
                    showMessage({
                        who: 'player',
                        player: 1,
                        key: 'msg_dice_thrown',
                        params: { value: val }
                    });

                    // animation just for me
                    if (window.tabGame && window.tabGame.spawnAndLaunch) {
                        window.tabGame.spawnAndLaunch(val);
                    }

                    // game logic
                    const threats = highlightPlayablePieces(lastDiceValue);
                    const canMove = checkOnlineMovesAvailable(val);
                    const keepPlaying = data.dice.keepPlaying; // if 1 || 4 || 6 then true

                    // what to do next
                    if (canMove) { // if there are available moves we move
                        if (throwBtn) throwBtn.disabled = true;
                        if (nextTurnBtn) nextTurnBtn.disabled = true;


                        if (isTab) {
                            const numConvertible = countConvertiblePieces(1);
                            if (numConvertible > 0) {
                                showMessage({ who: 'system', key: 'msg_dice_thrown_one' });
                            }
                        }
                        else if (isExtra) showMessage({ who: 'system', key: 'msg_dice_thrown_double' });

                        showMessage({ who: 'system', key: 'msg_player_can_move' });

                        // if there are captures available, show message
                        if (threats > 0) {
                            showMessage({
                                who: 'player',
                                player: 1,
                                key: 'msg_capture',
                                params: { n: threats }
                            });
                        }
                    } else { // no moves available, must pass or keep playing
                        if (keepPlaying) {
                            showMessage({ who: 'system', key: 'msg_player_no_moves_extra' });
                            if (throwBtn) throwBtn.disabled = false;
                            if (nextTurnBtn) nextTurnBtn.disabled = true;
                        } else {
                            showMessage({ who: 'system', key: 'msg_player_no_moves_pass' });
                            if (throwBtn) throwBtn.disabled = true;
                            if (nextTurnBtn) nextTurnBtn.disabled = false;
                        }
                    }
                }
                else {
                    // opponent's message
                    showMessage({
                        who: 'player',
                        player: 2,
                        key: 'msg_op_roll',
                        params: { value: val }
                    });
                }

            } else {
                lastDiceValue = null; // reset if no dice value
            }
        }

        // winner handling
        if (data.winner !== undefined) {
            handleOnlineWinner(data.winner, myNick);
            return;
        }

        // turn handling
        if (data.turn) {
            const previousTurn = document.body.dataset.lastTurn; // see who played last
            const turnChanged = (previousTurn !== data.turn); // see if the turn changed from last known turn

            if (turnChanged) { // if the turn changed, reset dice value and update turn display
                lastDiceValue = null;
                document.body.dataset.lastTurn = data.turn;
                if (currentPlayerEl) currentPlayerEl.textContent = (isMyTurn) ? "TU" : data.turn;

                // system msgs
                if (isMyTurn) {
                    showMessage({ who: 'system', key: 'msg_turn' });
                    if (!data.mustPass) showMessage({ who: 'system', key: 'msg_dice' });
                } else {
                    showMessage({ who: 'system', key: 'msg_turn_of', params: { player: data.turn } });
                }
            }

            if (data.mustPass && data.mustPass === myNick) { // if there are no moves available for me and no extra rolls
                if (turnChanged) showMessage({ who: 'system', key: 'msg_player_no_moves_pass' });
                if (nextTurnBtn) nextTurnBtn.disabled = false;
                if (throwBtn) throwBtn.disabled = true;
            } else if (isMyTurn) { // if it's my turn and I don't have to pass (roll again or normal turn)
                if (lastDiceValue === null) {
                    if (throwBtn) throwBtn.disabled = false;
                    if (nextTurnBtn) nextTurnBtn.disabled = true;
                }
            } else { // opponent's turn, disable buttons
                if (throwBtn) throwBtn.disabled = true;
                if (nextTurnBtn) nextTurnBtn.disabled = true;
            }
        }

        // step handling (from, to, take)
        if (data.step) {
            serverStep = data.step;
            clearHighlights();

            // step from (when there is only one move possible for a piece, it auto-selects it)
            if (serverStep === 'from') {
                onlineSourceCell = null;
                if (isMyTurn && lastDiceValue) {
                    // highlight playable pieces and count threats
                    const threats = highlightPlayablePieces(lastDiceValue);

                    // caoture msgs
                    if (threats > 0) {
                        showMessage({
                            who: 'player',
                            player: 1,
                            key: 'msg_capture',
                            params: { n: threats }
                        });
                    }
                }
            }

            // step to (when the piece has been selected and now we must choose destination, because that piece has more than one destination possible )
            else if (serverStep === 'to') {
                document.querySelectorAll('.piece.playable').forEach(p => p.classList.remove('playable')); // clean playable highlights

                if (data.cell !== undefined) {
                    onlineSourceCell = data.cell;
                    highlightCell(data.cell, 'selected');
                }

                if (isMyTurn && data.selected) {
                    // 1. Highlights destinations
                    const myPieces = Array.from(document.querySelectorAll('.piece.red'));
                    const hasBasePieces = myPieces.some(p => parseInt(p.parentElement.dataset.r, 10) === 3);
                    let captureCount = 0;

                    data.selected.forEach(idx => {
                        const logical = getLogicalFromIndex(idx);
                        const visual = getVisualCoords(logical.r, logical.c);

                        if (visual.r === 0 && hasBasePieces) return; // cannot move to top row if still has pieces in base row

                        const cell = gameBoard.querySelector(`.cell[data-r="${visual.r}"][data-c="${visual.c}"]`);
                        if (cell) {
                            const enemy = cell.querySelector('.piece.yellow');
                            const mine = cell.querySelector('.piece.red');

                            if (mine) return; // cannot move onto my own piece
                            if (enemy) {
                                highlightCell(idx, 'red-glow'); // capture! 
                                captureCount++;
                            }
                            else highlightCell(idx, 'green-glow');     // safe destination
                        }
                    });


                    // capture msg
                    if (captureCount > 0) {
                        showMessage({
                            who: 'player',
                            player: 1,
                            key: 'msg_capture',
                            params: { n: captureCount }
                        });
                    }
                    showMessage({ who: 'system', key: 'choose_destination' });
                }
            }

            // step take (same logic as to, but the destination is a capture)
            else if (serverStep === 'take') {
                if (isMyTurn) {
                    captureCount = 0;
                    // Highlights
                    if (data.selected) {
                        data.selected.forEach(idx => {
                            highlightCell(idx, 'red-glow');
                            // counting captures
                            const logical = getLogicalFromIndex(idx);
                            const visual = getVisualCoords(logical.r, logical.c);
                            const cell = gameBoard.querySelector(`.cell[data-r="${visual.r}"][data-c="${visual.c}"]`);
                            if (cell && cell.querySelector('.piece.yellow')) {
                                captureCount++;
                            } else {
                                // Fallback: if no piece found, still count as capture (server said so)
                                captureCount++;
                            }
                        });
                    }


                    // msgs
                    showMessage({
                        who: 'player',
                        player: 1,
                        key: 'msg_capture',
                        params: { n: captureCount }
                    });
                }
            }
        }
    }

    // --- LOCAL FUNCTIONS --- //

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
        if (currentPlayerEl) currentPlayerEl.textContent = '-';
        lastDiceValue = null;
        refreshCapturedTitles();
        if (capturedP1) capturedP1.innerHTML = '';
        if (capturedP2) capturedP2.innerHTML = '';

        clearMessages();
        gameActive = false;
        renderBoard(parseInt(widthSelect.value, 10));
        showMessage({ who: 'system', key: 'select_mode' });
        if (nextTurnBtn) nextTurnBtn.disabled = true;
        if (throwBtn) throwBtn.disabled = true;

        // reactivate settings options
        setConfigEnabled(true);
        if (playButton) playButton.disabled = !isConfigValid();
        if (leaveButton) leaveButton.disabled = true;
        updatePlayButtonState();
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

    // helper function to check if it's human's turns
    function isHumanTurn() {
        return !vsAI || currentPlayer !== aiPlayerNum;
    }

    // counts how many pieces can be converted (state "not-moved")
    function countConvertiblePieces(playerNum) {
        const color = getColorForPlayerNum(playerNum);
        return Array.from(gameBoard.querySelectorAll('.piece.' + color))
            .filter(p => p.getAttribute('move-state') === 'not-moved').length;
    }

    // --- AI FUNCTION --- //

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

    // --- DICE SYSTEM --- //

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

    // --- EVENT HANDLERS --- //

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


    // manage the clicks on a cell (used by event listener click) - only if game is active
    async function handleCellClick(cell) {
        if (!gameActive) return;
        // --- (PvP) ---
        if (!vsAI) {
            const myNick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
            const isMyTurn = document.body.dataset.lastTurn === myNick;

            if (!isMyTurn) {
                showMessage({ who: 'system', key: 'msg_hold' });
                return;
            }

            // convert virtual coords to logical coords and index
            let visualR = parseInt(cell.dataset.r, 10);
            let visualC = parseInt(cell.dataset.c, 10);
            const logical = getLogicalCoords(visualR, visualC);
            const cellIndex = getIndexFromLogical(logical.r, logical.c);

            console.log(`🖱️ CLIQUE Server[${cellIndex}] | Step: ${serverStep}`);

            // if we are at step from, we must validate the piece clicked
            if (serverStep !== 'to' && serverStep !== 'take') {

                // Verificação do dado
                if (throwBtn && !throwBtn.disabled) {
                    showMessage({ who: 'system', key: 'msg_roll_first' });
                    return;
                }

                // local validation before bothering the actual server 
                const pieceClicked = cell.querySelector('.piece');
                if (pieceClicked && pieceClicked.classList.contains('red') && lastDiceValue) {

                    // get valid moves for the piece clicked
                    const rawMoves = getValidMoves(pieceClicked, lastDiceValue);

                    // check if the valid moves have any destination with my own cells 
                    const realMoves = rawMoves.filter(dest => {
                        const occ = dest.querySelector('.piece');
                        // if the destination occ has my piece, invalid
                        if (occ && occ.classList.contains('red')) return false;
                        return true;
                    });

                    // if there are no valid moves BLOCK
                    if (realMoves.length === 0) {
                        console.warn("🚫 Bloqueio Cliente: Peça sem movimentos válidos (Base ou Bloqueio).");
                        showMessage({ who: 'system', key: 'msg_no_valid_moves' });

                        // error visual effect (optional)
                        cell.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
                        setTimeout(() => cell.style.backgroundColor = '', 300);
                        return; // doesn't proceed
                    }
                }
            }

            // SE O SERVIDOR ESTIVER À ESPERA DE UM DESTINO ('TO')
            if (serverStep === 'to') {
                
                // 1. Identificar se cliquei numa peça MINHA (Red)
                // Se sim, isto é uma TROCA DE SELEÇÃO, não é um movimento.
                const clickedMyPiece = cell.querySelector('.piece.red');
                
                if (clickedMyPiece) {
                    // --- LÓGICA DE TROCA (SWITCH) ---
                    // Calcular o índice da nova peça que eu quero
                    const visualR = parseInt(cell.dataset.r, 10);
                    const visualC = parseInt(cell.dataset.c, 10);
                    const logical = getLogicalCoords(visualR, visualC);
                    const newIndex = getIndexFromLogical(logical.r, logical.c);

                    console.log("🔄 A trocar seleção para a peça:", newIndex);

                    // Enviar ao servidor. 
                    // O servidor vai perceber que é uma peça tua e vai responder com:
                    // step: 'to', cell: newIndex, selected: [novos_destinos]
                    try {
                        await Network.notify({ cell: newIndex });
                    } catch (err) {
                        console.warn(err);
                    }
                    return; // IMPORTANTE: Sair aqui para não validar mais nada.
                }

                // 2. Se NÃO cliquei numa peça minha, então estou a tentar MOVER para um destino
                // Aqui aplicamos as regras de validação visual (para não enviar jogadas impossíveis)
                
                const myPieces = Array.from(document.querySelectorAll('.piece.red'));
                const visualBaseRow = 3;
                const hasBasePieces = myPieces.some(p => parseInt(p.parentElement.dataset.r, 10) === visualBaseRow);
                const visualR = parseInt(cell.dataset.r, 10);

                // Regra: Não posso mover para a linha 0 se tiver peças na base
                if (visualR === 0 && hasBasePieces) {
                    showMessage({ who: 'system', key: 'msg_base_pieces' });
                    return;
                }

                // Se passou a validação, deixa o código seguir para o Network.notify lá em baixo
                // que vai enviar o índice do DESTINO (casa vazia ou inimigo).
            }

            // if everything passed the checks, send to server
            Network.notify({ cell: cellIndex })
                .then(() => {
                    console.log("Pedido enviado com sucesso. À espera do servidor...");

                })
                .catch(err => {
                    const msg = err.message ? err.message.toLowerCase() : "";
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



    // UI listeners
    // next turn button
    if (nextTurnBtn) {
        nextTurnBtn.addEventListener('click', async () => {
            TabStats.onPass(currentPlayer); // stats
            if (vsAI) {
                nextTurn(); // advance turn
            } else {
                try {
                    await Network.pass(); // request to server
                    nextTurnBtn.disabled = true; // avoids multiple clicks
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
        // validation
        if (!isConfigValid()) {
            showMessage({ who: 'system', key: 'select_mode' });
            updatePlayButtonState();
            return;
        }
        clearMessages();

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

        // PVP
        if (!vsAI) {
            const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
            const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
            const size = parseInt(widthSelect.value, 10);

            try {
                // join a game
                const joinData = await Network.join({ nick, password, size }); // join request
                gameId = joinData.game;
                sessionStorage.setItem('tt_gameId', gameId);
                const humanNick = "Eu";

                redPieces = size;
                yellowPieces = size;

                // waiting state
                waitingForPair = true;
                showMessage({ who: 'system', key: 'msg_waiting_opponent' });

                // block UI
                if (throwBtn) throwBtn.disabled = true;
                if (nextTurnBtn) nextTurnBtn.disabled = true;
                if (playButton) playButton.disabled = true;
                if (leaveButton) leaveButton.disabled = false;
                setConfigEnabled(false);

                // connect SSE
                Network.createUpdateEventSource(dataHandler);

            } catch (err) {
                showMessage({ who: 'system', text: err.message });
                // if it fails, reactivate UI to try again
                updatePlayButtonState();
                setConfigEnabled(true);
            }

            return;
        }

        // AI / local

        currentPlayer = 1;
        currentPlayerEl.textContent = currentPlayer;

        const humanNick = "Eu";
        TabStats.start({
            mode: gameMode,
            aiDifficulty,
            cols: parseInt(widthSelect.value, 10),
            myNick: humanNick
        });

        // set opponent info (AI)
        const aiLabel = "IA (" + aiDifficulty + ")";
        const starterName = (vsAI && !humanFirst) ? aiLabel : humanNick;
        TabStats.setOpponentInfo(aiLabel, starterName);

        TabStats.onTurnAdvance();

        showMessage({ who: 'system', key: 'msg_game_started' });

        gameActive = true;

        updatePlayButtonState();
        setConfigEnabled(false);

        if (nextTurnBtn) nextTurnBtn.disabled = true;

        if (vsAI) {
            throwBtn.disabled = (aiPlayerNum === 1);
        } else {
            // if it's PVP, enable throw button for first player
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
                            showMessage({ who: 'system', key: 'msg_player_no_moves_extra' });

                            TabStats.onDice(currentPlayer, result);
                            TabStats.onExtraRoll(currentPlayer, result);

                            // roll again
                            throwBtn.disabled = false;
                            nextTurnBtn.disabled = true;
                        } else {
                            showMessage({ who: 'system', key: 'msg_player_no_moves_pass' });

                            TabStats.onDice(currentPlayer, result);

                            throwBtn.disabled = true;
                            nextTurnBtn.disabled = false;
                        }
                        return;
                    }

                    // moves possible
                    if (isTab) {
                        // Tâb: prioritise capture
                        const convertibleCount = countConvertiblePieces(currentPlayer);

                        if (captureMoves.length > 0) { // make a capture and indicate reroll
                            // first capture, then double
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
                    // immediately disable the button to prevent multiple clicks
                    throwBtn.disabled = true;

                    // request server to roll dice
                    await Network.roll();

                } catch (err) {
                    console.warn('Erro ao lançar dados (PvP):', err);
                    showMessage({ who: 'system', text: err.message });
                    //try again
                    throwBtn.disabled = false;
                }

            }

        });
    }

    // leave button click handler
    leaveButton.addEventListener('click', async () => {
        if (!gameActive && !waitingForPair) return; // if game is not active, do nothing (safety check, because it's disabled in that case)


        // PVP
        if (!vsAI) {
            const myNick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
            const winnerName = shownOpponentNick || "Oponente";


            // request server
            try {
                await Network.leave();
            } catch (err) {
                console.warn("Aviso de saída falhou:", err);
            }

            // final clean up
            showMessage({ who: 'system', key: 'msg_leave_game', params: { player: myNick } });
            handleOnlineWinner(winnerName, myNick);

            return;
        }
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


        }

        // Update leaderboard (winner GW+GP, loser GP) while leaving
        window.updateLeaderboard(winnerName, loserName);

        // Update TabStats to show summary with the winner before resetting
        if (vsAI) {
            TabStats.setWinner(winnerNum);
            TabStats.showSummary();
        }


        // system message that the player has left the game
        showMessage({ who: 'system', key: 'msg_leave_game', params: { player: currentPlayer } });


        endGame();
    });


    // add listener to mode select to update UI accordingly
    if (modeSelect) {
        modeSelect.addEventListener('change', handleModeChange);
    }

    // add listener to IA level select to update Play button state
    if (iaLevelSelect) {
        iaLevelSelect.addEventListener('change', updatePlayButtonState);
    }


    // --- INITIALIZATION --- // 
    const initialCols = widthSelect ? parseInt(widthSelect.value, 10) : 9;
    renderBoard(initialCols);
    showMessage({ who: 'system', key: 'select_mode' });
    // set initial mode UI
    handleModeChange();

    if (nextTurnBtn) nextTurnBtn.disabled = true;
    if (throwBtn) throwBtn.disabled = true;

    //  debug warnings
    if (!widthSelect) console.warn('widthSelect not found');
    if (!gameBoard) console.warn('gameBoard not found');
    if (!messagesEl) console.warn('messagesEl not found');


});