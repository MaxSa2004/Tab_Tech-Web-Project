// tracking game statistics and showing end-of-game summary
(function () { // IIFE to avoid polluting global scope
  const DEFAULT_LABELS = { // default labels in case no i18n provided (it is, so it's just a fallback)
    pt: {
      summary_title: "Resumo do jogo",
      summary_winner: "Vencedor",
      summary_duration: "Duração",
      summary_mode: "Modo",
      summary_mode_vs_player: "vs Jogador",
      summary_mode_vs_ai: "vs IA",
      summary_difficulty: "Dificuldade",
      summary_board_cols: "Tabuleiro (colunas)",
      summary_first_player: "Quem começou",
      summary_first_player_human: "Humano",
      summary_first_player_ai: "IA",
      summary_turns: "Turnos",
      summary_moves: "Jogadas",
      summary_captures: "Capturas",
      summary_passes: "Passes",
      summary_extra_rolls: "Lançamentos extra",
      summary_dice_distribution: "Distribuição dos dados",
      summary_no_winner: "Sem vencedor",
      easy: "Fácil",
      normal: "Normal",
      hard: "Difícil",
      Jogadores: "Jogadores"
    },
    en: {
      summary_title: "Game summary",
      summary_winner: "Winner",
      summary_duration: "Duration",
      summary_mode: "Mode",
      summary_mode_vs_player: "vs Player",
      summary_mode_vs_ai: "vs AI",
      summary_difficulty: "Difficulty",
      summary_board_cols: "Board (columns)",
      summary_first_player: "First to play",
      summary_first_player_human: "Human",
      summary_first_player_ai: "AI",
      summary_turns: "Turns",
      summary_moves: "Moves",
      summary_captures: "Captures",
      summary_passes: "Passes",
      summary_extra_rolls: "Extra throws",
      summary_dice_distribution: "Dice distribution",
      summary_no_winner: "No winner",
      easy: "Easy",
      normal: "Normal",
      hard: "Hard",
      Jogadores: "Players"
    }
  };
  // simple i18n function to translate labels
  function tLocal(key, params = {}) {
    const lang = (window.currentLang || 'pt');
    const dict = (window.i18n && window.i18n[lang]) || {};
    const fallback = DEFAULT_LABELS[lang] || DEFAULT_LABELS.en;
    let str = dict[key] ?? fallback[key] ?? DEFAULT_LABELS.en[key] ?? key;
    return String(str).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
  }
  // TabStats object
  const TabStats = {
    data: null, // will hold the stats data

    reset() { 
      this.data = {
        startTime: Date.now(), 
        endTime: null, 
        durationMs: null,    
        mode: null,           
        aiDifficulty: null,   
        cols: null,           

        p1Name: "Jogador 1",  // Default
        opponentName: null,
        firstPlayerName: null,

        winner: null,         

        turns: 0, 
        moves: { 1: 0, 2: 0 }, 
        captures: { 1: 0, 2: 0 }, 
        passes: { 1: 0, 2: 0 }, 
        extraRolls: { 1: 0, 2: 0 }, 

        diceCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 6: 0 }, 
        log: [] 
      };
    },
    start({ mode, aiDifficulty, cols, myNick }) {
      this.reset();
      this.data.mode = mode;
      this.data.aiDifficulty = mode === 'ia' ? (aiDifficulty || 'normal') : null;
      this.data.cols = cols;
      if (myNick) this.data.p1Name = myNick;
    },
    setOpponentInfo(oppName, starterName) {
      if (!this.data) return;
      this.data.opponentName = oppName;
      this.data.firstPlayerName = starterName;
    },
    // event handlers to track stats
    /// called when turn advancess
    onTurnAdvance() {
      if (!this.data) return;
      this.data.turns++;
      this.data.log.push({ t: 'turn' });
    },
    // called when a player rolls the dice
    onDice(player, value) {
      if (!this.data) return;
      if (this.data.diceCounts[value] != null) this.data.diceCounts[value]++;
      this.data.log.push({ t: 'roll', player, value });
    },
    // called when a player makes a move
    onMove(player) {
      if (!this.data) return;
      this.data.moves[player]++;
      this.data.log.push({ t: 'move', player });
    },
    // called when a player captures a piece
    onCapture(player, color) {
      if (!this.data) return;
      this.data.captures[player]++;
      this.data.log.push({ t: 'capture', player, color });
    },
    // called when a player passes their turn
    onPass(player) {
      if (!this.data) return;
      this.data.passes[player]++;
      this.data.log.push({ t: 'pass', player });
    },
    // called when a player gets an extra roll
    onExtraRoll(player, value) {
      if (!this.data) return;
      this.data.extraRolls[player]++;
      this.data.log.push({ t: 'extra', player, value });
    },
    // called when the game ends and there's a winner or a quit
    setWinner(playerOrNull) {
      if (!this.data) return;
      this.data.winner = playerOrNull; // 1 | 2 | null (desistência)
    },
    // show the summary modal
    // show the summary modal (Versão Blindada)
    showSummary() {
      // Se por algum motivo this.data for null (ex: erro no start), criamos um dummy para não falhar
      if (!this.data) { 
          console.warn("TabStats: Dados em falta, a criar dados vazios.");
          this.reset();
          this.data.p1Name = "Eu";
      }

      this.data.endTime = Date.now();
      // Garante que startTime existe
      const start = this.data.startTime || (this.data.endTime - 1000);
      this.data.durationMs = this.data.endTime - start;
      
      const mins = Math.floor(this.data.durationMs / 60000);
      const secs = Math.floor((this.data.durationMs % 60000) / 1000);
      const durationText = `${mins}m ${secs}s`;

      const md = this.data;

      // Labels (com proteção contra nulls)
      let firstLabel = md.firstPlayerName || '-';
      if (md.mode === 'ia') {
          if (firstLabel === 'Human') firstLabel = tLocal('summary_first_player_human');
          else if (firstLabel === 'AI') firstLabel = tLocal('summary_first_player_ai');
      }

      let opponentLabel = md.opponentName || '...';
      const diffKey = (md.aiDifficulty || '').toLowerCase();
      const diffLabel = diffKey ? tLocal(diffKey) : '';
      
      if (md.mode === 'ia') {
          opponentLabel = `IA (${diffLabel})`;
      }

      // Remove anterior
      const prev = document.getElementById('gameSummaryModal');
      if (prev) prev.remove();

      // Cria novo
      const modal = document.createElement('div');
      modal.className = 'modal is-open';
      modal.id = 'gameSummaryModal';
      modal.style.zIndex = '9999'; // Forçar ficar no topo
      
      const content = document.createElement('div');
      content.className = 'modal-content';
      
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close';
      closeBtn.textContent = 'x';
      closeBtn.addEventListener('click', () => modal.remove());
      
      const title = document.createElement('h3');
      title.textContent = tLocal('summary_title');

      const modeLabel = md.mode === 'ia' ? tLocal('summary_mode_vs_ai') : tLocal('summary_mode_vs_player');
      
      let winnerText = tLocal('summary_no_winner');
      if (md.winner === 1) winnerText = md.p1Name; 
      else if (md.winner === 2) winnerText = opponentLabel;

      const p = (labelKey, value) => `<p><strong>${tLocal(labelKey)}:</strong> ${value}</p>`;
      const pRaw = (label, value) => `<p><strong>${label}:</strong> ${value}</p>`;

      const html = `
        ${p('summary_winner', winnerText)}
        ${pRaw('Jogadores', `${md.p1Name || 'P1'} vs ${opponentLabel}`)}
        ${p('summary_duration', durationText)}
        ${p('summary_mode', modeLabel)}
        ${p('summary_board_cols', md.cols || 9)}
        ${p('summary_first_player', firstLabel)}
        <hr>
        ${p('summary_turns', md.turns || 0)}
        ${p('summary_moves', `${md.p1Name || 'P1'}: ${md.moves[1]} | ${opponentLabel}: ${md.moves[2]}`)}
        ${p('summary_captures', `${md.p1Name || 'P1'}: ${md.captures[1]} | ${opponentLabel}: ${md.captures[2]}`)}
        ${p('summary_passes', `${md.p1Name || 'P1'}: ${md.passes[1]} | ${opponentLabel}: ${md.passes[2]}`)}
        ${p('summary_extra_rolls', `${md.p1Name || 'P1'}: ${md.extraRolls[1]} | ${opponentLabel}: ${md.extraRolls[2]}`)}
        <p><small>${tLocal('summary_dice_distribution')}: <br> 1:${md.diceCounts[1]}, 2:${md.diceCounts[2]}, 3:${md.diceCounts[3]}, 4:${md.diceCounts[4]}, 6:${md.diceCounts[6]}</small></p>
      `;

      const body = document.createElement('div');
      body.innerHTML = html;
      
      content.appendChild(closeBtn);
      content.appendChild(title);
      content.appendChild(body);
      modal.appendChild(content);
      document.body.appendChild(modal);
      
      console.log("Stats Modal Aberto!"); // Log para confirmares
    }

  };
  // expose TabStats globally
  window.TabStats = TabStats;
})();