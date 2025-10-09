(function () {
  // pegar referências
  var modalInstructions = document.getElementById("myModalInstructions");
  var modalClassifications = document.getElementById("myModalClassifications");
  var btnExtra = document.getElementById("myBtnExtra");
  var btnInstructions = document.getElementById("myBtnInstructions");
  var btnClassifications = document.getElementById("myBtnClassifications");
  var modalExtra = document.getElementById("myModalExtra");

  function openModal(modal, opener) {
    if (!modal) return;
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    modal._opener = opener || null; // guardar para devolver foco
    document.body.classList.add('modal-open');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (modal._opener && typeof modal._opener.focus === 'function') modal._opener.focus();
  }

  // abrir
  if (btnInstructions) btnInstructions.addEventListener('click', function () { openModal(modalInstructions, btnInstructions); });
  if (btnClassifications) btnClassifications.addEventListener('click', function () { openModal(modalClassifications, btnClassifications); });
  if (btnExtra) btnExtra.addEventListener('click', function () { openModal(modalExtra, btnExtra); });

  // fechar: todos os botões .close
  document.querySelectorAll('.modal .close').forEach(function (closeBtn) {
    closeBtn.addEventListener('click', function () {
      var modal = closeBtn.closest('.modal');
      closeModal(modal);
    });
  });

  // fechar ao clicar no overlay (um único handler)
  document.addEventListener('click', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('modal')) {
      closeModal(e.target);
    }
  });

  // fechar com Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal').forEach(function (m) {
        if (m.style.display === 'block') closeModal(m);
      });
    }
  });

  // avisos para debug
  if (!btnInstructions) console.warn('btnInstructions not found');
  if (!btnClassifications) console.warn('btnClassifications not found');
  if (!modalExtra) console.warn('modalExtra not found');
  if (!modalInstructions) console.warn('modalInstructions not found');
  if (!modalClassifications) console.warn('modalClassifications not found');
  if (!btnExtra) console.warn('btnExtra not found');

})();

document.addEventListener("DOMContentLoaded", () => {
  const widthSelect = document.getElementById("width");
  const board = document.getElementById("gameBoard");

  // Default size
  let boardWidth = 9;
  createBoard(boardWidth);

  // Update board when user selects new width
  widthSelect.addEventListener("change", (e) => {
    boardWidth = parseInt(e.target.value, 10);
    createBoard(boardWidth);
  });

  // Function to generate the board
  function createBoard(cols) {
  const rows = 4;
  board.innerHTML = "";
  board.style.gridTemplateColumns = `repeat(${cols}, minmax(36px, 1fr))`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");

      const arrow = document.createElement("i");

      // Pattern logic
      if (r === 0) arrow.className = "arrow " + (c === 0 ? "down" : "left");
      else if (r === 1)
        arrow.className = "arrow " + (c === 0 || c === cols - 1 ? "up down" : "right");
      else if (r === 2)
        arrow.className = "arrow " + (c === cols - 1 ? "up down" : "left");
      else if (r === 3)
        arrow.className = "arrow " + (c === cols - 1 ? "up" : "right");

      cell.appendChild(arrow);
      board.appendChild(cell);
    }
  }
}
});
