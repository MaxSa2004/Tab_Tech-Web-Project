// PvP controller: uses Network and handles server payloads only here.

window.PvPController = (function () {
    let S, UI, Msg, Dice, Net;
  
    function init(GameState, GameUI, Messages, DiceModule, Network) {
      S = GameState; UI = GameUI; Msg = Messages; Dice = DiceModule; Net = Network;
  
      const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
      const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
      if (!nick || !password) {
        alert("Você precisa estar autenticado para jogar contra outro jogador.");
        return;
      }
  
      S.vsPlayer = true; S.vsAI = false;
      S.setGameActive(true);
  
      // Join room
      const size = S.getCols();
      const group = 36;
      Network.join({ group, nick, password, size })
        .then(joinResult => {
          const gameId = joinResult.game;
          sessionStorage.setItem('tt_game', gameId);
          window.currentGameId = gameId;
          // SSE
          window.updateEventSource = Network.createUpdateEventSource({ nick, game: gameId });
          window.updateEventSource.onmessage = handleUpdateMessage;
          window.updateEventSource.onerror = (err) => console.warn('EventSource error:', err);
          Msg.system('msg_waiting_opponent');
        })
        .catch(err => {
          console.warn('Erro ao entrar na partida PvP:', err);
          alert("Erro ao encontrar um oponente. Por favor, tente novamente mais tarde.");
          S.setGameActive(false);
        });
    }
  
    function handleUpdateMessage(ev) {
      let payload;
      try { payload = JSON.parse(ev.data); } catch { return; }
      const localNick = sessionStorage.getItem('tt_nick');
  
      // initial: assign humanPlayerNum
      if (payload.initial) {
        sessionStorage.setItem('tt_initial', payload.initial);
        S.humanPlayerNum = (payload.initial === localNick) ? 1 : 2;
        if (!S.gameActive) {
          S.setGameActive(true);
          Msg.system('msg_game_started');
        }
      }
  
      // players
      if (payload.players && !S.gameActive) {
        const myColor = payload.players[localNick];
        if (myColor) S.humanPlayerNum = (myColor.toLowerCase() === 'red') ? 1 : 2;
        S.setGameActive(true);
        Msg.system('msg_game_started');
      }
  
      if (payload.game) {
        window.currentGameId = payload.game;
        sessionStorage.setItem('tt_game', payload.game);
      }
  
      // turn management
      if (payload.turn !== undefined) {
        if (S.serverTurnNick !== payload.turn) {
          S.serverMustPass = false;
          S.serverDiceValue = null;
        }
        S.serverTurnNick = payload.turn;
        const isMyTurn = (S.serverTurnNick === localNick);
        const newPlayerNum = isMyTurn ? S.humanPlayerNum : (S.humanPlayerNum === 1 ? 2 : 1);
        if (S.currentPlayer !== newPlayerNum) {
          S.currentPlayer = newPlayerNum;
          if (S.elements.currentPlayerEl) S.elements.currentPlayerEl.textContent = isMyTurn ? 'EU' : S.serverTurnNick;
          S.selectedPiece = null;
          GameUI.clearHighlights();
        }
        // buttons
        updatePvPControls();
      }
  
      if (payload.mustPass !== undefined) {
        S.serverMustPass = payload.mustPass;
        if (S.serverMustPass && S.serverTurnNick === localNick) {
          Msg.system('msg_player_no_moves_pass');
        }
        updatePvPControls();
      }
  
      if (payload.dice !== undefined) {
        if (payload.dice === null) {
          S.serverDiceValue = null;
          S.lastDiceValue = null;
          updatePvPControls();
        } else {
          const val = payload.dice.value;
          S.serverDiceValue = val;
          if (S.lastDiceValue !== val) {
            Dice.showRemoteRoll(val).then(() => {
              S.lastDiceValue = val;
              const isMyTurn = (S.serverTurnNick === localNick);
              Msg.player(isMyTurn ? S.humanPlayerNum : (S.humanPlayerNum === 1 ? 2 : 1), 'msg_dice_thrown', { value: val });
              if (isMyTurn && (val === 1 || val === 4 || val === 6)) {
                Msg.system('msg_dice_thrown_double', { value: val });
              }
              updatePvPControls();
            });
          } else {
            S.lastDiceValue = val;
          }
        }
      }
  
      if (payload.step !== undefined) {
        S.currentServerStep = payload.step;
        updatePvPControls();
      }
  
      if (payload.pieces) {
        const initialNick = payload.initial || (sessionStorage.getItem('tt_initial') || null);
        updateBoardFromRemote(payload.pieces, initialNick);
      }
  
      if (payload.cell && typeof payload.cell.square === 'number') {
        const initialNick = payload.initial || (sessionStorage.getItem('tt_initial') || null);
        const cols = S.getCols();
        const { r, c } = serverIndexToLocalCell(payload.cell.square, cols, initialNick);
        const domCell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (domCell) {
          domCell.classList.add('green-glow', 'pulse');
          setTimeout(() => domCell.classList.remove('green-glow', 'pulse'), 900);
        }
      }
  
      if (payload.winner) {
        const winnerNum = (payload.winner === localNick) ? S.humanPlayerNum : (S.humanPlayerNum === 1 ? 2 : 1);
        Msg.system('msg_player_won', { player: winnerNum });
        Rules.endGame(S);
      }
    }
  
    function onThrow() {
      const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
      const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
      const game = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game');
      if (!nick || password == null || game == null || game === '') {
        alert('Você precisa estar autenticado para jogar contra outro jogador.');
        return;
      }
      try {
        S.elements.throwBtn.disabled = true;
        Net.roll({ nick, password, game }).then(() => {
          Messages.system('msg_roll_sent');
        }).catch(err => {
          console.warn('Erro ao enviar /roll:', err);
          alert('Erro ao enviar jogada para o servidor. Por favor, tente novamente mais tarde.');
          S.elements.throwBtn.disabled = false;
        });
      } catch (err) {
        console.warn('Erro no throw PvP:', err);
      }
    }
  
    function onPass() {
      const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
      const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
      const game = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game');
      if (!nick || !password || !game) {
        alert("Você precisa estar autenticado para jogar contra outro jogador.");
        return;
      }
      try {
        S.elements.nextTurnBtn.disabled = true;
        Net.pass({ nick, password, game }).catch(err => {
          console.warn('Erro ao passar o turno PvP:', err);
          alert('Erro ao passar o turno. Por favor, tente novamente.');
          S.elements.nextTurnBtn.disabled = false;
        });
      } catch (err) {
        console.warn('Erro ao enviar pass PvP:', err);
      }
    }
  
    function onCellClick(r, c, cellDOM) {
      if (!S.gameActive) return;
      const pieceInCell = cellDOM.querySelector('.piece');
  
      // Only allow local interaction on our turn
      const localNick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
      const isMyTurn = (S.serverTurnNick === localNick);
      if (!isMyTurn) return;
  
      const isMyPiece = !!(pieceInCell && ((S.currentPlayer == 1 && pieceInCell.classList.contains('red')) || (S.currentPlayer == 2 && pieceInCell.classList.contains('yellow'))));
  
      if (isMyPiece) {
        if (S.selectedPiece) S.selectedPiece.classList.remove('selected');
        pieceInCell.classList.add('selected');
        S.selectedPiece = pieceInCell;
        UI.clearHighlights();
        const roll = parseInt(S.lastDiceValue, 10);
        const state = pieceInCell.getAttribute('move-state');
        const movesAllowed = (state === 'not-moved' && roll !== 1) ? [] : Rules.getValidMoves(S, pieceInCell);
        movesAllowed.forEach(dest => dest.classList.add('green-glow'));
        return;
      }
  
      if (S.selectedPiece) {
        const possibleMoves = Rules.getValidMoves(S, S.selectedPiece);
        if (possibleMoves.some(dest => dest === cellDOM)) {
          const movedValue = parseInt(S.lastDiceValue, 10);
          const state = S.selectedPiece.getAttribute('move-state');
          if (state === 'not-moved' && movedValue === 1) S.selectedPiece.setAttribute('move-state', 'moved');
          UI.movePieceTo(S.selectedPiece, cellDOM);
          UI.clearHighlights();
          S.selectedPiece.classList.remove('selected');
          S.selectedPiece = null;
          S.lastDiceValue = null;
          S.serverDiceValue = null;
  
          const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
          const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
          const game = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game');
          const cols = S.getCols();
          const initialNick = sessionStorage.getItem('tt_initial') || null;
  
          let serverR = r, serverC = c;
          if (nick !== initialNick) {
            serverR = (S.rows - 1) - r; serverC = (cols - 1) - c;
          }
          const cellIndex = ((S.rows - 1) - serverR) * cols + ((cols - 1) - serverC);
          try { Net.notify({ nick, password, game, cell: cellIndex }); } catch {}
  
          if (movedValue === 1 || movedValue === 4 || movedValue === 6) {
            updatePvPControls();
          }
        }
      }
    }
  
    function updatePvPControls() {
      const localNick = sessionStorage.getItem('tt_nick');
      const isMyTurn = (S.serverTurnNick === localNick);
      const awaitingRoll = (S.serverDiceValue === null);
      const isMovePhase = (S.currentServerStep === 'from' || S.currentServerStep === 'to' || S.currentServerStep === 'take');
  
      if (S.elements.throwBtn) {
        if (isMyTurn && awaitingRoll && S.currentServerStep !== 'take' && !S.serverMustPass) {
          S.elements.throwBtn.disabled = false;
        } else {
          S.elements.throwBtn.disabled = true;
        }
      }
      if (S.elements.nextTurnBtn) {
        if (isMyTurn && S.serverMustPass) {
          S.elements.nextTurnBtn.disabled = false;
        } else {
          S.elements.nextTurnBtn.disabled = true;
        }
      }
    }
  
    // Helpers reused from your script (kept local to PvP)
    function serverIndexToLocalCell(index, totalCols, initialPlayerNick) {
      const localNick = sessionStorage.getItem('tt_nick');
      const initNick = initialPlayerNick || sessionStorage.getItem('tt_initial') || null;
      const rowFromBottom = Math.floor(index / totalCols);
      const colFromRight = index % totalCols;
      let r = 3 - rowFromBottom;
      let c = (totalCols - 1) - colFromRight;
      if (initNick && localNick !== initNick) {
        r = 3 - r;
        c = (totalCols - 1) - c;
      }
      return { r, c };
    }
  
    function updateBoardFromRemote(piecesArray, initialNick) {
      if (!Array.isArray(piecesArray)) return;
      const gameCreator = initialNick || sessionStorage.getItem('tt_initial') || null;
      const allCells = document.querySelectorAll('.cell');
      allCells.forEach(cell => {
        const p = cell.querySelector('.piece');
        if (p) p.remove();
        cell.classList.remove('green-glow', 'selected');
      });
      const cols = S.getCols();
      piecesArray.forEach((pieceData, index) => {
        if (!pieceData) return;
        const coords = serverIndexToLocalCell(index, cols, gameCreator);
        const cell = document.querySelector(`.cell[data-r="${coords.r}"][data-c="${coords.c}"]`);
        if (!cell) return;
        const piece = document.createElement('div');
        piece.classList.add('piece');
        const serverColor = (pieceData.color || '').toLowerCase();
        piece.classList.add(serverColor === 'red' ? 'red' : 'yellow');
        let moveState = 'not-moved';
        if (pieceData.reachedLastRow) moveState = 'row-four';
        else if (pieceData.inMotion) moveState = 'moved';
        piece.setAttribute('move-state', moveState);
        cell.appendChild(piece);
      });
      S.redPieces = document.querySelectorAll('.piece.red').length;
      S.yellowPieces = document.querySelectorAll('.piece.yellow').length;
  
      const localColor = (S.humanPlayerNum === 1) ? 'red' : 'yellow';
      const bottomHasLocal = Array.from(document.querySelectorAll('.cell[data-r="3"] .piece'))
        .some(p => p.classList.contains(localColor));
      const topHasLocal = Array.from(document.querySelectorAll('.cell[data-r="0"] .piece'))
        .some(p => p.classList.contains(localColor));
      if (!bottomHasLocal && topHasLocal) {
        try { GameUI.flipBoard(); } catch (e) { console.warn('Failed flip:', e); }
      }
    }
  
    return {
      init,
      onThrow,
      onPass,
      onCellClick
    };
  })();