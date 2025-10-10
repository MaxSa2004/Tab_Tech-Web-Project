// visualScript.js — versão corrigida
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM refs (agora dentro de DOMContentLoaded) ---
    const widthSelect = document.getElementById('width');
    const gameBoard = document.getElementById('gameBoard');
    const messagesEl = document.getElementById('messages');
    const currentPlayerEl = document.getElementById('currentPlayer');
    const nextTurnBtn = document.getElementById('nextTurn');
    const simDiceBtn = document.getElementById('simDice');
    const toggleMuteBtn = document.getElementById('toggleMute');
    const playButton = document.getElementById('playButton');
    const authForm = document.querySelector('.authForm');

    // modal refs
    const btnInstructions = document.getElementById('myBtnInstructions');
    const btnClassifications = document.getElementById('myBtnClassifications');
    const btnExtra = document.getElementById('myBtnExtra');
    const modalInstructions = document.getElementById('myModalInstructions');
    const modalClassifications = document.getElementById('myModalClassifications');
    const modalExtra = document.getElementById('myModalExtra');

    // estado
    let currentPlayer = 1;
    let soundOn = true;

    // --- Board render (single function, responsive) ---
    function renderBoard(cols) {
        const rows = 4;
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
                else if (r === 1) arrow.className = 'arrow ' + (c === 0 || c === cols - 1 ? 'up down' : 'right');
                else if (r === 2) arrow.className = 'arrow ' + (c === cols - 1 ? 'up down' : 'left');
                else if (r === 3) arrow.className = 'arrow ' + (c === cols - 1 ? 'up' : 'right');

                cell.appendChild(arrow);
                gameBoard.appendChild(cell);
            }
        }
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

    function openModal(modal, opener) {
        if (!modal) return;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        modal._opener = opener || null;
        document.body.classList.add('modal-open');

        // focus no primeiro foco interno
        const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable) focusable.focus();
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        if (modal._opener && typeof modal._opener.focus === 'function') modal._opener.focus();
    }


    // Attach modal openers
    if (btnInstructions) btnInstructions.addEventListener('click', (e) => { e.preventDefault(); openModal(modalInstructions, btnInstructions); });
    if (btnClassifications) btnClassifications.addEventListener('click', (e) => { e.preventDefault(); openModal(modalClassifications, btnClassifications); });
    if (btnExtra) btnExtra.addEventListener('click', (e) => { e.preventDefault(); openModal(modalExtra, btnExtra); });

    // close buttons (.close)
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            const modal = closeBtn.closest('.modal');
            closeModal(modal);
        });
    });

    // overlay click closes when clicking the outer modal container
    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
    });

    // Escape key closes any open modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(m => {
                if (m.style.display === 'block') closeModal(m);
            });
        }
    });

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
