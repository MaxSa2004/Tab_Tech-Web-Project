// leaderBoard.js
document.addEventListener("DOMContentLoaded", () => {
  // Main elements (in case they don't exist)
  const modal = document.getElementById("myModalClassifications");
  if (!modal) return; //if doesnt exist, dont do anything
  const container = modal.querySelector("#leaderboard-container");
  if (!container) return;
  const rowsContainer = container.querySelector(".leaderboard-rows") || null;
  
  const parentForRows = rowsContainer || container;

  const searchInput = container.querySelector(".ladder-search");
  const sortButton = container.querySelector("#sortbtn");
  let descending = true;
  //configuration of different languages in leaderBoard (EN/PT)
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

  //Get info of each player
  function getPlayers() {
    
    return Array.from(parentForRows.querySelectorAll(".ladder-nav--results-players"));
  }

  //Update ratios for ranking
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

  //Reads a ratio player, removing the %
  function readRatio(player) {
    const el = player.querySelector(".results-ratio");
    if (!el) return 0;
    const txt = el.textContent.replace("%", "").trim();
    const v = parseFloat(txt);
    return isNaN(v) ? 0 : v;
  }

  //Reads an integer from a cell
  function readIntFrom(player, selector) {
    const el = player.querySelector(selector);
    return el ? (parseInt(el.textContent.trim(), 10) || 0) : 0;
  }
  // Name in case there is a tie
  function readName(player) {
    return (player.querySelector('.results-user')?.textContent || '').trim().toLowerCase();
  }

  // Sorts the leaderboard and inserts the new data
  function sortLeaderboard() {
    updateRatios();

    const players = getPlayers();
    players.sort((a, b) => {
      const ra = readRatio(a);
      const rb = readRatio(b);
      // orders by win ratio
      if (ra !== rb) return descending ? (rb - ra) : (ra - rb);

      // number of wins, always prioritizing the amount of wins
      const gwa = readIntFrom(a, '.results-gw');
      const gwb = readIntFrom(b, '.results-gw');
      if (gwa !== gwb) return gwb - gwa;

      // sorting by games played 
      const gpa = readIntFrom(a, '.results-gp');
      const gpb = readIntFrom(b, '.results-gp');
      if (gpa !== gpb) return gpb - gpa;

      // as last criteria, name ascending by ascii code
      return readName(a).localeCompare(readName(b));
    });

    // Inserts it each player row the values
    players.forEach((player, index) => {
      const posEl = player.querySelector(".positions");
      if (posEl) posEl.textContent = (index + 1).toString();
      // appends to the end, then sorts
      parentForRows.appendChild(player);
    });
    //updates the sorting button, as asc/desc
    if (sortButton) {
      sortButton.textContent = descending ? tLB('leader_sort_desc') : tLB('leader_sort_asc');
    }
  }

  // updates de ui, based on the language selected
  function refreshUI() {
    // Title
    const lbTitle = document.getElementById('leaderboardTitle');
    if (lbTitle) lbTitle.textContent = tLB('leaderboardTitle');

    //Header
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

    // Placeholder for the search
    if (searchInput && 'placeholder' in searchInput) {
      searchInput.placeholder = tLB('leaderSearch');
    }

    // Name in lines
    const p1 = document.getElementById('player1');
    if (p1) p1.textContent = tLB('player1');

    const easyIA = document.getElementById('easyIA');
    if (easyIA) easyIA.textContent = tLB('easyIA');

    const normalIA = document.getElementById('normalIA');
    if (normalIA) normalIA.textContent = tLB('normalIA');

    const hardIA = document.getElementById('hardIA');
    if (hardIA) hardIA.textContent = tLB('hardIA');

    // Sort button according to current language
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


  // Initializing
  refreshUI();

  // Return of data saved
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
  //Sorts after allocating the new 
  sortLeaderboard();

  // Show after we call languageScript
  window.__refreshLeaderboard = () => {
    refreshUI();
    // Keeping the language aligned
    if (sortButton) {
      sortButton.textContent = descending ? tLB('leader_sort_desc') : tLB('leader_sort_asc');
    }
  };

  // Updates leaderboard dynamically from game results
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

      //Calculation of the ratio
      const ratio = gp > 0 ? Math.round((gw / gp) * 100) : 0;
      ratioEl.textContent = ratio + "%";
    });

    // Saves the current state of the leaderboard onto the local storage
    const leaderboardData = Array.from(rows).map(p => ({
      name: p.querySelector(".results-user").textContent.trim(),
      gp: parseInt(p.querySelector(".results-gp").textContent.trim()),
      gw: parseInt(p.querySelector(".results-gw").textContent.trim())
    }));
    localStorage.setItem("leaderboardData", JSON.stringify(leaderboardData));

    // Sorts leaderboard after the update of the leaderboard
    sortLeaderboard();
  };
});






