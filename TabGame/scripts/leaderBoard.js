document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("myModalClassifications");
  if (!modal) return;

  const container = modal.querySelector("#leaderboard-container");
  
  // --- Tab Elements ---
  const tabAI = document.getElementById("tab-ai");
  const tabPvP = document.getElementById("tab-pvp");
  const viewAI = document.getElementById("view-ai");
  const viewPvP = document.getElementById("view-pvp");
  const sortButton = container.querySelector("#sortbtn");

  // --- 1. Tab Switching Logic ---
  const openModalBtn = document.getElementById("myBtnClassifications");
  const gameModeSelect = document.getElementById("game_mode");

  if (openModalBtn && gameModeSelect) {
    openModalBtn.addEventListener("click", () => {
      const currentMode = gameModeSelect.value;
      if (currentMode === "player") {
        if (tabPvP) tabPvP.click();
      } else {
        if (tabAI) tabAI.click();
      }
    });
  }

  if (tabAI && tabPvP) {
    tabAI.addEventListener("click", () => {
      tabAI.classList.add("active");
      tabPvP.classList.remove("active");
      viewAI.style.display = "block";
      viewPvP.style.display = "none";
      if (sortButton) sortButton.style.display = "block"; 
    });

    tabPvP.addEventListener("click", () => {
      tabPvP.classList.add("active");
      tabAI.classList.remove("active");
      viewPvP.style.display = "block";
      viewAI.style.display = "none";
      if (sortButton) sortButton.style.display = "none"; 
    });
  }

  // --- 2. Helper Functions ---
  let descending = true;

  function getAIPlayers() {
    if (!viewAI) return [];
    return Array.from(viewAI.querySelectorAll(".ladder-nav--results-players"));
  }

  function readIntFrom(player, selector) {
    const el = player.querySelector(selector);
    return el ? (parseInt(el.textContent.trim(), 10) || 0) : 0;
  }

  function updateRatio(player) {
    const gp = readIntFrom(player, ".results-gp");
    const gw = readIntFrom(player, ".results-gw");
    const ratioEl = player.querySelector(".results-ratio");
    
    const ratio = gp > 0 ? ((gw / gp) * 100) : 0;
    if (ratioEl) ratioEl.textContent = ratio.toFixed(1) + "%";
  }

  // --- 3. Sorting Logic ---
  function sortAILeaderboard() {
    const players = getAIPlayers();
    
    players.sort((a, b) => {
      // 1. Win Ratio
      const rA = parseFloat(a.querySelector(".results-ratio").textContent) || 0;
      const rB = parseFloat(b.querySelector(".results-ratio").textContent) || 0;
      if (rA !== rB) return descending ? (rB - rA) : (rA - rB);

      // 2. Games Won
      const gwA = readIntFrom(a, '.results-gw');
      const gwB = readIntFrom(b, '.results-gw');
      if (gwA !== gwB) return gwB - gwA;

      return 0; 
    });

    players.forEach((player, index) => {
      const posEl = player.querySelector(".positions");
      if (posEl) posEl.textContent = (index + 1).toString();
      viewAI.appendChild(player);
    });

    if (sortButton) {
      sortButton.textContent = descending ? "Sort: Descending ⬇️" : "Sort: Ascending ⬆️";
    }
  }

  if (sortButton) {
    sortButton.addEventListener("click", () => {
      descending = !descending;
      sortAILeaderboard();
    });
  }

  // --- 4. DATA SAVING / LOADING ---
  function saveAIData() {
    const players = getAIPlayers();
    const data = players.map(p => ({
      name: p.querySelector(".results-user").textContent.trim(),
      gp: readIntFrom(p, ".results-gp"),
      gw: readIntFrom(p, ".results-gw")
    }));
    localStorage.setItem("leaderboardData_AI_Fixed", JSON.stringify(data));
  }

  function loadAIData() {
    const saved = localStorage.getItem("leaderboardData_AI_Fixed");
    if (!saved) return;
    
    const data = JSON.parse(saved);
    const players = getAIPlayers();

    data.forEach(entry => {
      const playerRow = players.find(p => p.querySelector(".results-user").textContent.trim() === entry.name);
      if (playerRow) {
        playerRow.querySelector(".results-gp").textContent = entry.gp;
        playerRow.querySelector(".results-gw").textContent = entry.gw;
        updateRatio(playerRow);
      }
    });
  }

  // --- 5. THE UPDATE FUNCTION ---
  window.updateLeaderboard = function (winnerName, loserName) {
    const players = getAIPlayers();
    let updated = false;

    players.forEach(player => {
      const nameEl = player.querySelector(".results-user");
      const name = nameEl.textContent.trim(); 

      if (name === winnerName) {
        let gp = readIntFrom(player, ".results-gp") + 1;
        let gw = readIntFrom(player, ".results-gw") + 1;
        player.querySelector(".results-gp").textContent = gp;
        player.querySelector(".results-gw").textContent = gw;
        updateRatio(player);
        updated = true;
      } else if (name === loserName) {
        let gp = readIntFrom(player, ".results-gp") + 1;
        player.querySelector(".results-gp").textContent = gp;
        updateRatio(player);
        updated = true;
      }
    });

    if (updated) {
      sortAILeaderboard();
      saveAIData();
    }
  };

  // --- 6. INITIALIZATION ---
  function enforceEnglishNames() {
    const p1 = document.getElementById('player1');
    const easy = document.getElementById('easyIA');
    const norm = document.getElementById('normalIA');
    const hard = document.getElementById('hardIA');

    if(p1) p1.textContent = "Player 1";
    if(easy) easy.textContent = "AI (Easy)";
    if(norm) norm.textContent = "AI (Normal)";
    if(hard) hard.textContent = "AI (Hard)";
  }

  enforceEnglishNames(); 
  loadAIData();          
  sortAILeaderboard();   
  window.__refreshLeaderboard = () => { };
});

// ==========================================
// 7. THE BRIDGE (TabStats)
// This connects game_rules.js to the Leaderboard
// ==========================================
window.TabStats = (function() {
    let currentWinner = null;

    // Called by game_rules.js when a game ends
    function setWinner(winnerNum) {
        currentWinner = winnerNum;
    }

    // Called by game_rules.js to show summary
    function showSummary() {
        // Only run this logic if we are in AI mode (as requested)
        if (!window.GameState || !window.GameState.vsAI) return;

        // 1. Determine the AI Name based on difficulty selected
        const difficulty = window.GameState.aiDifficulty || 'normal';
        let aiName = "AI (Normal)";
        if (difficulty === 'easy') aiName = "AI (Easy)";
        if (difficulty === 'hard') aiName = "AI (Hard)";

        const humanName = "Player 1";
        
        // 2. Determine Winner/Loser String Names
        // Game Logic: 1 is Human, 2 is AI
        let winnerName, loserName;

        if (currentWinner === 1) {
            winnerName = humanName;
            loserName = aiName;
        } else {
            winnerName = aiName;
            loserName = humanName;
        }

        // 3. Update the Leaderboard
        if (typeof window.updateLeaderboard === 'function') {
            window.updateLeaderboard(winnerName, loserName);
        }

        
    }

    // Empty functions so game_rules.js doesn't crash when calling them
    return {
        setWinner: setWinner,
        showSummary: showSummary,
        onDice: () => {},
        onPass: () => {},
        onExtraRoll: () => {},
        onTurnAdvance: () => {},
        onCapture: () => {},
        onMove: () => {}
    };
})();