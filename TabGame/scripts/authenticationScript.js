document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const userBox = document.getElementById('userInfo');
    const userNameText = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');

    const inputnick = document.getElementById('user');
    const inputpassword = document.getElementById('pass');

    // safety checks
    if (!form || !loginBtn || !userBox || !userNameText || !logoutBtn || !inputnick || !inputpassword) {
        console.warn("Authentication elements not found");
        return;
    }

    // 1. Restaurar Sessão (Visual apenas)
    const savedNick = sessionStorage.getItem('tt_nick');
    const savedPassword = sessionStorage.getItem('tt_password');
    
    if (savedNick) {
        updateUI(true, savedNick);
        inputnick.value = savedNick;
        if(savedPassword) inputpassword.value = savedPassword; // Preenche a pass se existir
    } else {
        updateUI(false);
    }

    // 2. Botão Login
    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const nick = (inputnick.value || '').trim();
        const password = inputpassword.value || '';

        if (!nick || !password) {
            alert('Por favor preencha user e password.');
            return;
        }

        loginBtn.disabled = true;

        try {
            // Tenta registar/login no servidor
            // Se der erro (ex: pass errada), o network.js lança exceção e salta para o catch
            await Network.register({ nick, password });
            
            console.log("Login com sucesso no servidor");

            // Guardar na sessão
            sessionStorage.setItem('tt_nick', nick);
            sessionStorage.setItem('tt_password', password);

            // Atualizar interface
            updateUI(true, nick);

        } catch (err) {
            console.error('Erro no login:', err);
            alert('Erro: ' + err.message);
        } finally {
            loginBtn.disabled = false;
        }
    });

    // 3. Botão Logout
    logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;

        try {
            // Tenta avisar o servidor que saímos (o Network.js usa as credenciais internas)
            await Network.leave(); 
        } catch (e) {
            console.warn("Erro ao sair (pode já não estar em jogo):", e);
        }

        // Limpar dados locais
        sessionStorage.clear();
        localStorage.removeItem('tt_nick'); // Caso uses localStorage algures
        
        // Limpar inputs
        inputnick.value = '';
        inputpassword.value = '';
        
        // Reset UI
        updateUI(false);
        
        logoutBtn.disabled = false;
        alert('Sessão terminada.');
    });

    // Função Auxiliar de Interface
    function updateUI(isLoggedIn, nick = '') {
        if (isLoggedIn) {
            form.classList.add('hidden-by-js');
            form.style.display = 'none'; // Forçar escondido
            
            userBox.classList.remove('hidden-by-js');
            userBox.style.display = 'block'; // Forçar visível
            
            userNameText.textContent = nick;
        } else {
            form.classList.remove('hidden-by-js');
            form.style.display = 'block';
            
            userBox.classList.add('hidden-by-js');
            userBox.style.display = 'none';
            
            userNameText.textContent = '';
        }
    }
});