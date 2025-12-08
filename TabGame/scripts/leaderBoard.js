contents = document.addEventListener("DOMContentLoaded", () => {
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
    return el ? parseInt(el.textContent.trim(), 10) || 0 : 0;
  }

  function updateRatio(player) {
    const gp = readIntFrom(player, ".results-gp");
    const gw = readIntFrom(player, ".results-gw");
    const ratioEl = player.querySelector(".results-ratio");

    const ratio = gp > 0 ? (gw / gp) * 100 : 0;
    if (ratioEl) ratioEl.textContent = ratio.toFixed(1) + "%";
  }

  // --- 3. Sorting Logic ---
  function sortAILeaderboard() {
    const players = getAIPlayers();

    players.sort((a, b) => {
      // 1. Win Ratio
      const rA = parseFloat(a.querySelector(".results-ratio").textContent) || 0;
      const rB = parseFloat(b.querySelector(".results-ratio").textContent) || 0;
      if (rA !== rB) return descending ? rB - rA : rA - rB;

      // 2. Games Won
      const gwA = readIntFrom(a, ".results-gw");
      const gwB = readIntFrom(b, ".results-gw");
      if (gwA !== gwB) return gwB - gwA;

      return 0;
    });

    players.forEach((player, index) => {
      const posEl = player.querySelector(".positions");
      if (posEl) posEl.textContent = (index + 1).toString();
      viewAI.appendChild(player);
    });

    if (sortButton) {
      sortButton.textContent = descending
        ? "Sort: Descending ⬇️"
        : "Sort: Ascending ⬆️";
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
    const data = players.map((p) => ({
      name: p.querySelector(".results-user").textContent.trim(),
      gp: readIntFrom(p, ".results-gp"),
      gw: readIntFrom(p, ".results-gw"),
    }));
    localStorage.setItem("leaderboardData_AI_Fixed", JSON.stringify(data));
  }

  function loadAIData() {
    const saved = localStorage.getItem("leaderboardData_AI_Fixed");
    if (!saved) return;

    const data = JSON.parse(saved);
    const players = getAIPlayers();

    data.forEach((entry) => {
      const playerRow = players.find(
        (p) =>
          p.querySelector(".results-user").textContent.trim() === entry.name
      );
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

    players.forEach((player) => {
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
    const p1 = document.getElementById("player1");
    const easy = document.getElementById("easyIA");
    const norm = document.getElementById("normalIA");
    const hard = document.getElementById("hardIA");

    if (p1) p1.textContent = "Player 1";
    if (easy) easy.textContent = "AI (Easy)";
    if (norm) norm.textContent = "AI (Normal)";
    if (hard) hard.textContent = "AI (Hard)";
  }

  enforceEnglishNames();
  loadAIData();
  sortAILeaderboard();
  // Ensure both refresh names exist (some other scripts call __refreshLeaderBoard or __refreshLeaderboard)
  window.__refreshLeaderboard = window.__refreshLeaderboard || (() => {});
  window.__refreshLeaderBoard =
    window.__refreshLeaderBoard || window.__refreshLeaderboard;
});

// ==========================================
// 7. THE BRIDGE (TabStats) - MERGE, DON'T OVERWRITE
// Previously this file replaced window.TabStats completely which caused gameScript.js to fail
// because gameScript expects TabStats.start, reset and several tracking methods. Instead of
// replacing window.TabStats, we extend/augment it so existing functionality remains intact.
// ==========================================
(function () {
  // keep internal currentWinner local to bridge
  let currentWinner = null;

  // Preserve any original TabStats (created by statsScript.js)
  const originalTabStats = window.TabStats || null;

  // Create a bridge object that merges original methods with the leaderboard-specific behavior
  const bridge = Object.assign({}, originalTabStats || {});

  // setWinner should update our local state and call original if present
  bridge.setWinner = function (winnerNum) {
    currentWinner = winnerNum;
    if (originalTabStats && typeof originalTabStats.setWinner === "function") {
      try {
        originalTabStats.setWinner(winnerNum);
      } catch (e) {
        console.warn("original TabStats.setWinner failed", e);
      }
    }
  };

  // showSummary should run original behavior (if any) and then update leaderboard when appropriate
  bridge.showSummary = function () {
    if (
      originalTabStats &&
      typeof originalTabStats.showSummary === "function"
    ) {
      try {
        originalTabStats.showSummary();
      } catch (e) {
        console.warn("original TabStats.showSummary failed", e);
      }
    }

    // Our extra behavior: update leaderboard when in AI mode
    try {
      if (!window.GameState || !window.GameState.vsAI) return;

      const difficulty = (
        window.GameState.aiDifficulty || "normal"
      ).toLowerCase();
      let aiName = "AI (Normal)";
      if (difficulty === "easy") aiName = "AI (Easy)";
      if (difficulty === "hard") aiName = "AI (Hard)";

      const humanName = "Player 1";

      let winnerName, loserName;
      if (currentWinner === 1) {
        winnerName = humanName;
        loserName = aiName;
      } else {
        winnerName = aiName;
        loserName = humanName;
      }

      if (typeof window.updateLeaderboard === "function") {
        window.updateLeaderboard(winnerName, loserName);
      }
    } catch (e) {
      console.warn("leaderboard bridge showSummary error", e);
    }
  };

  // Ensure tracker methods exist so other code can call them safely.
  // If originals exist, keep them; otherwise provide no-op implementations.
  bridge.onDice = bridge.onDice || function () {};
  bridge.onPass = bridge.onPass || function () {};
  bridge.onExtraRoll = bridge.onExtraRoll || function () {};
  bridge.onTurnAdvance = bridge.onTurnAdvance || function () {};
  bridge.onCapture = bridge.onCapture || function () {};
  bridge.onMove = bridge.onMove || function () {};
  bridge.start =
    bridge.start ||
    (originalTabStats && originalTabStats.start) ||
    function () {};
  bridge.reset =
    bridge.reset ||
    (originalTabStats && originalTabStats.reset) ||
    function () {};

  // Finally assign back to window.TabStats without clobbering other global refs
  window.TabStats = bridge;
})();
