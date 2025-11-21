document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const userBox = document.getElementById('userInfo');
    const userNameText = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');
    const nick = document.getElementById('nick').value.trim();
    const password = document.getElementById('pass').value;

    // safety if elements aren't found
    if (!form || !loginBtn || !userBox || !userNameText || !logoutBtn) return;
    // login action (just flipping UI and setting username to null)
    loginBtn.addEventListener('submit', async (e) => {
        e.preventDefault(); // evita reload da página
        if (!nick) {
            alert('Por favor introduza um nome de utilizador.');
            return;
        }
        try {
            if(loginBtn) loginBtn.disabled = true;
            const res = await Network.register({ nick, password });
            console.log("Autenticação bem sucedida: ", res);
            form.hidden = true;
            userBox.hidden = false;
        } catch (err){
            console.error('Erro no login: ', err);
            alert('Erro no login: ' + (err.message || err));
        } finally {
            if(loginBtn) loginBtn.disabled = false;
        }

    });

    async function logout(confirmLogout = true){
        const nick = sessionStorage.getItem('nick');
        const password = sessionStorage.getItem('pass');
        if(logoutBtn) logoutBtn.disabled = true;

        try {
            if(window.updateEventSource){
                try {
                    window.updateEventSource.close();
                } catch (e){
                    // ignore
                }
            }
            if(window.updatePollHandle){
                clearInterval(window.updatePollHandle);
                window.updatePollHandle = null;
            }
        } catch (e) {
            console.warn("Erro ao fechar atualizações: ", e);
        }

        sessionStorage.removeItem('nick');
        sessionStorage.removeItem('pass');
        
        if(form) form.hidden = false;
        if(userBox) userBox.hidden = true;
        if(userNameText) userNameText.content = '';

        // clear board and maybe quit game

        if(logoutBtn) logoutBtn.disabled = false;
        alert('Sessão terminada.');
    }

    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => logout(true))
    }

});