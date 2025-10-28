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
  const sortButton = container.querySelector("#sort-btn");
  let descending = true;

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
  }

  // Inicializa texto do botão corretamente
  if (sortButton) {
    sortButton.textContent = `Sort: ${descending ? "Descending ⬇️" : "Ascending ⬆️"}`;
    sortButton.addEventListener("click", () => {
      descending = !descending;
      sortButton.textContent = `Sort: ${descending ? "Descending ⬇️" : "Ascending ⬆️"}`;
      sortLeaderboard();
    });
  }

  // Pesquisa — destaca (glow) ou esconde (dim) conforme valor
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const searchValue = searchInput.value.toLowerCase().trim();
      getPlayers().forEach(player => {
        const userEl = player.querySelector(".results-user");
        const username = userEl ? userEl.textContent.toLowerCase().trim() : "";
        if (searchValue === "") {
          player.classList.remove("glow", "dim");
        } else if (username.includes(searchValue)) {
          player.classList.add("glow");
          player.classList.remove("dim");
        } else {
          player.classList.remove("glow");
          player.classList.add("dim");
        }
      });
    });
  }


  // Inicial: calcula ratios e ordena
  sortLeaderboard();
  // Restore leaderboard from localStorage if available
  const savedData = JSON.parse(localStorage.getItem("leaderboardData") || "[]");
  if (savedData.length > 0) {
    const rows = getPlayers();
    savedData.forEach(data => {
      const player = rows.find(
        p => p.querySelector(".results-user").textContent.trim() === data.name
      );
      if (player) {
        player.querySelector(".results-gp").textContent = data.gp;
        player.querySelector(".results-gw").textContent = data.gw;
      }
    });
    updateRatios();
    sortLeaderboard();
  }


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

    // 🔸 Refresh ratios & sorting
    if (typeof sortLeaderboard === "function") sortLeaderboard();
  };


});
