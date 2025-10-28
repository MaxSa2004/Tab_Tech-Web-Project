// leaderBoard.js
document.addEventListener("DOMContentLoaded", () => {
  // Elementos principais (proteções caso não existam)
  const modal = document.getElementById("myModalClassifications");
  if (!modal) return; // nada a fazer se não existir
  const container = modal.querySelector("#leaderboard-container");
  if (!container) return;
  const rowsContainer = container.querySelector(".leaderboard-rows") || null;
  // Se o layout do HTML não tem .leaderboard-rows (no teu HTML atual os players estão diretamente no #leaderboard-container)
  // tentamos trabalhar com container como fallback:
  const parentForRows = rowsContainer || container;

  const searchInput = container.querySelector(".ladder-search");
  const sortButton = container.querySelector("#sortbtn");
  let descending = true;

  function tLB(key) {
    const lang = window.currentLang || 'en';
    const root = (typeof i18n !== 'undefined' ? i18n : window.i18n) || {};
    return (root[lang] && root[lang][key])
      || (root.en && root.en[key])
      || (lang === 'pt' ? DEFAULT_PT[key] : DEFAULT_EN[key])
      || key;
  }
  const DEFAULT_PT = {
    leaderboardTitle: "Classificações",
    leaderSearch: "Procurar utilizador...",
    rank: "Posição",
    user: "Utilizador",
    games_played: "Jogos",
    games_won: "Vitórias",
    win_ratio: "Taxa de vitória %",
    easyIA: "IA (Fácil)", normalIA: " IA (Normal)", hardIA: "IA (Difícil)",
    leader_sort_desc: "Ordenar: Descendente ⬇️",
    leader_sort_asc: "Ordenar: Ascendente ⬆️",
    player1: "Jogador 1"
  };
  const DEFAULT_EN = {
    leaderboardTitle: "Leaderboard",
    leaderSearch: "Search User...",
    rank: "Rank",
    user: "User",
    games_played: "Games Played",
    games_won: "Games Won",
    win_ratio: "Win Ratio %",
    easyIA: "AI (Easy)", normalIA: "AI (Normal)", hardIA: "AI (Hard)",
    leader_sort_desc: "Sort: Descending ⬇️",
    leader_sort_asc: "Sort: Ascending ⬆️",
    player1: "Player 1"
  };

  // Obter todos os "player rows" — selector adaptado ao teu HTML
  function getPlayers() {
    // procura pela classe que usas para cada linha de jogador
    return Array.from(parentForRows.querySelectorAll(".ladder-nav--results-players"));
  }

  // Atualiza a coluna de percentagem (ex: "42.3%")
  function updateRatios() {
    getPlayers().forEach(player => {
      const gpEl = player.querySelector(".results-gp");
      const gwEl = player.querySelector(".results-gw");
      const ratioEl = player.querySelector(".results-ratio");

      const gp = gpEl ? parseInt(gpEl.textContent.trim(), 10) || 0 : 0;
      const gw = gwEl ? parseInt(gwEl.textContent.trim(), 10) || 0 : 0;
      const ratio = gp > 0 ? ((gw / gp) * 100) : 0;
      if (ratioEl) ratioEl.textContent = ratio.toFixed(1) + "%";
    });
  }

  // Ler um valor numérico da coluna results-ratio (remove o "%" se existir)
  function readRatio(player) {
    const el = player.querySelector(".results-ratio");
    if (!el) return 0;
    const txt = el.textContent.replace("%", "").trim();
    const v = parseFloat(txt);
    return isNaN(v) ? 0 : v;
  }

  // Ordena e re-inserir as linhas no container correto
  function sortLeaderboard() {
    updateRatios();

    const players = getPlayers();
    players.sort((a, b) => {
      const ra = readRatio(a);
      const rb = readRatio(b);
      return descending ? rb - ra : ra - rb;
    });

    // Reatribuir posições e anexar na ordem ao parentForRows
    players.forEach((player, index) => {
      const posEl = player.querySelector(".positions");
      if (posEl) posEl.textContent = (index + 1).toString();
      // appendChild move o nó para o fim; assim reordenamos
      parentForRows.appendChild(player);
    });
    // Atualiza o rótulo do botão sort de acordo com o estado e língua
    if (sortButton) {
      sortButton.textContent = descending ? tLB('leader_sort_desc') : tLB('leader_sort_asc');
    }
  }

  /// Atualiza textos (tradução) do Leaderboard
  function refreshUI() {
    // Título
    const lbTitle = document.getElementById('leaderboardTitle');
    if (lbTitle) lbTitle.textContent = tLB('leaderboardTitle');

    // Cabeçalhos (divs com id e um <label> dentro)
    const setLabel = (sel, key) => {
      const el = document.querySelector(sel);
      if (el) {
        const label = el.querySelector('label') || el;
        label.textContent = tLB(key);
      }
    };
    setLabel('#rank', 'rank');
    setLabel('#user', 'user');
    setLabel('#games_played', 'games_played');
    setLabel('#games_won', 'games_won');
    setLabel('#win_ratio', 'win_ratio');

    // Placeholder pesquisa
    if (searchInput && 'placeholder' in searchInput) {
      searchInput.placeholder = tLB('leaderSearch');
    }

    // Nomes nas linhas
    const p1 = document.getElementById('player1');
    if (p1) p1.textContent = tLB('player1');

    const easyIA = document.getElementById('easyIA');
    if (easyIA) easyIA.textContent = tLB('easyIA');

    const normalIA = document.getElementById('normalIA');
    if (normalIA) normalIA.textContent = tLB('normalIA');

    const hardIA = document.getElementById('hardIA');
    if (hardIA) hardIA.textContent = tLB('hardIA');

    // Botão Sort (texto coerente com estado atual)
    if (sortButton) {
      sortButton.textContent = descending ? tLB('leader_sort_desc') : tLB('leader_sort_asc');
    }
  }

  if (sortButton) {
    sortButton.addEventListener("click", () => {
      descending = !descending;
      sortLeaderboard();
    });
  }

  // Restauro de dados guardados (legacy por nome)
  const savedData = JSON.parse(localStorage.getItem("leaderboardData") || "[]");
  if (savedData.length > 0) {
    const rows = getPlayers();
    savedData.forEach(data => {
      const player = rows.find(
        p => p.querySelector(".results-user")?.textContent.trim() === data.name
      );
      if (player) {
        const gpEl = player.querySelector(".results-gp");
        const gwEl = player.querySelector(".results-gw");
        if (gpEl) gpEl.textContent = String(parseInt(data.gp, 10) || 0);
        if (gwEl) gwEl.textContent = String(parseInt(data.gw, 10) || 0);
      }
    });
  }

  // Inicialização
  refreshUI();
  sortLeaderboard();

  // Expor para o languageScript chamar após mudar de língua
  window.__refreshLeaderboard = () => {
    refreshUI();
    // garantir label do botão coerente
    if (sortButton) {
      sortButton.textContent = descending ? tLB('leader_sort_desc') : tLB('leader_sort_asc');
    }
  };

  // Update leaderboard dynamically from game results
  window.updateLeaderboard = function (winnerName, loserName) {
    const container = document.querySelector("#leaderboard-container");
    if (!container) return;

    const rows = container.querySelectorAll(".ladder-nav--results-players");

    rows.forEach(player => {
      const username = player.querySelector(".results-user").textContent.trim();
      const gpEl = player.querySelector(".results-gp");
      const gwEl = player.querySelector(".results-gw");
      const ratioEl = player.querySelector(".results-ratio");

      let gp = parseInt(gpEl.textContent) || 0;
      let gw = parseInt(gwEl.textContent) || 0;

      if (username === winnerName) {
        gp++;
        gw++;
      } else if (username === loserName) {
        gp++;
      }

      gpEl.textContent = gp;
      gwEl.textContent = gw;

      // 🔹 Calculate win ratio safely
      const ratio = gp > 0 ? Math.round((gw / gp) * 100) : 0;
      ratioEl.textContent = ratio + "%";
    });

    // 🔸 Save leaderboard to localStorage
    const leaderboardData = Array.from(rows).map(p => ({
      name: p.querySelector(".results-user").textContent.trim(),
      gp: parseInt(p.querySelector(".results-gp").textContent.trim()),
      gw: parseInt(p.querySelector(".results-gw").textContent.trim())
    }));
    localStorage.setItem("leaderboardData", JSON.stringify(leaderboardData));

    // Inicial: calcula ratios e ordena
    sortLeaderboard();
  };
  });






