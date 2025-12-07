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
        console.warn("authenticationScript: elementos do DOM não encontrados - verifica ids do HTML.");
        return;
    }

    // restore UI from storage (no network calls here)
    const savedNick = sessionStorage.getItem('tt_nick');
    const savedPassword = sessionStorage.getItem('tt_password');
    if (savedNick && savedPassword) {
        form.classList.add('hidden-by-js');
        userBox.classList.remove('hidden-by-js');
        userBox.classList.add('visible-by-js');
        userNameText.textContent = savedNick;
    } else if (savedNick) {
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

    // login action
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
            // Network.register may return null when server sends empty body — that's OK (server used status)
            const res = await Network.register({ nick, password });
            console.log("Autenticação (register) result:", res);

            // persist credentials locally (session)
            try {
                sessionStorage.setItem('tt_nick', nick);
                sessionStorage.setItem('tt_password', password);
            } catch (e) {
                console.warn('Não foi possível escrever dados em sessionStorage:', e);
            }

            // update UI
            userNameText.textContent = nick;
            form.classList.add('hidden-by-js');
            userBox.classList.remove('hidden-by-js');
            userBox.classList.add('visible-by-js');

            // If there is already a game id stored, (re)open SSE so updates arrive immediately.
            // This is optional but makes the UI "connected" right after login if a game was active.
            const storedGame = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game') || window.currentGameId;
            if (storedGame) {
                try {
                    // close previous ES if any
                    if (window.updateEventSource) { try { window.updateEventSource.close(); } catch {} window.updateEventSource = null; }

                    // create new EventSource and wire handlers
                    window.updateEventSource = Network.createUpdateEventSource({ nick, game: storedGame });

                    // prefer an app-level merged handler if present (PVPController or GamePvP)
                    if (window.GamePvP && typeof window.GamePvP.handleUpdateMessageRaw === 'function') {
                        window.updateEventSource.onmessage = window.GamePvP.handleUpdateMessageRaw;
                    } else if (window._handleMergedUpdate && typeof window._handleMergedUpdate === 'function') {
                        window.updateEventSource.onmessage = (e) => {
                            let data;
                            try { data = JSON.parse(e.data); } catch (err) { console.warn('SSE parse error', err); return; }
                            // merge partial into window.__lastSSE (same merge policy used elsewhere)
                            const prev = window.__lastSSE || {};
                            const merged = Object.assign({}, prev, data);
                            if (!data.hasOwnProperty('pieces')) merged.pieces = prev.pieces;
                            if (!data.hasOwnProperty('players')) merged.players = prev.players;
                            if (!data.hasOwnProperty('selected')) merged.selected = prev.selected;
                            if (!data.hasOwnProperty('turn')) merged.turn = prev.turn;
                            if (!data.hasOwnProperty('cell')) merged.cell = prev.cell;
                            window.__lastSSE = merged;
                            window._handleMergedUpdate(merged);
                        };
                    } else {
                        // minimal default handler: store merged SSE and render board if GameUI present
                        window.updateEventSource.onmessage = (e) => {
                            let data;
                            try { data = JSON.parse(e.data); } catch (err) { console.warn('SSE parse error', err); return; }
                            const prev = window.__lastSSE || {};
                            const merged = Object.assign({}, prev, data);
                            if (!data.hasOwnProperty('pieces')) merged.pieces = prev.pieces;
                            if (!data.hasOwnProperty('players')) merged.players = prev.players;
                            if (!data.hasOwnProperty('selected')) merged.selected = prev.selected;
                            if (!data.hasOwnProperty('turn')) merged.turn = prev.turn;
                            if (!data.hasOwnProperty('cell')) merged.cell = prev.cell;
                            window.__lastSSE = merged;
                            if (window.GameUI && Array.isArray(merged.pieces)) {
                                window.GameUI.renderPvPBoard(merged.pieces, merged.selected || [], merged.players || {});
                            }
                        };
                    }

                    window.updateEventSource.onerror = (err) => console.warn('SSE error', err);
                    window.updateEventSource.onopen = () => console.debug('SSE open after login');
                } catch (e) {
                    console.warn('Falha ao criar EventSource após login:', e);
                }
            }

            // update play/leave buttons if UI exposes that
            try { if (window.GameUI && typeof window.GameUI.updatePlayLeaveButtons === 'function') window.GameUI.updatePlayLeaveButtons(); } catch (e) { /* ignore */ }

        } catch (err) {
            console.error('Erro no login: ', err);
            alert('Erro no login: ' + (err.message || err));
        } finally {
            loginBtn.disabled = false;
            // don't clear password field automatically to help user in case of failure
        }
    });

    async function logout() {
        const nick = sessionStorage.getItem('tt_nick') || localStorage.getItem('tt_nick');
        const password = sessionStorage.getItem('tt_password') || localStorage.getItem('tt_password');
        const game = sessionStorage.getItem('tt_game') || localStorage.getItem('tt_game') || window.currentGameId;
        logoutBtn.disabled = true;

        // close SSE if open
        try {
            if (window.updateEventSource) {
                try { window.updateEventSource.close(); } catch (e) { console.warn('Não foi possível fechar updateEventSource:', e); }
                window.updateEventSource = null;
            }
            if (window.updatePollHandle) { clearInterval(window.updatePollHandle); window.updatePollHandle = null; }
        } catch (e) {
            console.warn('Erro ao limpar atualizações do jogo:', e);
        }

        // try to leave game politely (server-side)
        try {
            if (nick && password && game) {
                try { await Network.leave({ nick, password, game }); } catch (e) { /* ignore leave errors */ }
            }
        } catch (e) {
            console.warn('Erro ao notificar leave antes do logout:', e);
        }

        // call app-level leave function if present
        if (typeof window.leaveGame === 'function') {
            try { window.leaveGame({ showStats: false, updaterank: false }); } catch (e) { console.warn('Erro ao sair do jogo:', e); }
        } else {
            const board = document.getElementById('gameBoard');
            if (board) board.innerHTML = '';
            const cap1 = document.getElementById('capturedP1');
            const cap2 = document.getElementById('capturedP2');
            if (cap1) cap1.innerHTML = '';
            if (cap2) cap2.innerHTML = '';
        }

        if (typeof window.clearMessages === 'function') {
            try { window.clearMessages(); } catch (e) { const m = document.getElementById('messages'); if (m) m.innerHTML = ''; }
        }

        if (typeof window.initGame === 'function') {
            try { window.initGame({ initConfig: true }); } catch (e) { console.warn('Erro ao reiniciar o estado do jogo:', e); }
        }

        // clear stored credentials and game id
        try {
            sessionStorage.removeItem('tt_password');
            sessionStorage.removeItem('tt_game');
            sessionStorage.removeItem('tt_nick');
            localStorage.removeItem('tt_password');
            localStorage.removeItem('tt_game');
            localStorage.removeItem('tt_nick');
        } catch (e) {
            console.warn('Não foi possível remover dados de sessionStorage/localStorage:', e);
        }

        try { window.onbeforeunload = null; } catch (e) {}

        // reset UI
        if (form) {
            form.classList.remove('hidden-by-js');
            form.style.removeProperty('display');
        }
        if (userBox) {
            userBox.classList.remove('visible-by-js');
            userBox.classList.add('hidden-by-js');
            userBox.style.removeProperty('display');
        }
        if (inputnick) inputnick.value = '';
        if (inputpassword) inputpassword.value = '';
        if (userNameText) userNameText.textContent = '';

        window.currentGameId = null;
        window.updateEventSource = null;
        window.updatePollHandle = null;
        logoutBtn.disabled = false;
        alert('Sessão terminada.');
    }

    logoutBtn.addEventListener('click', () => logout(true));
});