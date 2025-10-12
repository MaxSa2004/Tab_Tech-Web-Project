// DOMContentLoaded ensures that all html is loaded before script runs
document.addEventListener("DOMContentLoaded", () => {
    const widthSelect = document.getElementById('width');
    const gameBoard = document.getElementById('gameBoard');
    const messagesEl = document.getElementById('messages');
    const currentPlayerEl = document.getElementById('currentPlayer');
    const nextTurnBtn = document.getElementById('nextTurn');
    const simDiceBtn = document.getElementById('simDice');
    const toggleMuteBtn = document.getElementById('toggleMute');
    const playButton = document.getElementById('playButton');
    const authForm = document.querySelector('.authForm');
    const rows = 4;

    // estado
    let currentPlayer = 1; // 1 or 2
    let soundOn = true;

    // piece handling
    let redPieces = 0; // player 1
    let yellowPieces = 0; // player 2
    let selectedPiece = null;

    // dice handling
    let diceValue = 0;

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

                cell.appendChild(arrow);
                gameBoard.appendChild(cell);
            }
        }
    }

    function flipBoard() {
        const cells = Array.from(gameBoard.querySelectorAll('.cell'));
        const cols = parseInt(gameBoard.style.getPropertyValue('--cols'), 10);

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

    // --- Event listeners for UI ---
    if (nextTurnBtn) nextTurnBtn.addEventListener('click', nextTurn);
    if (widthSelect) widthSelect.addEventListener('change', () => renderBoard(parseInt(widthSelect.value, 10)));
    if (toggleMuteBtn) toggleMuteBtn.addEventListener('click', (e) => {
        soundOn = !soundOn;
        e.target.textContent = soundOn ? 'Som: ligado' : 'Som: desligado';
    });
    if (authForm) authForm.addEventListener('submit', (ev) => ev.preventDefault());

    // Play button sample behaviour
    if (playButton) playButton.addEventListener('click', () => {
        showMessage({ who: 'system', text: 'Jogo iniciado — boas jogadas!' });
    });

    // simDice disabled for now (kept for future)
    if (simDiceBtn) simDiceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (simDiceBtn.disabled) return;
        // future: roll dice
        showMessage({ who: 'player', player: currentPlayer, text: 'Dado lançado (simulado) — valor: 3' });
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
});
