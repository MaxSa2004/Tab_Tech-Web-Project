// DOMContentLoaded ensures that all html is loaded before script runs
document.addEventListener("DOMContentLoaded", () => {
    const widthSelect = document.getElementById('width');
    const gameBoard = document.getElementById('gameBoard');
    const messagesEl = document.getElementById('messages');
    const currentPlayerEl = document.getElementById('currentPlayer');
    const nextTurnBtn = document.getElementById('nextTurn');
    const simDiceBtn = document.getElementById('throwDiceBtn');
    const toggleMuteBtn = document.getElementById('toggleMute');
    const playButton = document.getElementById('playButton');
    const authForm = document.querySelector('.authForm');
    const rows = 4;

    // estado
    let currentPlayer = 1; // 1 or 2
    let gameActive = false;

    // piece handling
    let redPieces = 0; // player 1
    let yellowPieces = 0; // player 2
    let selectedPiece = null;

    // dice handling
    let lastDiceValue = null;

    // ---- KEY FUNCTIONS ----
    function renderBoard(cols) {
        redPieces = cols;
        yellowPieces = cols;
        // atualiza CSS var e grid-template
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

                // put initial pieces in rows index 0 and 3
                const piece = document.createElement('div');

                // states:
                //  not-moved = never moved before, can only be moved by 1 space initially
                //  moved = moved before can move any amount (never reached 4th row before)
                //  row-four = moved and been in row 4 before (can never revisit row 4)
                piece.setAttribute('move-state', 'not-moved');

                piece.classList.add('piece');
                // yellow
                if (r == 0) {
                    piece.classList.add('yellow');
                    cell.appendChild(piece);
                }
                // red
                if (r == 3) {
                    piece.classList.add('red');
                    cell.appendChild(piece);
                }

                // add event listener to be used for piece selection
                //piece.addEventListener('click', () => selectPiece(piece));

                // event listener for cell (handles clicks to play moves)
                cell.addEventListener('click', () => handleCellClick(cell))

                cell.appendChild(arrow);
                gameBoard.appendChild(cell);
            }
        }
    }

    // --------------- TO COMPLETE ---------------

    // function to manage piece selection
    function selectPiece(piece) {
        if (!gameActive) {
            return;
        }

        if (selectedPiece == piece) {
            selectedPiece.classList.remove('selected');
            selectedPiece = null;
            clearHighlights(); // piece is unselected now so clear highlights
            return;
        }

        // make sure only current player's pieces can be selected
        if ((currentPlayer == 1 && piece.classList.contains('red')) ||
            (currentPlayer == 2 && piece.classList.contains('yellow'))) {
            // remove selected tag from previously selected piece
            if (selectedPiece) {
                selectedPiece.classList.remove('selected');
            }

            selectedPiece = piece;

            // add selected tag to currently selected piece
            piece.classList.add('selected');
        }
    }

    // helper: clear any highlight classes
    function clearHighlights() {
        gameBoard.querySelectorAll('.cell.green-glow').forEach(c => {
            c.classList.remove('green-glow', 'pulse');
        });
    }

    // to complete
    function handleCellClick(cell) {
        if (!gameActive) return;

        const pieceInCell = cell.querySelector('.piece');

        // if it's your piece, select it
        if (pieceInCell && ((currentPlayer == 1 && pieceInCell.classList.contains('red')) ||
            (currentPlayer == 2 && pieceInCell.classList.contains('yellow')))) {
            selectPiece(pieceInCell);

            // if selectPiece just deselected the piece, selectedPiece will be null —
            // bail out now so we don't re-highlight.
            if (!selectedPiece) {
                return;
            }

            clearHighlights();

            // restrict highlights if piece hasn't moved yet
            const state = pieceInCell.getAttribute('move-state');
            const diceAllowed = (state === 'not-moved' && lastDiceValue !== 1)
                ? [] // not allowed to move
                : getValidMoves(pieceInCell);

            diceAllowed.forEach(dest => dest.classList.add('green-glow'));
            return;
        }

        // otherwise, try moving/capturing with the currently selected piece
        if (selectedPiece && lastDiceValue != null) {
            const state = selectedPiece.getAttribute('move-state');
            if (state === 'not-moved' && lastDiceValue !== 1) {
                return;
            }

            const possibleMoves = getValidMoves(selectedPiece);
            const isValidMove = possibleMoves.some(dest => dest === cell);

            if (isValidMove) {
                if (state === 'not-moved' && lastDiceValue === 1) {
                    selectedPiece.setAttribute('move-state', 'moved');
                }
                movePieceTo(selectedPiece, cell); // will remove enemy piece automatically
                clearHighlights();
                selectedPiece.classList.remove('selected');
                selectedPiece = null;

                const win = checkWinCondition();
                if (win) {
                    return;
                }

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



    // --------------- TO COMPLETE ---------------
    function getValidMoves(piece, diceValue = lastDiceValue) {
        if (!piece || diceValue == null) return [];

        const startCell = piece.parentElement;
        const rows = 4;
        const cols = parseInt(gameBoard.style.getPropertyValue('--cols'), 10);

        const r = parseInt(startCell.dataset.r, 10);
        const c = parseInt(startCell.dataset.c, 10);
        const moveState = piece.getAttribute('move-state');

        // identify current player color
        const playerClass = piece.classList.contains('red') ? 'red' : 'yellow';

        // RULE: cannot enter top row if any of your pieces remain in bottom row
        const hasBasePieces = Array
            .from(gameBoard.querySelectorAll(`.piece.${playerClass}`))
            .some(p => parseInt(p.parentElement.dataset.r, 10) === 3);

        // --- special case: piece in row 1 ---
        if (r === 1) {
            let remaining = diceValue;
            let currentC = c;

            // move horizontally to the right along row 1
            const stepsToRightEnd = cols - 1 - currentC;
            const horizontalMove = Math.min(remaining, stepsToRightEnd);
            currentC += horizontalMove;
            remaining -= horizontalMove;

            // if all movement done on row 1, just return that cell
            if (remaining === 0) {
                const targetCell = gameBoard.querySelector(`.cell[data-r="1"][data-c="${currentC}"]`);
                return targetCell ? [targetCell] : [];
            }

            // spillover: can go UP or DOWN from current column
            const targets = [];
            const upCell = gameBoard.querySelector(`.cell[data-r="0"][data-c="${currentC}"]`);
            const downCell = gameBoard.querySelector(`.cell[data-r="2"][data-c="${currentC}"]`);

            // Rule: if piece is row-four and NOT currently in top row, forbid moving into row 0
            if (!hasBasePieces && !(moveState === 'row-four' && r !== 0) && upCell) {
                targets.push({ cell: upCell, r: 0, c: currentC });
            }
            if (downCell) targets.push({ cell: downCell, r: 2, c: currentC });

            // if remaining > 1, continue moving along arrow path for each option
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

                        // block movement back into top row if already row-four and not currently in top row
                        if (moveState === 'row-four' && r !== 0 && newR === 0) break;

                        currentCell = gameBoard.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
                    }
                    if (currentCell) furtherTargets.push(currentCell);
                });
                return furtherTargets;
            }

            // if remaining === 1, just return UP/DOWN cells
            return targets.map(t => t.cell);
        }

        // --- normal movement along arrow path for other rows ---
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

            // block entering top row if base pieces remain, or if row-four piece tries to re-enter
            if ((hasBasePieces && newR === 0) || (moveState === 'row-four' && r !== 0 && newR === 0)) break;

            currentCell = gameBoard.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
        }

        return currentCell ? [currentCell] : [];
    }




    function movePieceTo(piece, destCell) {
        const existingPiece = destCell.querySelector('.piece');
        if (existingPiece) {
            // capture logic: remove enemy piece
            if (existingPiece.classList.contains('red')) {
                redPieces--;
                showMessage({ who: 'system', text: `Red pieces remaining: ${redPieces}.` });
            } else if (existingPiece.classList.contains('yellow')) {
                yellowPieces--;
                showMessage({ who: 'system', text: `Yellow pieces remaining: ${yellowPieces}.` });
            }
            existingPiece.remove();
        }

        const destRow = parseInt(destCell.dataset.r, 10);
        const currentState = piece.getAttribute('move-state');

        // if the dest is top row or already been in row-four before
        if (destRow === 0 || currentState === 'row-four') {
            piece.setAttribute('move-state', 'row-four');
        }

        destCell.appendChild(piece);
    }



    function flipBoard() {
        lastDiceValue = null;
        throwBtn.disabled = false;
        nextTurnBtn.disabled = true;

        const cols = parseInt(gameBoard.style.getPropertyValue('--cols'), 10);
        const cells = Array.from(gameBoard.querySelectorAll('.cell'));

        // remove selection
        if (selectedPiece) {
            selectedPiece.classList.remove('selected');
            selectedPiece = null;
        }

        // collect all current pieces with their flipped coordinates
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

        // clear ALL pieces but leave arrows intact
        cells.forEach(cell => {
            const piece = cell.querySelector('.piece');
            if (piece) piece.remove();
        });

        // append each piece to its mirrored destination
        newPositions.forEach(({ piece, newR, newC }) => {
            const dest = gameBoard.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
            if (dest) dest.appendChild(piece);
        });
    }


    // --- Turn handling ---
    function nextTurn() {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        currentPlayerEl.textContent = currentPlayer;
        showMessage({ who: 'system', text: `Agora é o turno do Jogador ${currentPlayer}.` });

        // flipBoard to show perspective of now current player's turn
        flipBoard();

    }

    function checkWinCondition() {
        if (redPieces == 0) {
            showMessage({ who: 'system', text: "PLAYER 2 WINS!" });
            endGame();
            return true;
        } else if (yellowPieces == 0) {
            showMessage({ who: 'system', text: "PLAYER 1 WINS!" });
            endGame();
            return true;
        }

        return false; // nobody won
    }

    // reset all settings and global vars back to initial values
    function endGame() {
        // estado
        currentPlayer = 1; // 1 or 2
        gameActive = false;

        // piece handling
        redPieces = 0; // player 1
        yellowPieces = 0; // player 2
        selectedPiece = null;

        // dice handling
        lastDiceValue = null;
        renderBoard(parseInt(widthSelect.value, 10)); // reset the board to initial state
        nextTurnBtn.disabled = true;
        simDiceBtn.disabled = true;
    }

    // ------------------ Chat messages ------------------
    function showMessage({ who = 'system', player = null, text }) {
        const wrap = document.createElement('div');
        wrap.className = 'message';
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = text;

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

    // --- Event listeners for UI ---
    if (nextTurnBtn) nextTurnBtn.addEventListener('click', nextTurn);
    if (widthSelect) widthSelect.addEventListener('change', () => renderBoard(parseInt(widthSelect.value, 10)));
    if (toggleMuteBtn) toggleMuteBtn.addEventListener('click', (e) => {
        soundOn = !soundOn;
        e.target.textContent = soundOn ? 'Som: ligado' : 'Som: desligado';
    });
    if (authForm) authForm.addEventListener('submit', (ev) => ev.preventDefault());

    // Play button behaviour
    if (playButton) playButton.addEventListener('click', () => {
        showMessage({ who: 'system', text: 'Jogo iniciado — boas jogadas!' });
        gameActive = true;

        if (nextTurnBtn) nextTurnBtn.disabled = true;
        if (simDiceBtn) simDiceBtn.disabled = false;
    });

    // initially inactive (becomes active when game started)
    if (nextTurnBtn) nextTurnBtn.disabled = true;
    if (simDiceBtn) simDiceBtn.disabled = true;

    // simDice disabled for now (kept for future)
    if (simDiceBtn) simDiceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (simDiceBtn.disabled) return;
    });

    // --- initial rendering / seed messages ---
    const initialCols = widthSelect ? parseInt(widthSelect.value, 10) : 9;
    renderBoard(initialCols);
    showMessage({ who: 'system', text: 'Bem-vindo! Use "Mudar turno" para simular.' });
    showMessage({ who: 'player', player: 1, text: 'Lança os dados! (simulação)' });

    // debug warnings for missing DOM pieces (console helps)
    if (!widthSelect) console.warn('widthSelect not found');
    if (!gameBoard) console.warn('gameBoard not found');
    if (!messagesEl) console.warn('messagesEl not found');

    /* ======= integração dos "dados" (pawns) no gameScript.js ======= */
    /* Probabilidades para nº de paus virados para cima (0..4): 6%,25%,38%,25%,6% */
    const upCountProbs = [0.06, 0.25, 0.38, 0.25, 0.06];
    const namesMap = { 0: "Sitteh (0 → 6)", 1: "Tâb", 2: "Itneyn", 3: "Teláteh", 4: "Arba'ah" };

    /* helper */
    function sampleFromDistribution(probs) {
        const r = Math.random();
        let c = 0;
        for (let i = 0; i < probs.length; i++) {
            c += probs[i];
            if (r <= c) return i;
        }
        return probs.length - 1;
    }

    /*-- variáveis internas para a Promise --*/
    window.tabGame = window.tabGame || {};
    window.tabGame._resolveResult = null;

    /* cria o overlay + pouch e lança automaticamente se autoDrop true */
    function createDicePouch(autoDrop = false) {
        // se já houver overlay, remove (garantir estado limpo)
        const prev = document.body.querySelector('.dice-overlay');
        if (prev) prev.remove();

        // overlay centrado na viewport
        const overlay = document.createElement('div');
        overlay.className = 'dice-overlay';

        // arena dentro do overlay
        const arena = document.createElement('div');
        arena.className = 'dice-arena';
        overlay.appendChild(arena);

        // log/hint opcional
        const hint = document.createElement('div');
        hint.style.position = 'absolute';
        hint.style.bottom = '12px';
        hint.style.left = '14px';
        hint.style.fontSize = '13px';
        hint.style.color = '#333';
        hint.style.opacity = '0.8';
        hint.textContent = 'Lançamento automático...';
        arena.appendChild(hint);

        // pouch (conteúdo com os 4 paus)
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
            faceUp.textContent = 'CIMA';
            const faceDown = document.createElement('div');
            faceDown.className = 'face dice-face-down';
            faceDown.textContent = 'BAIXO';
            s.appendChild(faceUp);
            s.appendChild(faceDown);
            pouch.appendChild(s);
        }

        document.body.appendChild(overlay);

        // lock UI: desativa botão se existir
        const throwBtn = document.getElementById('throwDiceBtn');
        if (throwBtn) throwBtn.disabled = true;

        if (autoDrop) {
            // pequeno atraso para render
            setTimeout(() => dropDiceSticks(pouch, arena, overlay), 120);
        }
    }

    /* animação e resultado */
    function dropDiceSticks(pouch, arena, overlay) {
        const sticks = Array.from(pouch.querySelectorAll('.dice-stick'));

        // escolhe quantos ficam up (0..4)
        const chosenUpCount = sampleFromDistribution(upCountProbs);

        // escolhe quais dos 4 serão "up"
        const indices = [0, 1, 2, 3];
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const results = new Array(4).fill(false);
        for (let k = 0; k < chosenUpCount; k++) results[indices[k]] = true;

        // calcula espaçamento
        const maxWide = Math.min(window.innerWidth, 900);
        const gapPx = Math.max(54, Math.round(maxWide * 0.08));
        sticks.forEach((s, i) => {
            s.classList.remove('initial');
            void s.offsetWidth; // forçar reflow
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

            // regista valores
            lastDiceValue = gameValue;

            // mostra overlay com resultado (contador) dentro do mesmo overlay
            showDiceResult(gameValue, actualUp, overlay);

            // resolve Promise se alguém está à espera
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

    /* mostrador de resultado + fecho automático */
    function showDiceResult(gameValue, upCount, overlay) {
        // limpa overlay anterior de result bubble, se houver
        const prevBubble = overlay.querySelector('.dice-result-bubble');
        if (prevBubble) prevBubble.remove();

        const bubble = document.createElement('div');
        bubble.className = 'dice-result-bubble';

        const big = document.createElement('div'); big.className = 'big';
        big.textContent = String(gameValue);
        const label = document.createElement('div'); label.className = 'label';
        label.innerHTML = `${namesMap[upCount] || 'Resultado'} — paus virados para cima: ${upCount}`;

        const countdown = document.createElement('div');
        countdown.className = 'dice-countdown';
        let secs = 2;
        countdown.textContent = `Fechando em ${secs}s`;

        bubble.appendChild(big);
        bubble.appendChild(label);
        bubble.appendChild(countdown);

        // centro do overlay
        overlay.appendChild(bubble);

        // anima balão
        setTimeout(() => bubble.classList.add('show'), 20);

        // contador visual
        const intervalId = setInterval(() => {
            secs -= 1;
            if (secs > 0) {
                countdown.textContent = `Fechando em ${secs}s`;
            } else {
                countdown.textContent = `Fechando...`;
                clearInterval(intervalId);
            }
        }, 1000);
        overlay._countdownInterval = intervalId;

        // auto close
        overlay._autoCloseTimer = setTimeout(() => {
            if (overlay._countdownInterval) {
                clearInterval(overlay._countdownInterval);
                overlay._countdownInterval = null;
            }
            const ov = document.body.querySelector('.dice-overlay');
            if (ov) ov.remove();

            const throwBtn = document.getElementById('throwDiceBtn');
        }, 3000);

    }

    /* interface pública: spawnAndLaunch devolve Promise */
    window.tabGame.spawnAndLaunch = function () {
        return new Promise((resolve, reject) => {
            // se já está a correr, rejeita
            if (document.body.querySelector('.dice-overlay')) {
                return reject(new Error('Outro lançamento em curso'));
            }
            // guarda resolver
            window.tabGame._resolveResult = resolve;
            // cria e lança automaticamente
            createDicePouch(true);
        });
    };

    /* getters úteis (opcionais) */
    window.tabGame.getLastValue = () => lastDiceValue;

    const throwBtn = document.getElementById('throwDiceBtn');
    if (throwBtn) {
        throwBtn.addEventListener('click', async (e) => {
            try {
                // chama o modal e aguarda o resultado
                const result = await window.tabGame.spawnAndLaunch();
                console.log('Resultado do lançamento:', result);
                showMessage({ who: 'player', player: currentPlayer, text: `Dado lançado — valor:  ${result}` });

                if (hasValidMove()) {
                    nextTurnBtn.disabled = true; // no skipping yet
                    throwBtn.disabled = true;
                    console.log("HERE");

                    if (result === 4) {
                        showMessage({ who: 'system', text: 'Tiraste 4 - ganhas outro lançamento!' });
                    } else if (result === 6) {
                        showMessage({ who: 'system', text: 'Tiraste 6 - ganhas outro lançamento!' });
                    } else if (result === 1) {
                        showMessage({ who: 'system', text: 'Tiraste 1 - ganhas outro lançamento!' });
                    }
                    return;
                }


                // handle button state after rolling
                // if player rolls 4 or 6 - they get another roll (keep throw active)
                if (result === 4) {
                    showMessage({ who: 'system', text: 'Tiraste 4 - ganhas outro lançamento!' });
                    throwBtn.disabled = false;  // keep active
                    nextTurnBtn.disabled = true; // no skipping yet
                } else if (result === 6) {
                    showMessage({ who: 'system', text: 'Tiraste 6 - ganhas outro lançamento!' });
                    throwBtn.disabled = false;  // keep active
                    nextTurnBtn.disabled = true; // no skipping yet
                } else if (result === 1) {
                    showMessage({ who: 'system', text: 'Tiraste 1 - ganhas outro lançamento!' });
                    throwBtn.disabled = false;  // keep active
                    nextTurnBtn.disabled = true; // no skipping yet
                }
                else {
                    // otherwise, lock the dice until next turn
                    throwBtn.disabled = true;
                    nextTurnBtn.disabled = false;
                }

            } catch (err) {
                console.warn('Erro ao lançar dados:', err);
            }
        });
    }

    // returns true if `player` (defaults to currentPlayer) has at least one legal move
    function hasValidMove(player = currentPlayer, diceValue = lastDiceValue) {
        // if no dice rolled, there are no moves to evaluate
        if (diceValue == null) return false;

        const playerClass = player === 1 ? 'red' : 'yellow';
        const ownPieces = Array.from(gameBoard.querySelectorAll('.piece.' + playerClass));

        for (const piece of ownPieces) {
            const state = piece.getAttribute('move-state');

            // rule: pieces with move-state 'not-moved' can only move when diceValue === 1
            if (state === 'not-moved' && diceValue !== 1) continue;

            // get possible destination cells for this piece
            const possible = getValidMoves(piece, diceValue);
            if (!possible || possible.length === 0) continue;

            // filter out destinations blocked by same-player pieces; captures allowed
            for (const dest of possible) {
                const occupant = dest.querySelector('.piece');
                if (!occupant) {
                    // empty destination -> valid move found
                    return true;
                }
                // if occupied by opponent, it's a valid capture
                if (!occupant.classList.contains(playerClass)) {
                    return true;
                }
                // else occupied by own piece -> not a valid destination
            }
        }

        // no piece had a valid destination
        return false;
    }

});
