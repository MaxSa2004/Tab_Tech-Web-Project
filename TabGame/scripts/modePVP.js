// PvP controller: uses Network and handles server payloads only here.

window.PVPController = (function () {
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

      // Mostrar feedback imediato
      Msg.system('msg_waiting_opponent');

      // Preparar dados do Join
      const size = S.getCols();
      
      // CORREÇÃO: Grupo aleatório para evitar entrar em salas 'fantasma' e ser P2
      const group = 36;
      console.log(`[PvP] A entrar no Grupo: ${group}`);

      // 1. PEDIDO JOIN
      Network.join({ group, nick, password, size })
          .then(joinResult => {
              // 2. RECEBER PROPRIEDADE 'GAME' (HASH)
              if (joinResult.game) {
                  const gameId = joinResult.game;
                  console.log(`[PvP] Join com sucesso! Game ID: ${gameId}`);

                  // 3. GUARDAR O IDENTIFICADOR
                  sessionStorage.setItem('tt_game', gameId);
                  window.currentGameId = gameId;

                  // 4. USAR O 'GAME' PARA INICIAR O SSE
                  if (window.updateEventSource) {
                      window.updateEventSource.close();
                  }
                  window.updateEventSource = Network.createUpdateEventSource({ nick, game: gameId });
                  window.updateEventSource.onmessage = handleUpdateMessage;
                  window.updateEventSource.onerror = (err) => console.warn('EventSource error:', err);

              } else {
                  throw new Error("Servidor não retornou 'game' ID.");
              }
          })
          .catch(err => {
              console.warn('Erro ao entrar na partida PvP:', err);
              alert("Erro ao entrar no jogo. Por favor, tente novamente.");
              S.setGameActive(false);
              if (GameUI.updatePlayLeaveButtons) GameUI.updatePlayLeaveButtons();
          });
  }

  // --- HELPERS DE COORDENADAS (Versões Corrigidas: Usam S.humanPlayerNum) ---

  function localToServerIndex(r, c, totalCols) {
      let targetR = r;
      let targetC = c;

      // Se eu sou o Jogador 2, o meu tabuleiro visual é invertido.
      if (S.humanPlayerNum === 2) {
          targetR = (S.rows - 1) - r;
          targetC = (totalCols - 1) - c;
      }

      const rowFromBottom = (S.rows - 1) - targetR;
      const colFromRight = (totalCols - 1) - targetC;
      return rowFromBottom * totalCols + colFromRight;
  }

  function serverIndexToLocalCell(index, totalCols) {
      const rowFromBottom = Math.floor(index / totalCols);
      const colFromRight = index % totalCols;

      let r = 3 - rowFromBottom;
      let c = (totalCols - 1) - colFromRight;

      // Se eu sou o Jogador 2, rodo o que vem do servidor
      if (S.humanPlayerNum === 2) {
          r = 3 - r;
          c = (totalCols - 1) - c;
      }
      return { r, c };
  }

  // --- HANDLER PRINCIPAL ---

  function handleUpdateMessage(ev) {
      let payload;
      try { payload = JSON.parse(ev.data); } catch { return; }
      const localNick = sessionStorage.getItem('tt_nick');

      // --- INITIAL ---
      if (payload.initial) {
          sessionStorage.setItem('tt_initial', payload.initial);
          
          // Robustez: Comparar nicks ignorando maiúsculas
          const isMe = (payload.initial.toLowerCase() === localNick.toLowerCase());
          S.humanPlayerNum = isMe ? 1 : 2;

          console.log(`[PvP] Initial recebido: ${payload.initial}. Sou P${S.humanPlayerNum}`);

          if (!S.gameActive) {
              S.setGameActive(true);
              S.waitingForPair = false;
              if (GameUI.updatePlayLeaveButtons) GameUI.updatePlayLeaveButtons();
              Msg.system('msg_game_started');
              if (window.__refreshCaptured) window.__refreshCaptured();
          }
      }

      // --- PLAYERS ---
      if (payload.players && typeof payload.players === 'object') {
          try { sessionStorage.setItem('tt_players', JSON.stringify(payload.players)); } catch (e) { }

          // Detetar Inversão de Cores (Se P1 for Blue no servidor)
          const initialNick = sessionStorage.getItem('tt_initial');
          const p1Color = payload.players[initialNick]; 

          if (p1Color && p1Color.toLowerCase() === 'blue') {
              S.serverColorInverted = true;
              console.log("[PvP] Servidor atribuiu Blue ao P1. Ativando tradução de cores.");
          } else {
              S.serverColorInverted = false;
          }

          const nicks = Object.keys(payload.players);
          const opponentNick = nicks.find(n => n !== localNick);
          if (opponentNick) sessionStorage.setItem('tt_opponent', opponentNick);

          if (!S.gameActive) {
              S.setGameActive(true);
              S.waitingForPair = false;
              if (GameUI.updatePlayLeaveButtons) GameUI.updatePlayLeaveButtons();
              Msg.system('msg_game_started');

              // Se formos P2, rodar o tabuleiro
              if (S.humanPlayerNum === 2) {
                  try { GameUI.flipBoard(); } catch (e) { }
              }
              if (window.__refreshCaptured) window.__refreshCaptured();
          }
      }

      // --- GAME ID ---
      if (payload.game) {
          if (sessionStorage.getItem('tt_game') !== payload.game) {
              sessionStorage.setItem('tt_game', payload.game);
              window.currentGameId = payload.game;
          }
      }

      // --- TURN ---
      if (payload.turn !== undefined) {
          if (S.serverTurnNick !== payload.turn) {
              S.serverMustPass = false;
              S.serverDiceValue = null;
              S.lastDiceValue = null;
              try { TabStats.onTurnAdvance(); } catch { }
          }

          S.serverTurnNick = payload.turn;
          const isMyTurn = (S.serverTurnNick === localNick);
          const newPlayerNum = isMyTurn ? S.humanPlayerNum : (S.humanPlayerNum === 1 ? 2 : 1);

          if (S.currentPlayer !== newPlayerNum) {
              S.currentPlayer = newPlayerNum;
              if (S.elements.currentPlayerEl) {
                  S.elements.currentPlayerEl.textContent = isMyTurn ? 'EU' : S.serverTurnNick;
              }
              Msg.system('msg_turn_of', { player: S.currentPlayer });
              S.selectedPiece = null;
              UI.clearHighlights();
          }
          updatePvPControls();
      }

      // --- MUST PASS ---
      if (payload.mustPass !== undefined) {
          S.serverMustPass = payload.mustPass;
          if (S.serverMustPass && S.serverTurnNick === localNick) {
              Msg.system('msg_player_no_moves_pass');
          }
          updatePvPControls();
      }

      // --- DICE ---
      if (payload.dice !== undefined) {
          if (payload.dice === null) {
              S.serverDiceValue = null;
              S.lastDiceValue = null;
              updatePvPControls();
          } else {
              const val = payload.dice.value;
              const keepPlaying = payload.dice.keepPlaying;
              S.serverDiceValue = val;

              if (S.lastDiceValue !== val) {
                  Dice.showRemoteRoll(val).then(() => {
                      S.lastDiceValue = val;
                      const isMyTurn = (S.serverTurnNick === localNick);
                      const playerNum = isMyTurn ? S.humanPlayerNum : (S.humanPlayerNum === 1 ? 2 : 1);
                      Msg.player(playerNum, 'msg_dice_thrown', { value: val });

                      if (keepPlaying) {
                          if (val === 1) {
                              const convertible = Rules.countConvertiblePieces(S, playerNum);
                              if (convertible > 0) Msg.system('msg_dice_thrown_one', { n: convertible });
                          }
                          Msg.system('msg_dice_thrown_double', { value: val });
                      }
                      updatePvPControls();
                  });
              } else {
                  S.lastDiceValue = val;
                  updatePvPControls();
              }
          }
      }

      // --- STEP ---
      if (payload.step !== undefined) {
          const previousStep = S.currentServerStep;
          S.currentServerStep = payload.step;
          if (S.serverTurnNick === localNick && previousStep !== S.currentServerStep) {
              switch (S.currentServerStep) {
                  case 'from':
                      if (S.serverDiceValue !== null) Msg.system('msg_select_piece_move');
                      break;
                  case 'to': Msg.system('msg_select_destination'); break;
                  case 'take': Msg.system('msg_select_opponent_piece'); break;
              }
          }
          updatePvPControls();
      }

      // --- PIECES ---
      if (payload.pieces) {
          const serverCols = Math.floor(payload.pieces.length / 4);
          const currentCols = S.getCols();
          if (serverCols !== currentCols) {
              S.setCols(serverCols);
              if (S.elements.widthSelect) S.elements.widthSelect.value = serverCols;
              UI.renderBoard(serverCols);
          }
          const initialNick = payload.initial || sessionStorage.getItem('tt_initial');
          updateBoardFromRemote(payload.pieces, initialNick);
      }

      // --- SELECTED ---
      if (payload.selected && Array.isArray(payload.selected)) {
          const cols = S.getCols();
          if (!payload.pieces) UI.clearHighlights();
          payload.selected.forEach(serverIndex => {
              const { r, c } = serverIndexToLocalCell(serverIndex, cols);
              const domCell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
              if (domCell) {
                  domCell.classList.add('green-glow');
                  domCell.classList.add('pulse');
              }
          });
      }

      // --- CELL UPDATE ---
      if (payload.cell && typeof payload.cell.square === 'number') {
          const cols = S.getCols();
          const { r, c } = serverIndexToLocalCell(payload.cell.square, cols);
          const domCell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
          if (domCell) {
              domCell.classList.remove('green-glow', 'pulse');
              void domCell.offsetWidth;
              domCell.classList.add('green-glow', 'pulse');
              setTimeout(() => domCell.classList.remove('green-glow', 'pulse'), 900);
          }
      }

      // --- WINNER ---
      if (payload.winner !== undefined) {
          if (payload.winner === null) {
              console.log("[PvP] Jogo terminado sem vencedor.");
              Msg.system('msg_pairing_cancelled');
              Rules.endGame(S);
          } else {
              const winnerNick = payload.winner;
              const amIWinner = (winnerNick === localNick);
              const winnerNum = amIWinner ? S.humanPlayerNum : (S.humanPlayerNum === 1 ? 2 : 1);
              console.log(`[PvP] Vencedor: ${winnerNick} (P${winnerNum})`);
              Msg.system('msg_player_won', { player: winnerNum });
              try { TabStats.setWinner(winnerNum); } catch (e) { }
              Rules.endGame(S);
          }
      }
  }

  // --- AÇÕES DO UTILIZADOR ---

  function onThrow() {
      const nick = sessionStorage.getItem('tt_nick');
      const password = sessionStorage.getItem('tt_password');
      const game = sessionStorage.getItem('tt_game');
      if (!nick || !game) return;

      try {
          S.elements.throwBtn.disabled = true;
          Net.roll({ nick, password, game }).then(() => {
              Messages.system('msg_roll_sent');
          }).catch(err => {
              console.warn('Erro ao enviar /roll:', err);
              S.elements.throwBtn.disabled = false;
          });
      } catch (err) { }
  }

  function onPass() {
      const nick = sessionStorage.getItem('tt_nick');
      const password = sessionStorage.getItem('tt_password');
      const game = sessionStorage.getItem('tt_game');
      if (!nick || !game) return;

      try {
          S.elements.nextTurnBtn.disabled = true;
          Net.pass({ nick, password, game }).catch(err => {
              console.warn('Erro ao passar o turno PvP:', err);
              S.elements.nextTurnBtn.disabled = false;
          });
      } catch (err) { }
  }

  function onCellClick(r, c, cellDOM) {
      if (!S.gameActive) return;

      const localNick = sessionStorage.getItem('tt_nick');
      if (S.serverTurnNick !== localNick) return;

      const cols = S.getCols();
      const pieceInCell = cellDOM.querySelector('.piece');
      const cellIndex = localToServerIndex(r, c, cols);
      const password = sessionStorage.getItem('tt_password');
      const game = sessionStorage.getItem('tt_game');

      // STEP TAKE
      if (S.currentServerStep === 'take') {
          try {
              Net.notify({ nick: localNick, password, game, cell: cellIndex });
              cellDOM.classList.add('green-glow');
              setTimeout(() => cellDOM.classList.remove('green-glow'), 500);
          } catch { }
          return;
      }

      const isMyPiece = !!(pieceInCell && ((S.currentPlayer == 1 && pieceInCell.classList.contains('red')) || (S.currentPlayer == 2 && pieceInCell.classList.contains('yellow'))));

      // STEP FROM (Seleção)
      if (isMyPiece) {
          if (S.selectedPiece) S.selectedPiece.classList.remove('selected');
          pieceInCell.classList.add('selected');
          S.selectedPiece = pieceInCell;
          UI.clearHighlights();

          const roll = parseInt(S.lastDiceValue, 10);
          const state = pieceInCell.getAttribute('move-state');
          const movesAllowed = (state === 'not-moved' && roll !== 1) ? [] : Rules.getValidMoves(S, pieceInCell);
          movesAllowed.forEach(dest => dest.classList.add('green-glow'));

          console.log(`[PvP] Step FROM: Selecionando peça ${cellIndex}`);
          try {
              Net.notify({ nick: localNick, password, game, cell: cellIndex })
                  .catch(e => console.warn("Erro no notify selection:", e));
          } catch (e) { }
          return;
      }

      // STEP TO (Movimento)
      if (S.selectedPiece) {
          const possibleMoves = Rules.getValidMoves(S, S.selectedPiece);
          if (possibleMoves.some(dest => dest === cellDOM)) {
              
              // Movimento Otimista
              const movedValue = parseInt(S.lastDiceValue, 10);
              const state = S.selectedPiece.getAttribute('move-state');
              if (state === 'not-moved' && movedValue === 1) S.selectedPiece.setAttribute('move-state', 'moved');

              UI.movePieceTo(S.selectedPiece, cellDOM);
              UI.clearHighlights();
              S.selectedPiece.classList.remove('selected');
              S.selectedPiece = null;
              S.lastDiceValue = null;

              console.log(`[PvP] Step TO: Movendo para ${cellIndex}`);
              try {
                  Net.notify({ nick: localNick, password, game, cell: cellIndex });
              } catch { }

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

      if (S.elements.throwBtn) {
          const canThrow = isMyTurn && awaitingRoll && !S.serverMustPass && (S.currentServerStep !== 'take' && S.currentServerStep !== 'to');
          S.elements.throwBtn.disabled = !canThrow;
      }

      if (S.elements.nextTurnBtn) {
          S.elements.nextTurnBtn.disabled = !(isMyTurn && S.serverMustPass);
      }
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

          const coords = serverIndexToLocalCell(index, cols);
          const cell = document.querySelector(`.cell[data-r="${coords.r}"][data-c="${coords.c}"]`);
          if (!cell) return;

          const piece = document.createElement('div');
          piece.classList.add('piece');

          let serverColor = (pieceData.color || '').toLowerCase(); 
          // Inversão se P1 for Blue no servidor
          if (S.serverColorInverted) {
              if (serverColor === 'blue') serverColor = 'red';
              else if (serverColor === 'red') serverColor = 'blue';
          }

          if (serverColor === 'red') piece.classList.add('red');
          else piece.classList.add('yellow');

          let moveState = 'not-moved';
          if (pieceData.reachedLastRow) moveState = 'row-four';
          else if (pieceData.inMotion) moveState = 'moved';
          piece.setAttribute('move-state', moveState);

          cell.appendChild(piece);
      });

      S.redPieces = document.querySelectorAll('.piece.red').length;
      S.yellowPieces = document.querySelectorAll('.piece.yellow').length;

      // Auto-fix rotação se necessário
      const localColor = (S.humanPlayerNum === 1) ? 'red' : 'yellow';
      const bottomHasLocal = Array.from(document.querySelectorAll('.cell[data-r="3"] .piece'))
          .some(p => p.classList.contains(localColor));
      const topHasLocal = Array.from(document.querySelectorAll('.cell[data-r="0"] .piece'))
          .some(p => p.classList.contains(localColor));

      if (!bottomHasLocal && topHasLocal) {
          try { GameUI.flipBoard(); } catch (e) { }
      }
  }

  return {
      init,
      onThrow,
      onPass,
      onCellClick
  };
})();