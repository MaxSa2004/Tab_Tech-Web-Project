// leaderBoard.js
document.addEventListener("DOMContentLoaded", () => {
  // Main elements (in case they don't exist)
  const modal = document.getElementById("myModalClassifications");
  const container = modal.querySelector("#leaderboard-container");
  if (!modal || !container) return;
  const rowsContainer = container.querySelector(".leaderboard-rows") || container;


  const searchInput = container.querySelector(".ladder-search");
  const sortButton = container.querySelector("#sortbtn");

  let descending = true;
  const group = 36;

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
    user1: "Utilizador",
    games_played: "Jogos",
    games_won: "Vitórias",
    win_ratio: "Taxa de vitória %",
    easyIA: "IA (Fácil)", normalIA: " IA (Normal)", hardIA: "IA (Difícil)",
    leader_sort_desc: "Ordenar: Descendente",
    leader_sort_asc: "Ordenar: Ascendente",
    player1: "Jogador 1"
  };
  const DEFAULT_EN = {
    leaderboardTitle: "Leaderboard",
    leaderSearch: "Search User...",
    rank: "Rank",
    user1: "User",
    games_played: "Games Played",
    games_won: "Games Won",
    win_ratio: "Win Ratio %",
    easyIA: "AI (Easy)", normalIA: "AI (Normal)", hardIA: "AI (Hard)",
    leader_sort_desc: "Sort: Descending",
    leader_sort_asc: "Sort: Ascending",
    player1: "Player 1"
  };

  //Get info of each player
  function getPlayers() {
    return Array.from(rowsContainer.querySelectorAll(".ladder-nav--results-players"));
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
      rowsContainer.appendChild(player);
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
    setLabel('#user1', 'user1');
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



  // Show after we call languageScript
  window.__refreshLeaderboard = async () => {
    refreshUI();
    
    // Keeping the language aligned
    if (sortButton) {
      sortButton.textContent = descending ? tLB('leader_sort_desc') : tLB('leader_sort_asc');
      
      const widthSelect = document.getElementById('width');
      const size = widthSelect ? parseInt(widthSelect.value, 10) : 9;
      try {
        const data = await Network.ranking({group, size});
        const rankingList = data.ranking || [];
        renderRankingTable(rankingList);
      } catch (err) {
        rowsContainer.innerHTML = `<p>Error loading leaderboard: ${err.message}</p>`;
        console.warn('Error fetching ranking:', err);
      }
    }
  };

  window.fetchRanking = window.__refreshLeaderboard;


  function renderRankingTable(playersData){
    rowsContainer.innerHTML = '';
    if(!playersData || playersData.length === 0){
      rowsContainer.innerHTML = '<p>No data available.</p>';
      return;
    }
    playersData.forEach((playerData, index) => {
      const games = (playerData.games_played ?? playerData.games) || 0;
      const wins = (playerData.games_won ?? playerData.victories) || 0;
      const ratio = games > 0 ? ((wins / games) * 100).toFixed(1) + '%' : '0%';
      const row = document.createElement('div');
      row.className = 'ladder-nav--results-players';
      const colRank = createCol('positions', String(index + 1));
      const colUser = createCol('results-user', playerData.nick || 'Unknown');
      const colGamesPlayed = createCol('results-gp', String(games));
      const colGamesWon = createCol('results-gw', String(wins));
      const colRatio = createCol('results-ratio', ratio);
      row.appendChild(colRank);
      row.appendChild(colUser);
      row.appendChild(colGamesPlayed);
      row.appendChild(colGamesWon);
      row.appendChild(colRatio);
      rowsContainer.appendChild(row);

    });
    sortLeaderboard();
  }
  function createCol(className, textContent){
    const col = document.createElement('div');
    col.className = className;
    const label = document.createElement('label');
    label.textContent = textContent;
    col.appendChild(label);
    return col;
  }
});






