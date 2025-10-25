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
    let soundOn = true;
    let gameActive = false;

    // piece handling
    let redPieces = 0; // player 1
    let yellowPieces = 0; // player 2
    let selectedPiece = null;

    // dice handling
    let lastDiceValue = null;

    // --- Board render (single function, responsive) ---
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

                // seta ícone/arrow conforme padrão — mantém o teu padrão original
                const arrow = document.createElement('i');
                if (r === 0) arrow.className = 'arrow ' + (c === 0 ? 'down' : 'left');
                else if (r === 1) arrow.className = 'arrow ' + (c === cols - 1 ? 'up down' : 'right');
                else if (r === 2) arrow.className = 'arrow ' + (c === 0 ? 'up' : 'left');
                else if (r === 3) arrow.className = 'arrow ' + (c === cols - 1 ? 'up' : 'right');

                // put initial pieces in rows index 0 and 3
                const piece = document.createElement('div');
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
                piece.addEventListener('click', () => selectPiece(piece));

                cell.appendChild(arrow);
                gameBoard.appendChild(cell);
            }
        }
    }

    function flipBoard() {
        const cells = Array.from(gameBoard.querySelectorAll('.cell'));
        const cols = parseInt(gameBoard.style.getPropertyValue('--cols'), 10);

        // remove selection of previously selected piece
        if (selectedPiece) {
            selectedPiece.classList.remove('selected');
        }
        selectedPiece = null;

        // temp map to store where each piece should move
        const tempPositions = [];

        // fill new positions array
        cells.forEach(cell => {
            const piece = cell.querySelector('.piece');

            // if not null
            if (piece) {
                const r = parseInt(cell.dataset.r, 10); // base 10 integer
                const c = parseInt(cell.dataset.c, 10);

                const newR = rows - 1 - r;
                const newC = cols - 1 - c;
                tempPositions.push({ piece, newR, newC });
            }
        });

        // clear all pieces on board
        cells.forEach(cell => cell.innerHTML = cell.innerHTML.replace(/<div class="piece.*?<\/div>/g, ''));

        // place pieces in new positions
        tempPositions.forEach(({ piece, newR, newC }) => {
            const target = gameBoard.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
            if (target) {
                target.appendChild(piece);
            }
        });
    }

    // --- Chat messages ---
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

        if (soundOn && typeof speechSynthesis !== 'undefined') {
            const u = new SpeechSynthesisUtterance(text);
            u.volume = 0.04;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
        }
    }

    // --- Turn handling ---
    function nextTurn() {
        currentPlayer = currentPlayer === 1 ? 2 : 1;
        currentPlayerEl.textContent = currentPlayer;
        showMessage({ who: 'system', text: `Agora é o turno do Jogador ${currentPlayer}.` });

        // flipBoard to show perspective of now current player's turn
        flipBoard();

        const prompts = [
            'Lança os dados!',
            "É o teu turno de jogar",
            'Move a peça X casas',
            'Podes capturar se aterrissares numa peça inimiga',
            'Escolhe uma das tuas peças para mover'
        ];
        const p = prompts[Math.floor(Math.random() * prompts.length)];
        showMessage({ who: 'player', player: currentPlayer, text: p });
    }

    // function to manage piece selection
    function selectPiece(piece) {
        if (!gameActive) {
            return;
        }

        if (selectedPiece == piece) {
            selectedPiece.classList.remove('selected');
            selectedPiece = null;
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

        if (nextTurnBtn) nextTurnBtn.disabled = false;
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
        let secs = 3;
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
            if (throwBtn) throwBtn.disabled = false;
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

    /* === Exemplo: ligar ao botão Throw Dice ===
       - garante que o botão tem id="throwDiceBtn" no index.html
       - adapt a função updateGamePromptWithDice(result) para o teu jogo
    */
    const throwBtn = document.getElementById('throwDiceBtn');
    if (throwBtn) {
        throwBtn.addEventListener('click', async (e) => {
            try {
                // chama o modal e aguarda o resultado
                const result = await window.tabGame.spawnAndLaunch();
                console.log('Resultado do lançamento:', result);
                showMessage({ who: 'player', player: currentPlayer, text: `Dado lançado — valor:  ${result}` });
                // usa o result para atualizar o jogo:
                // substitui a linha abaixo pela função do teu jogo que processa o resultado
                if (typeof updateGamePromptWithDice === 'function') {
                    updateGamePromptWithDice(result);
                } else {
                    // fallback: mostra num prompt/console se ainda não tiveres a função
                    console.log('Chama a tua função para atualizar o jogo com:', result);
                }
            } catch (err) {
                console.warn('Erro ao lançar dados:', err);
            }
        });
    }


});
