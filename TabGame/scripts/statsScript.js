// Caso seja para fazer tracking de estatísticas do jogo, implementar aqui.
(function () {
  const DEFAULT_LABELS = {
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

  function tLocal(key, params = {}) {
    const lang = (window.currentLang || 'pt');
    const dict = (window.i18n && window.i18n[lang]) || {};
    const fallback = DEFAULT_LABELS[lang] || DEFAULT_LABELS.en;
    let str = dict[key] ?? fallback[key] ?? DEFAULT_LABELS.en[key] ?? key;
    return String(str).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
  }

  const TabStats = {
    data: null,

    reset() {
      this.data = {
        startTime: Date.now(),
        endTime: null,
        durationMs: null,

        mode: null,           // 'player' | 'ia'
        aiDifficulty: null,   // 'easy' | 'normal' | 'hard' | null
        cols: null,           // nº colunas

        firstStarterRole: null, // 'human' | 'ai' | null
        firstPlayer: 1,       // 1 | 2 (P1 começa nas tuas regras)

        winner: null,         // 1 | 2 | null

        turns: 0,
        moves: { 1: 0, 2: 0 },
        captures: { 1: 0, 2: 0 },
        passes: { 1: 0, 2: 0 },
        extraRolls: { 1: 0, 2: 0 },

        diceCounts: { 1: 0, 2: 0, 3: 0, 4: 0, 6: 0 },
        log: []
      };
    },

    start({ mode, aiDifficulty, cols, firstPlayer = 1, firstStarterRole = null }) {
      this.reset();
      this.data.mode = mode;
      this.data.aiDifficulty = mode === 'ia' ? (aiDifficulty || 'normal') : null;
      this.data.cols = cols;
      this.data.firstPlayer = firstPlayer;
      this.data.firstStarterRole = firstStarterRole;
    },

    onTurnAdvance() {
      if (!this.data) return;
      this.data.turns++;
      this.data.log.push({ t: 'turn' });
    },

    onDice(player, value) {
      if (!this.data) return;
      if (this.data.diceCounts[value] != null) this.data.diceCounts[value]++;
      this.data.log.push({ t: 'roll', player, value });
    },

    onMove(player) {
      if (!this.data) return;
      this.data.moves[player]++;
      this.data.log.push({ t: 'move', player });
    },

    onCapture(player, color) {
      if (!this.data) return;
      this.data.captures[player]++;
      this.data.log.push({ t: 'capture', player, color });
    },

    onPass(player) {
      if (!this.data) return;
      this.data.passes[player]++;
      this.data.log.push({ t: 'pass', player });
    },

    onExtraRoll(player, value) {
      if (!this.data) return;
      this.data.extraRolls[player]++;
      this.data.log.push({ t: 'extra', player, value });
    },

    setWinner(playerOrNull) {
      if (!this.data) return;
      this.data.winner = playerOrNull; // 1 | 2 | null (desistência)
    },

    showSummary() {
      if (!this.data) return;

      // calcular duração
      this.data.endTime = Date.now();
      this.data.durationMs = this.data.endTime - this.data.startTime;
      const mins = Math.floor(this.data.durationMs / 60000);
      const secs = Math.floor((this.data.durationMs % 60000) / 1000);
      const durationText = `${mins}m ${secs}s`;

      let firstLabel = '';
      const md = this.data;
      if (typeof md.firstStarterRole === 'string') {
        const role = md.firstStarterRole.toLowerCase();
        if (role === 'human' || role=== 'humano') firstLabel = tLocal('summary_first_player_human');
        else if (role === 'ai' || role === 'ia') firstLabel = tLocal('summary_first_player_ai');
      }

      // Back-compat: se não houver role, tenta interpretar firstPlayer string
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

      // remove modal anterior se existir
      const prev = document.getElementById('gameSummaryModal');
      if (prev) prev.remove();

      // estrutura da modal (usa as tuas classes)
      const modal = document.createElement('div');
      modal.className = 'modal is-open';
      modal.id = 'gameSummaryModal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });

      const content = document.createElement('div');
      content.className = 'modal-content';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'close';
      closeBtn.setAttribute('aria-label', 'Fechar');
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => modal.remove());

      const title = document.createElement('h3');
      title.textContent = tLocal('summary_title');
      
      const diffKey = (md.aiDifficulty || '').toLowerCase();
      const diffLabel = diffKey ? tLocal(diffKey) : '';

      const modeLabel = md.mode === 'ia'
        ? `${tLocal('summary_mode_vs_ai')} (${diffLabel ? `${diffLabel}` : ''})`
        : tLocal('summary_mode_vs_player');

      const winnerText = (md.winner === 1 || md.winner === 2)
        ? `P${md.winner}`
        : tLocal('summary_no_winner');

      // helper para linhas
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

      const body = document.createElement('div');
      body.innerHTML = html;

      content.appendChild(closeBtn);
      content.appendChild(title);
      content.appendChild(body);
      modal.appendChild(content);
      document.body.appendChild(modal);
    }
  };

  window.TabStats = TabStats;
})();