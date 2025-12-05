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
            GameState.setConfigEnabled(true);
            updatePlayLeaveButtons();
        });
        if (iaLevelSelect) iaLevelSelect.addEventListener('change', updatePlayLeaveButtons);
        if (firstToPlayCheckbox) firstToPlayCheckbox.addEventListener('change', updatePlayLeaveButtons);

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

        // Loops VISUAIS (0 é topo do ecrã, 3 é fundo do ecrã)
        for (let visualR = 0; visualR < rows; visualR++) {
            for (let visualC = 0; visualC < cols; visualC++) {
                
                const cell = document.createElement('div');
                cell.className = 'cell';

                // CÁLCULO DA LÓGICA (PERSPECTIVA)
                // Se eu sou o Player 2, inverto a lógica para bater certo com o visual.
                // Ex: Visual Fundo (Row 3) deve corresponder à minha Base Lógica (Row 0).
                
                let logicR = visualR;
                let logicC = visualC;

                if (S.humanPlayerNum === 2) {
                    logicR = (rows - 1) - visualR;       // Inverte Linhas
                    logicC = (cols - 1) - visualC;       // Inverte Colunas
                }

                // Guardamos a coordenada LÓGICA no HTML.
                // Assim, quando clicas, o JS recebe a coordenada certa para o servidor.
                cell.dataset.r = logicR;
                cell.dataset.c = logicC;

                // SETAS (Baseadas na Posição VISUAL)
                // Queremos que a base (fundo) aponte sempre para a direita, seja eu P1 ou P2.
                const arrow = document.createElement('i');
                let dir = '';
                
                // Usamos visualR e visualC para desenhar as setas fixas
                if (visualR === 0) dir = (visualC === 0 ? 'down' : 'left');
                else if (visualR === 1) dir = (visualC === cols - 1 ? 'up down' : 'right');
                else if (visualR === 2) dir = (visualC === 0 ? 'up' : 'left');
                else if (visualR === 3) dir = (visualC === cols - 1 ? 'up' : 'right');
                
                arrow.className = 'arrow ' + dir;

                // PEÇAS (Baseadas na Lógica)
                const piece = document.createElement('div');
                piece.setAttribute('move-state', 'not-moved');
                piece.classList.add('piece');

                // Colocamos as peças nas suas linhas LÓGICAS
                // Row 0 lógica recebe amarelo. Row 3 lógica recebe vermelho.
                // O HTML (visualR) encarrega-se de mostrar onde deve.
                if (logicR === 0) { piece.classList.add('yellow'); cell.appendChild(piece); }
                if (logicR === 3) { piece.classList.add('red'); cell.appendChild(piece); }

                cell.addEventListener('click', () => onCellClick && onCellClick(logicR, logicC, cell));
                cell.appendChild(arrow);
                gameBoard.appendChild(cell);
            }
        }
    }

    function clearHighlights() {
        const { gameBoard } = S.elements;
        gameBoard.querySelectorAll('.cell.green-glow').forEach(c => c.classList.remove('green-glow', 'pulse'));
    }

    function movePieceTo(piece, destCell) {
        const existingPiece = destCell.querySelector('.piece');

        if (existingPiece) {
            const isRedDying = existingPiece.classList.contains('red');
            const colorName = isRedDying ? 'red' : 'yellow';

            console.log(`[UI] Captura detetada! Peça ${colorName} foi comida.`);
            try { TabStats.onCapture(S.currentPlayer, colorName); } catch { }

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
        try { TabStats.onMove(S.currentPlayer); } catch { }
    }

    function flipBoard() {
        
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