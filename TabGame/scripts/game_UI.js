window.GameUI = (function () {
    let S;
  
    function computeIsFlipped() {
      if (!S) return false;
      if (S.vsPlayer) return S.humanPlayerNum === 2;
      return false;
    }
    let isFlipped = false;

    // Painel de estado
    let statusPanelEl = null;
    function ensureStatusPanel() {
      if (statusPanelEl) return statusPanelEl;
      const boardWrap = S?.elements?.gameBoard?.parentElement || document.body;
      const panel = document.createElement('div');
      panel.className = 'status-panel';
      panel.style.display = 'grid';
      panel.style.gridTemplateColumns = 'repeat(3, auto)';
      panel.style.gap = '12px';
      panel.style.alignItems = 'center';
      panel.style.margin = '8px 0';
      panel.innerHTML = `
        <div class="status-item"><strong>Turno:</strong> <span class="status-turn">—</span></div>
        <div class="status-item"><strong>Step:</strong> <span class="status-step">—</span></div>
        <div class="status-item"><strong>Dado:</strong> <span class="status-dice">—</span></div>
      `;
      boardWrap.insertBefore(panel, S?.elements?.gameBoard);
      statusPanelEl = panel;
      return statusPanelEl;
    }
    function setStatusPanel({ turnLabel = '—', stepLabel = '—', diceLabel = '—' }) {
      ensureStatusPanel();
      const t = statusPanelEl.querySelector('.status-turn');
      const s = statusPanelEl.querySelector('.status-step');
      const d = statusPanelEl.querySelector('.status-dice');
      if (t) t.textContent = turnLabel;
      if (s) s.textContent = stepLabel;
      if (d) d.textContent = diceLabel;
    }
  
    function applyFlipClass() {
      const boardEl = S?.elements?.gameBoard;
      if (!boardEl) return;
      boardEl.classList.toggle('flipped', isFlipped);
    }
  
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
  
      updatePlayLeaveButtons();
  
      if (modeSelect) modeSelect.addEventListener('change', () => {
        S.setConfigEnabled(true);
        updatePlayLeaveButtons();
        isFlipped = computeIsFlipped();
        applyFlipClass();
      });
      if (iaLevelSelect) iaLevelSelect.addEventListener('change', updatePlayLeaveButtons);
      if (firstToPlayCheckbox) firstToPlayCheckbox.addEventListener('change', updatePlayLeaveButtons);
  
      attachBoardEvents();
      ensureStatusPanel();
      setStatusPanel({ turnLabel: '—', stepLabel: '—', diceLabel: '—' });
    }
  
    function updatePlayLeaveButtons() {
      const { playButton, leaveButton } = S.elements;
      if (!playButton) return;
      const canPlay = Rules.isConfigValid(S.elements) && !S.gameActive && !S.waitingForPair;
      playButton.disabled = !canPlay;
      if (leaveButton) leaveButton.disabled = !!(S.gameActive || S.waitingForPair) ? false : true;
    }
  
    function addArrow(cellEl, classes) {
      const arrow = document.createElement('div');
      arrow.className = 'arrow ' + classes;
      cellEl.appendChild(arrow);
    }
    function arrowClassesForCell(r, c) {
      const lastCol = S.cols - 1;
      if (r === 3) return (c === lastCol) ? 'up' : 'right';
      if (r === 2) return (c === 0) ? 'up' : 'left';
      if (r === 1) return (c === lastCol) ? 'up down' : 'right';
      if (r === 0) return (c === 0) ? 'down' : 'left';
      return null;
    }
  
    function renderBoard(cols) {
      const boardEl = S?.elements?.gameBoard;
      if (!boardEl) return;
  
      isFlipped = computeIsFlipped();
  
      boardEl.innerHTML = '';
      S.cols = cols;
      boardEl.style.setProperty('--cols', String(cols));
  
      for (let r = 0; r < S.rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.dataset.r = String(r);
          cell.dataset.c = String(c);
  
          const classes = arrowClassesForCell(r, c);
          if (classes) addArrow(cell, classes);
  
          boardEl.appendChild(cell);
        }
      }
  
      applyFlipClass();
      ensureStatusPanel();
    }
  
    function attachBoardEvents() {
      const boardEl = S?.elements?.gameBoard;
      if (!boardEl) return;
      boardEl.addEventListener('click', (e) => {
        const cellEl = e.target.closest('.cell');
        if (!cellEl) return;
  
        const clientR = parseInt(cellEl.dataset.r, 10);
        const clientC = parseInt(cellEl.dataset.c, 10);
  
        if (S.vsPlayer) {
          onCellClick && onCellClick(clientR, clientC, cellEl);
          return;
        }
        onCellClick && onCellClick(cellEl);
      });
    }
  
    function clearHighlights() {
      const { gameBoard } = S.elements;
      if (!gameBoard) return;
      gameBoard.querySelectorAll('.cell.green-glow').forEach(c => c.classList.remove('green-glow', 'pulse'));
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
  
    function flipBoard() {
      isFlipped = computeIsFlipped();
      applyFlipClass();
    }
  
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
      updatePlayLeaveButtons,
      setStatusPanel
    };
  })();