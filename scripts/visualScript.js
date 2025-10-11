// visualScript.js — versão corrigida
document.addEventListener('DOMContentLoaded', () => {
    // modal refs
    const btnInstructions = document.getElementById('myBtnInstructions');
    const btnClassifications = document.getElementById('myBtnClassifications');
    const btnExtra = document.getElementById('myBtnExtra');
    const modalInstructions = document.getElementById('myModalInstructions');
    const modalClassifications = document.getElementById('myModalClassifications');
    const modalExtra = document.getElementById('myModalExtra');
    
    function openModal(modal, opener) {
        if (!modal) return;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        modal._opener = opener || null;
        document.body.classList.add('modal-open');

        // focus no primeiro foco interno
        const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable) focusable.focus();
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        if (modal._opener && typeof modal._opener.focus === 'function') modal._opener.focus();
    }


    // Attach modal openers
    if (btnInstructions) btnInstructions.addEventListener('click', (e) => { e.preventDefault(); openModal(modalInstructions, btnInstructions); });
    if (btnClassifications) btnClassifications.addEventListener('click', (e) => { e.preventDefault(); openModal(modalClassifications, btnClassifications); });
    if (btnExtra) btnExtra.addEventListener('click', (e) => { e.preventDefault(); openModal(modalExtra, btnExtra); });

    // close buttons (.close)
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            const modal = closeBtn.closest('.modal');
            closeModal(modal);
        });
    });

    // overlay click closes when clicking the outer modal container
    document.addEventListener('click', (e) => {
        if (e.target && e.target.classList && e.target.classList.contains('modal')) {
            closeModal(e.target);
        }
    });

    // Escape key closes any open modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(m => {
                if (m.style.display === 'block') closeModal(m);
            });
        }
    });
});

