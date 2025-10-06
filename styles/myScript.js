(function () {
  // pegar referências
  var modalInstructions = document.getElementById("myModalInstructions");
  var modalClassifications = document.getElementById("myModalClassifications");
  var btnInstructions = document.getElementById("myBtnInstructions");
  var btnClassifications = document.getElementById("myBtnClassifications");

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
  if (!modalInstructions) console.warn('modalInstructions not found');
  if (!modalClassifications) console.warn('modalClassifications not found');

})();