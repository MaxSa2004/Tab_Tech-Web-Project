document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("myModalClassifications");
  if (!modal) return;

  const container = modal.querySelector("#leaderboard-container");
  
  // --- NEW: Elements for Tabs and Views ---
  const tabAI = document.getElementById("tab-ai");
  const tabPvP = document.getElementById("tab-pvp");
  const viewAI = document.getElementById("view-ai");
  const viewPvP = document.getElementById("view-pvp");
  const sortButton = container.querySelector("#sortbtn");

  // --- NEW: Auto-Switch Logic (Listens to "See Classifications" button) ---
  const openModalBtn = document.getElementById("myBtnClassifications");
  const gameModeSelect = document.getElementById("game_mode");

  if (openModalBtn && gameModeSelect) {
    openModalBtn.addEventListener("click", () => {
      // Check if "vs Player" or "vs AI" is selected
      const currentMode = gameModeSelect.value;

      if (currentMode === "player") {
        if (tabPvP) tabPvP.click(); // Switch to PvP tab
      } else {
        if (tabAI) tabAI.click();   // Switch to AI tab
      }
    });
  }

  // --- NEW: Tab Click Handlers ---
  if (tabAI && tabPvP) {
    tabAI.addEventListener("click", () => {
      // Visuals
      tabAI.classList.add("active");
      tabPvP.classList.remove("active");
      // Content
      viewAI.style.display = "block";
      viewPvP.style.display = "none";
      // Show sort button (Only AI list is sortable)
      if (sortButton) sortButton.style.display = "block";
    });

    tabPvP.addEventListener("click", () => {
      // Visuals
      tabPvP.classList.add("active");
      tabAI.classList.remove("active");
      // Content
      viewPvP.style.display = "block";
      viewAI.style.display = "none";
      // Hide sort button (Placeholders don't need sorting)
      if (sortButton) sortButton.style.display = "none";
    });
  }

  // --- Existing Logic (Translations, Sorting, Updates) ---
  
  const searchInput = container.querySelector(".ladder-search");
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
    leaderboardTitle: "Classificações", leaderSearch: "Procurar utilizador...",
    rank: "Posição", user: "Utilizador", games_played: "Jogos", games_won: "Vitórias", win_ratio: "Taxa de vitória %",
    easyIA: "IA (Fácil)", normalIA: " IA (Normal)", hardIA: "IA (Difícil)",
    leader_sort_desc: "Ordenar: Descendente ⬇️", leader_sort_asc: "Ordenar: Ascendente ⬆️",
    player1: "Jogador 1"
  };
  const DEFAULT_EN = {
    leaderboardTitle: "Leaderboard", leaderSearch: "Search User...",
    rank: "Rank", user: "User", games_played: "Games Played", games_won: "Games Won", win_ratio: "Win Ratio %",
    easyIA: "AI (Easy)", normalIA: "AI (Normal)", hardIA: "AI (Hard)",
    leader_sort_desc: "Sort: Descending ⬇️", leader_sort_asc: "Sort: Ascending ⬆️",
    player1: "Player 1"
  };

  // UPDATED: Only select players from the AI view for sorting/updating
  // (We don't want to sort the placeholders)
  const parentForRows = viewAI || container.querySelector(".leaderboard-view");

  function getPlayers() {
    if (!parentForRows) return [];
    return Array.from(parentForRows.querySelectorAll(".ladder-nav--results-players"));
  }

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

  function readRatio(player) {
    const el = player.querySelector(".results-ratio");
    if (!el) return 0;
    const txt = el.textContent.replace("%", "").trim();
    const v = parseFloat(txt);
    return isNaN(v) ? 0 : v;
  }

  function readIntFrom(player, selector) {
    const el = player.querySelector(selector);
    return el ? (parseInt(el.textContent.trim(), 10) || 0) : 0;
  }

  function readName(player) {
    return (player.querySelector('.results-user')?.textContent || '').trim().toLowerCase();
  }

  function sortLeaderboard() {
    // Safety check: if parentForRows doesn't exist (e.g. view-ai missing), stop.
    if (!parentForRows) return;

    updateRatios();
    const players = getPlayers();
    
    players.sort((a, b) => {
      const ra = readRatio(a);
      const rb = readRatio(b);
      // 1) Win ratio
      if (ra !== rb) return descending ? (rb - ra) : (ra - rb);
      // 2) Wins
      const gwa = readIntFrom(a, '.results-gw');
      const gwb = readIntFrom(b, '.results-gw');
      if (gwa !== gwb) return gwb - gwa;
      // 3) Games Played
      const gpa = readIntFrom(a, '.results-gp');
      const gpb = readIntFrom(b, '.results-gp');
      if (gpa !== gpb) return gpb - gpa;
      // 4) Name
      return readName(a).localeCompare(readName(b));
    });

    players.forEach((player, index) => {
      const posEl = player.querySelector(".positions");
      if (posEl) posEl.textContent = (index + 1).toString();
      parentForRows.appendChild(player);
    });

    if (sortButton) {
      sortButton.textContent = descending ? tLB('leader_sort_desc') : tLB('leader_sort_asc');
    }
  }

  function refreshUI() {
    const lbTitle = document.getElementById('leaderboardTitle');
    if (lbTitle) lbTitle.textContent = tLB('leaderboardTitle');

    const setLabel = (sel, key) => {
      const el = document.querySelector(sel);
      if (el) { const label = el.querySelector('label') || el; label.textContent = tLB(key); }
    };
    // Note: ensure your HTML uses id="user1" for the header label now
    setLabel('#rank', 'rank');
    setLabel('#user1', 'user'); 
    setLabel('#games_played', 'games_played');
    setLabel('#games_won', 'games_won');
    setLabel('#win_ratio', 'win_ratio');

    if (searchInput && 'placeholder' in searchInput) {
      searchInput.placeholder = tLB('leaderSearch');
    }

    const p1 = document.getElementById('player1');
    if (p1) p1.textContent = tLB('player1');
    const easyIA = document.getElementById('easyIA');
    if (easyIA) easyIA.textContent = tLB('easyIA');
    const normalIA = document.getElementById('normalIA');
    if (normalIA) normalIA.textContent = tLB('normalIA');
    const hardIA = document.getElementById('hardIA');
    if (hardIA) hardIA.textContent = tLB('hardIA');

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

  // Initialization
  refreshUI();

  // Load Saved Data (Legacy)
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
  sortLeaderboard();

  window.__refreshLeaderboard = () => {
    refreshUI();
    if (sortButton) {
      sortButton.textContent = descending ? tLB('leader_sort_desc') : tLB('leader_sort_asc');
    }
  };

  // UPDATED: Works primarily on the AI rows
  window.updateLeaderboard = function (winnerName, loserName) {
    if (!parentForRows) return;
    const rows = parentForRows.querySelectorAll(".ladder-nav--results-players");

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

      const ratio = gp > 0 ? Math.round((gw / gp) * 100) : 0;
      ratioEl.textContent = ratio + "%";
    });

    // Save
    const leaderboardData = Array.from(rows).map(p => ({
      name: p.querySelector(".results-user").textContent.trim(),
      gp: parseInt(p.querySelector(".results-gp").textContent.trim()),
      gw: parseInt(p.querySelector(".results-gw").textContent.trim())
    }));
    localStorage.setItem("leaderboardData", JSON.stringify(leaderboardData));

    sortLeaderboard();
  };
});
