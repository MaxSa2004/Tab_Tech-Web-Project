window.GameUI = (function () {
    let S;

    function init(GameState) {
        S = GameState;
        if (S.elements.nextTurnBtn) {
            S.elements.nextTurnBtn.disabled = true;
        }
        if (S.elements.throwBtn) {
            S.elements.throwBtn.disabled = true;
        }

        const {
            playButton, leaveButton, throwBtn, nextTurnBtn, widthSelect,
            modeSelect, iaLevelSelect, firstToPlayCheckbox
        } = S.elements;
        if (playButton) playButton.addEventListener('click', () => {
            const modeSelect = S.elements.modeSelect;
            const iaLevelSelect = S.elements.iaLevelSelect;
            const firstToPlay = S.elements.firstToPlayCheckbox;
            const mode = modeSelect ? modeSelect.value : 'player';
            const aiLevel = iaLevelSelect ? iaLevelSelect.value : 'normal';
            const humanFirst = firstToPlay ? !!firstToPlay.checked : true;
            onPlay && onPlay({ mode, aiLevel, humanFirst });
        });
        if (leaveButton) leaveButton.addEventListener('click', () => onLeave && onLeave());
        if (throwBtn) throwBtn.addEventListener('click', (e) => onThrow && onThrow(e));
        if (nextTurnBtn) nextTurnBtn.addEventListener('click', () => onPass && onPass());
        if (widthSelect) widthSelect.addEventListener('change', () => onWidthChange && onWidthChange(parseInt(widthSelect.value, 10))); updatePlayLeaveButtons();

        if (modeSelect) modeSelect.addEventListener('change', () => {
            // re-apply config enable rules and play/leave state
            GameState.setConfigEnabled(true);
            updatePlayLeaveButtons();
        });
        if (iaLevelSelect) iaLevelSelect.addEventListener('change', updatePlayLeaveButtons);
        if (firstToPlayCheckbox) firstToPlayCheckbox.addEventListener('change', updatePlayLeaveButtons);

        // Ensure initial state is correct
        updatePlayLeaveButtons();
    }

    function updatePlayLeaveButtons() {
        const { playButton, leaveButton } = S.elements;
        if (!playButton) return;
        const canPlay = Rules.isConfigValid(S.elements) && !S.gameActive && !S.waitingForPair;
        playButton.disabled = !canPlay;
        if (leaveButton) leaveButton.disabled = !!(S.gameActive || S.waitingForPair) ? false : true;
    }

    function renderBoard(cols) {
        const { gameBoard } = S.elements;
        const rows = S.rows;
        S.redPieces = cols;
        S.yellowPieces = cols;
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

                if (r === 0) { piece.classList.add('yellow'); cell.appendChild(piece); }
                if (r === 3) { piece.classList.add('red'); cell.appendChild(piece); }

                cell.addEventListener('click', () => onCellClick && onCellClick(r, c, cell));
                cell.appendChild(arrow);
                gameBoard.appendChild(cell);
            }
        }
    }

    function clearHighlights() {
        const { gameBoard } = S.elements;
        gameBoard.querySelectorAll('.cell.green-glow').forEach(c => c.classList.remove('green-glow', 'pulse'));
    }

    // Dentro de game_UI.js

    function movePieceTo(piece, destCell) {
        // 1. Verificar se existe peça no destino (Captura)
        const existingPiece = destCell.querySelector('.piece');

        if (existingPiece) {
            // Determinar a cor da peça que vai morrer
            const isRedDying = existingPiece.classList.contains('red');
            const colorName = isRedDying ? 'red' : 'yellow';

            console.log(`[UI] Captura detetada! Peça ${colorName} foi comida.`);

            // Atualizar Stats
            try { TabStats.onCapture(S.currentPlayer, colorName); } catch { }

            // 2. Atualizar contadores no GameState (S) e mostrar mensagem
            // Importante: Usamos o objeto global Messages para garantir que funciona
            if (isRedDying) {
                S.redPieces--; // Atualiza estado global
                // Usa window.Messages para garantir acesso
                if (window.Messages) window.Messages.system('red_pieces', { count: S.redPieces });
                Rules.sendCapturedPieceToContainer(existingPiece, S.currentPlayer, S);
            } else {
                S.yellowPieces--; // Atualiza estado global
                if (window.Messages) window.Messages.system('yellow_pieces', { count: S.yellowPieces });
                Rules.sendCapturedPieceToContainer(existingPiece, S.currentPlayer, S);
            }
        }

        // 3. Lógica de movimento visual (igual ao que tinhas)
        const destRow = parseInt(destCell.dataset.r, 10);
        const currentState = piece.getAttribute('move-state');

        // Se chegou à última linha, muda o estado
        if (destRow === 0 || currentState === 'row-four') {
            piece.setAttribute('move-state', 'row-four');
        }

        destCell.appendChild(piece);

        try { TabStats.onMove(S.currentPlayer); } catch { }
    }

    function flipBoard() {
        S.lastDiceValue = null;
        const { throwBtn, nextTurnBtn } = S.elements;
        if (throwBtn) throwBtn.disabled = (S.vsAI && (S.currentPlayer === S.aiPlayerNum));
        if (nextTurnBtn) nextTurnBtn.disabled = true;

        const cols = S.getCols();
        const cells = Array.from(S.elements.gameBoard.querySelectorAll('.cell'));
        if (S.selectedPiece) { S.selectedPiece.classList.remove('selected'); S.selectedPiece = null; }

        const newPositions = [];
        cells.forEach(cell => {
            const piece = cell.querySelector('.piece');
            if (piece) {
                const r = parseInt(cell.dataset.r, 10);
                const c = parseInt(cell.dataset.c, 10);
                const newR = S.rows - 1 - r;
                const newC = cols - 1 - c;
                newPositions.push({ piece, newR, newC });
            }
        });

        cells.forEach(cell => {
            const piece = cell.querySelector('.piece');
            if (piece) piece.remove();
        });

        newPositions.forEach(({ piece, newR, newC }) => {
            const dest = S.elements.gameBoard.querySelector(`.cell[data-r="${newR}"][data-c="${newC}"]`);
            if (dest) dest.appendChild(piece);
        });
    }

    // UI events wiring
    let onCellClick, onPlay, onLeave, onThrow, onPass, onWidthChange;

    function onCellClickRegister(cb) { onCellClick = cb; }
    function onPlayRegister(cb) { onPlay = cb; }
    function onLeaveRegister(cb) { onLeave = cb; }
    function onThrowRegister(cb) { onThrow = cb; }
    function onPassRegister(cb) { onPass = cb; }
    function onWidthChangeRegister(cb) { onWidthChange = cb; }


    return {
        init,
        renderBoard,
        clearHighlights,
        movePieceTo,
        flipBoard,
        onCellClick: onCellClickRegister,
        onPlay: onPlayRegister,
        onLeave: onLeaveRegister,
        onThrow: onThrowRegister,
        onPass: onPassRegister,
        onWidthChange: onWidthChangeRegister,
        updatePlayLeaveButtons
    };
})();