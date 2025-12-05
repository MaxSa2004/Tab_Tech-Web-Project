window.GameUI = (function () {
    let S;

    function init(GameState) {
        S = GameState;
        
        if (S.elements.nextTurnBtn) S.elements.nextTurnBtn.disabled = true;
        if (S.elements.throwBtn) S.elements.throwBtn.disabled = true;

        const {
            playButton, leaveButton, throwBtn, nextTurnBtn, widthSelect,
            modeSelect, iaLevelSelect, firstToPlayCheckbox
        } = S.elements;

        if (playButton) playButton.addEventListener('click', () => {
            const mode = S.elements.modeSelect ? S.elements.modeSelect.value : 'player';
            const aiLevel = S.elements.iaLevelSelect ? S.elements.iaLevelSelect.value : 'normal';
            const humanFirst = S.elements.firstToPlayCheckbox ? !!S.elements.firstToPlayCheckbox.checked : true;
            onPlay && onPlay({ mode, aiLevel, humanFirst });
        });
        if (leaveButton) leaveButton.addEventListener('click', () => onLeave && onLeave());
        if (throwBtn) throwBtn.addEventListener('click', (e) => onThrow && onThrow(e));
        if (nextTurnBtn) nextTurnBtn.addEventListener('click', () => onPass && onPass());
        if (widthSelect) widthSelect.addEventListener('change', () => onWidthChange && onWidthChange(parseInt(widthSelect.value, 10)));
        
        if (modeSelect) modeSelect.addEventListener('change', () => {
            GameState.setConfigEnabled(true);
            updatePlayLeaveButtons();
        });
        if (iaLevelSelect) iaLevelSelect.addEventListener('change', updatePlayLeaveButtons);
        if (firstToPlayCheckbox) firstToPlayCheckbox.addEventListener('change', updatePlayLeaveButtons);

        updatePlayLeaveButtons();
        attachBoardEvents();
    }

    function updatePlayLeaveButtons() {
        const { playButton, leaveButton } = S.elements;
        if (!playButton) return;
        const canPlay = Rules.isConfigValid(S.elements) && !S.gameActive && !S.waitingForPair;
        playButton.disabled = !canPlay;
        if (leaveButton) leaveButton.disabled = !!(S.gameActive || S.waitingForPair) ? false : true;
    }

    function renderBoard(cols) {
        const boardEl = S?.elements?.gameBoard;
        if (!boardEl) return;

        boardEl.innerHTML = '';
        S.cols = cols;
        boardEl.style.setProperty('--cols', String(cols));

        // Limpeza visual
        boardEl.classList.remove('p2-view', 'flipped');

        // IMPORTANTE: data-r/data-c SEMPRE SÃO COORDENADAS LÓGICAS
        // 0 = topo, 3 = base. Isto garante consistência com as regras e servidor.
        for (let r = 0; r < S.rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.r = String(r);
                cell.dataset.c = String(c);

                // Direções conforme especificaste:
                // r=0: direita->esquerda, exceto c=0 desce
                // r=1: esquerda->direita, exceto c=cols-1 pode subir ou descer (up down)
                // r=2: direita->esquerda, exceto c=0 sobe
                // r=3: esquerda->direita, exceto c=cols-1 sobe
                let dir = '';
                if (r === 0) {
                    dir = (c === 0) ? 'down' : 'left';
                } else if (r === 1) {
                    dir = (c === cols - 1) ? 'up down' : 'right';
                } else if (r === 2) {
                    dir = (c === 0) ? 'up' : 'left';
                } else if (r === 3) {
                    dir = (c === cols - 1) ? 'up' : 'right';
                }

                const arrow = document.createElement('i');
                arrow.className = 'arrow ' + dir;

                // Peças de arranque (lógica): r=0 amarelas (oponente), r=3 vermelhas (minhas)
                if (r === 0) {
                    const piece = document.createElement('div');
                    piece.classList.add('piece', 'yellow');
                    piece.setAttribute('move-state', 'not-moved');
                    cell.appendChild(piece);
                }
                if (r === 3) {
                    const piece = document.createElement('div');
                    piece.classList.add('piece', 'red');
                    piece.setAttribute('move-state', 'not-moved');
                    cell.appendChild(piece);
                }

                cell.appendChild(arrow);
                boardEl.appendChild(cell);
            }
        }

        // Perspetiva visual para P2 pode ser feita por CSS (opcional).
        // Não alteramos data-r/data-c, só estilo.
        if (S.humanPlayerNum === 2) {
            boardEl.classList.add('p2-view'); // define no CSS: .p2-view { transform: rotate(180deg); } se quiseres flip visual.
        }
    }

    function attachBoardEvents() {
        const boardEl = S?.elements?.gameBoard;
        if (!boardEl) return;
        
        const newBoard = boardEl.cloneNode(true);
        boardEl.parentNode.replaceChild(newBoard, boardEl);
        S.elements.gameBoard = newBoard;

        newBoard.addEventListener('click', (e) => {
            const cellEl = e.target.closest('.cell');
            if (!cellEl) return;
            const r = parseInt(cellEl.dataset.r, 10);
            const c = parseInt(cellEl.dataset.c, 10);

            if (S.vsPlayer) {
                onCellClick && onCellClick(r, c, cellEl);
            } else {
                onCellClick && onCellClick(cellEl);
            }
        });
    }

    function clearHighlights() {
        const { gameBoard } = S.elements;
        if (!gameBoard) return;
        gameBoard.querySelectorAll('.cell.green-glow').forEach(c => c.classList.remove('green-glow', 'pulse'));
        gameBoard.querySelectorAll('.red-flash').forEach(c => c.classList.remove('red-flash'));
    }

    function movePieceTo(piece, destCell) {
        const existingPiece = destCell.querySelector('.piece');
        if (existingPiece) {
            const isRedDying = existingPiece.classList.contains('red');
            const colorName = isRedDying ? 'red' : 'yellow';
            try { TabStats.onCapture(S.currentPlayer, colorName); } catch {}

            if (isRedDying) {
                S.redPieces--; 
                if (window.Messages) window.Messages.system('red_pieces', { count: S.redPieces });
                Rules.sendCapturedPieceToContainer(existingPiece, S.currentPlayer, S);
            } else {
                S.yellowPieces--; 
                if (window.Messages) window.Messages.system('yellow_pieces', { count: S.yellowPieces });
                Rules.sendCapturedPieceToContainer(existingPiece, S.currentPlayer, S);
            }
        }

        const destRow = parseInt(destCell.dataset.r, 10);
        const currentState = piece.getAttribute('move-state');
        if (destRow === 0 || currentState === 'row-four') {
            piece.setAttribute('move-state', 'row-four');
        }
        destCell.appendChild(piece);
        try { TabStats.onMove(S.currentPlayer); } catch {}
    }

    function flipBoard() {}

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