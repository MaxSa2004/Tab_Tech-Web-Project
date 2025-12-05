document.addEventListener('DOMContentLoaded', () => {
    // modal references
    const btnInstructions = document.getElementById('myBtnInstructions');
    const btnClassifications = document.getElementById('myBtnClassifications');
    const btnExtra = document.getElementById('myBtnExtra');
    const modalInstructions = document.getElementById('myModalInstructions');
    const modalClassifications = document.getElementById('myModalClassifications');
    const modalExtra = document.getElementById('myModalExtra');
    const btn = document.getElementById("myBtnServer");
    const dropdown = document.getElementById("serverDropdown");
    const optTeacher = document.getElementById("optTeacher");
    const optPersonal = document.getElementById("optPersonal");
    // function to open modal
    function openModal(modal, opener) {
        if (!modal) return;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        modal._opener = opener || null;
        document.body.classList.add('modal-open');

        // focus the first focusable element in the modal (element that receives keyboard input, in this case a button)
        const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusable) focusable.focus();
    }
    // function to close modal
    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        if (modal._opener && typeof modal._opener.focus === 'function') modal._opener.focus(); // return focus to opener
    }


    // Attach modal openers: buttons (if clicked open the respective modal)
    if (btnInstructions) btnInstructions.addEventListener('click', (e) => { e.preventDefault(); openModal(modalInstructions, btnInstructions); });
    if (btnClassifications) {
        btnClassifications.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(modalClassifications, btnClassifications);
            window.__refreshLeaderBoard();
        });
    }
    if (btnExtra) btnExtra.addEventListener('click', (e) => { e.preventDefault(); openModal(modalExtra, btnExtra); });

    // close buttons (.close) 
    document.querySelectorAll('.modal .close').forEach(closeBtn => {
        closeBtn.addEventListener('click', () => {
            const modal = closeBtn.closest('.modal');
            closeModal(modal);
        });
    });

    // overlay click closes when clicking the outer modal container (if clicked outside the modal content, close the modal)
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
    

    // 1. Function to update the UI and save to LocalStorage
    function setServerPreference(type) {
        // Reset visual classes
        if (optTeacher) optTeacher.classList.remove("selected");
        if (optPersonal) optPersonal.classList.remove("selected");

        // Apply visual class to the chosen one
        if (type === "personal") {
            if (optPersonal) optPersonal.classList.add("selected");
            
        } else {
            
            if (optTeacher) optTeacher.classList.add("selected");
            
        }

        // SAVE to browser memory
        localStorage.setItem("tab_server_choice", type);
        console.log("Server set to:", type);
    }

    // 2. Initialize on Page Load
    const savedChoice = localStorage.getItem("tab_server_choice");
    if (savedChoice) {
        setServerPreference(savedChoice);
    } else {
        // Default setting if nothing is saved
        setServerPreference("teacher");
    }

    // 3. Dropdown Toggle Logic
    if (btn && dropdown) {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("show");
        });

        window.addEventListener("click", (e) => {
            if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.classList.remove("show");
            }
        });

        // 4. Click Handlers for Options
        if (optTeacher) {
            optTeacher.addEventListener("click", (e) => {
                e.preventDefault();
                setServerPreference("teacher");
                dropdown.classList.remove("show");
            });
        }

        if (optPersonal) {
            optPersonal.addEventListener("click", (e) => {
                e.preventDefault();
                setServerPreference("personal");
                dropdown.classList.remove("show");
                
            });
        }
    }
});

