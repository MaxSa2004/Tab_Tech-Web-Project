document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const userBox = document.getElementById('userInfo');
    const userNameText = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');



    const inputnick = document.getElementById('user');
    const inputpassword = document.getElementById('pass');

    // safety if elements aren't found
    if (!form || !loginBtn || !userBox || !userNameText || !logoutBtn || !inputnick || !inputpassword) {
        console.warn("authenticationScript: elementos do DOM não encontrados - verifica ids do HTML.")
        return;
    }

    const savedNick = sessionStorage.getItem('tt_nick');
    const savedPassword = sessionStorage.getItem('tt_password');
    if (savedNick && savedPassword) {
        form.classList.add('hidden-by-js');
        userBox.classList.remove('hidden-by-js');
        userBox.classList.add('visible-by-js');
        userNameText.textContent = savedNick;
    } else if(savedNick){
        form.classList.remove('hidden-by-js');
        userBox.classList.add('hidden-by-js');
        inputnick.value = savedNick;
        inputpassword.value = '';
        userNameText.textContent = '';
    } else {
        form.classList.remove('hidden-by-js');
        userBox.classList.add('hidden-by-js');
        userNameText.textContent = '';
    }
    // login action (just flipping UI and setting username to null)
    form.addEventListener('submit', async (ev) => {
        ev.preventDefault(); // evita reload da página
        const nick = (inputnick.value || '').trim();
        const password = inputpassword.value || '';
        if (!nick) {
            alert('Por favor introduza um nome de utilizador.');
            return;
        }
        loginBtn.disabled = true;
        try {
            const res = await Network.register({ nick, password });
            console.log("Autenticação bem sucedida: ", res);
            try {
                sessionStorage.setItem('tt_nick', nick);
                sessionStorage.setItem('tt_password', password);
            } catch (e) {
                console.warn('Não foi possível escrever dados em sessionStorage:', e);
            }
            userNameText.textContent = nick;
            form.classList.add('hidden-by-js');
            userBox.classList.remove('hidden-by-js');
            userBox.classList.add('visible-by-js');
        } catch (err) {
            console.error('Erro no login: ', err);
            alert('Erro no login: ' + (err.message || err));
        } finally {
            loginBtn.disabled = false;
        }

    });

    async function logout() {
        const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
        const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
        const game = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game') || window.currentGameId;
        logoutBtn.disabled = true;
        try {
            if(window.updateEventSource){
                try {
                    window.updateEventSource.close();
                } catch(e){
                    console.warn('Não foi possível fechar updateEventSource:', e);
                }
                if(window.updatePollHandle){
                    clearInterval(window.updatePollHandle);
                    window.updatePollHandle = null;
                }
            }
        } catch (e) {
            console.warn('Erro ao limpar atualizações do jogo:', e);
        }
        if(typeof window.leaveGame === 'function'){
            try {
                window.leaveGame({showStats: false, updaterank: false});
            } catch (e) {
                console.warn('Erro ao sair do jogo:', e);
            }
        } else {
            const board = document.getElementById('gameBoard');
            if(board) board.innerHTML = '';
            const cap1 = document.getElementById('capturedP1');
            const cap2 = document.getElementById('capturedP2');
            if(cap1) cap1.innerHTML = '';
            if(cap2) cap2.innerHTML = '';
        }
        if(typeof window.clearMessages === 'function'){
            try {
                window.clearMessages();
            } catch (e) {
                const m = document.getElementById('messages');
                if(m) m.innerHTML = '';
            }
        }
        if(typeof window.initGame === 'function'){
            try {
                window.initGame({initConfig: true});
            } catch (e) {
                console.warn('Erro ao reiniciar o estado do jogo:', e);
            }
        }
        try {
            sessionStorage.removeItem('tt_password');
            sessionStorage.removeItem('tt_game');
            localStorage.removeItem('tt_password');
            localStorage.removeItem('tt_game');
        } catch (e) {
            console.warn('Não foi possível remover dados de sessionStorage/localStorage:', e);
        }

        try { window.onbeforeunload = null; } catch(e){}

        if(form){
            form.classList.remove('hidden-by-js');
            form.style.removeProperty('display');
        }
        
        if(userBox){
            userBox.classList.remove('visible-by-js');
            userBox.classList.add('hidden-by-js');
            userBox.style.removeProperty('display');
        }

        if(inputnick) inputnick.value = nick || '';
        if(inputpassword) inputpassword.value = '';
        userNameText.textContent = '';

        window.currentGameId = null;
        window.updateEventSource = null;
        window.updatePollHandle = null;
        logoutBtn.disabled = false;
        alert('Sessão terminada.');
    }


    logoutBtn.addEventListener('click', () => logout(true))


});