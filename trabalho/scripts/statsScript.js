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
      hard: "Difícil"
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
      hard: "Hard"
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

    reset() { // initialize/reset stats data
      this.data = {
        startTime: Date.now(), // timestamp
        endTime: null, // timestamp
        durationMs: null,    // duration in ms

        mode: null,           // 'player' | 'ia'
        aiDifficulty: null,   // 'easy' | 'normal' | 'hard' | null
        cols: null,           // nº colunas

        firstStarterRole: null, // 'human' | 'ai' | null
        firstPlayer: 1,       // 1 | 2 

        winner: null,         // 1 | 2 | null

        turns: 0, // number of turns
        moves: { 1: 0, 2: 0 }, // number of moves per player
        captures: { 1: 0, 2: 0 }, // number of captures per player
        passes: { 1: 0, 2: 0 }, // number of passes per player
        extraRolls: { 1: 0, 2: 0 }, // number of extra rolls per player

        diceCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 6: 0 }, // count of dice rolls
        log: [] // event log
      };
    },
    // start tracking a new game
    start({ mode, aiDifficulty, cols, firstPlayer = 1, firstStarterRole = null }) {
      this.reset();
      this.data.mode = mode;
      this.data.aiDifficulty = mode === 'ia' ? (aiDifficulty || 'normal') : null;
      this.data.cols = cols;
      this.data.firstPlayer = firstPlayer;
      this.data.firstStarterRole = firstStarterRole;
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
    showSummary() {
      if (!this.data) return;

      // calculate duration
      this.data.endTime = Date.now();
      this.data.durationMs = this.data.endTime - this.data.startTime;
      const mins = Math.floor(this.data.durationMs / 60000);
      const secs = Math.floor((this.data.durationMs % 60000) / 1000);
      const durationText = `${mins}m ${secs}s`;
      // determine first player label
      let firstLabel = '';
      const md = this.data;
      if (typeof md.firstStarterRole === 'string') {
        const role = md.firstStarterRole.toLowerCase();
        if (role === 'human' || role=== 'humano') firstLabel = tLocal('summary_first_player_human');
        else if (role === 'ai' || role === 'ia') firstLabel = tLocal('summary_first_player_ai');
      }

      // else try firstPlayer number
      if (!firstLabel) {
        if (typeof md.firstPlayer === 'string') {
          const v = md.firstPlayer.toLowerCase();
          if (v === 'human' || v === 'humano') firstLabel = tLocal('summary_first_player_human');
          else if (v === 'ai' || v === 'ia') firstLabel = tLocal('summary_first_player_ai');
        } else if (md.firstPlayer === 1 || md.firstPlayer === 2) {
          firstLabel = `P${md.firstPlayer}`;
        }
      }
      if (!firstLabel) {
        // fallback
        firstLabel = '-';
      }

      // remove modal if already present
      const prev = document.getElementById('gameSummaryModal');
      if (prev) prev.remove();

      // modal structure
      const modal = document.createElement('div');
      modal.className = 'modal is-open';
      modal.id = 'gameSummaryModal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.addEventListener('click', (e) => { // close when clicking outside content
        if (e.target === modal) modal.remove();
      });
      // content
      const content = document.createElement('div');
      content.className = 'modal-content';
      // close button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close';
      closeBtn.setAttribute('aria-label', 'Fechar');
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => modal.remove());
      // title
      const title = document.createElement('h3');
      title.textContent = tLocal('summary_title');
      // body content
      const diffKey = (md.aiDifficulty || '').toLowerCase();
      const diffLabel = diffKey ? tLocal(diffKey) : '';
      // mode label
      const modeLabel = md.mode === 'ia'
        ? `${tLocal('summary_mode_vs_ai')} (${diffLabel ? `${diffLabel}` : ''})`
        : tLocal('summary_mode_vs_player');
      // winner text
      const winnerText = (md.winner === 1 || md.winner === 2)
        ? `P${md.winner}`
        : tLocal('summary_no_winner');

      // helper to create a paragraph
      const p = (labelKey, value) => `<p><strong>${tLocal(labelKey)}:</strong> ${value}</p>`;

      const html = `
        ${p('summary_winner', winnerText)}
        ${p('summary_duration', durationText)}
        ${p('summary_mode', modeLabel)}
        ${p('summary_board_cols', md.cols)}
        ${p('summary_first_player', firstLabel)}
        <hr>
        ${p('summary_turns', md.turns)}
        ${p('summary_moves', `P1: ${md.moves[1]} , P2: ${md.moves[2]}`)}
        ${p('summary_captures', `P1: ${md.captures[1]} , P2: ${md.captures[2]}`)}
        ${p('summary_passes', `P1: ${md.passes[1]} , P2: ${md.passes[2]}`)}
        ${p('summary_extra_rolls', `P1: ${md.extraRolls[1]} , P2: ${md.extraRolls[2]}`)}
        ${p('summary_dice_distribution', `1: ${md.diceCounts[1]} , 2: ${md.diceCounts[2]} , 3: ${md.diceCounts[3]} , 4: ${md.diceCounts[4]} , 6: ${md.diceCounts[6]}`)}
      `;
      // body
      const body = document.createElement('div');
      body.innerHTML = html;
      // assemble modal
      content.appendChild(closeBtn);
      content.appendChild(title);
      content.appendChild(body);
      modal.appendChild(content);
      document.body.appendChild(modal);
    }
  };
  // expose TabStats globally
  window.TabStats = TabStats;
})();