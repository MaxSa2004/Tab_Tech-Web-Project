// generic functions: postJSON, getJSON
// specific functions: register, join, leave, roll, pass, notify, update, ranking

const Network = (function () {
    const BASE = 'http://twserver.alunos.dcc.fc.up.pt:8008';

    // generic functions POST, GET
    async function postJSON(path, bodyObj){
        const resp = await fetch(BASE + path, {
            method: 'POST',
            headers: {'Content-Type':'application/json', 'Accept':'application/json'},
            body: JSON.stringify(bodyObj)
        });
        if(!resp.ok){
            const txt = await resp.text();
            throw new Error(`HTTP ${resp.status}: ${txt}`);
        }
        const ct = resp.headers.get('content-type') || '';
        return ct.includes('application/json') ? resp.json() : null;
    }
    
    // caso necessário (provavelmente não será usado)
    async function getJSON(path){
        const resp = await fetch(BASE + path, {
            method: 'GET',
            headers: {'Accept': 'application/json'}
        });
        if(!resp.ok){
            const txt = await resp.text();
            throw new Error(`HTTP ${resp.status}: ${txt}`);
        }
        return resp.json();
    }

    // specific functions

    // register, args : nick & password
    async function register({nick, password}){
        if(!nick || password == null) throw new Error('register: argumentos obrigatórios (nick, password)');
        return postJSON('/register', {nick, password});
    }

    // join, args: group, nick, password & size
    async function join({group, nick, password, size}){
        if(group == null || !nick || password == null ||size == null ) throw new Error('join: argumentos obrigatórios (group, nick, password, size)');
        const body = {group, nick, password, size};
        return postJSON('/join', body);
    }

    // leave, args: nick, password, game
    async function leave({nick, password, game}){
        if(!nick || password == null || game == null) throw new Error('leave: argumentos obrigatórios (nick, password, game)');
        return postJSON('/leave', {nick, password, game});
    }

    // roll, args: nick, password, game
    async function roll({nick, password, game}){
        if(!nick || password == null || game == null) throw new Error('roll: argumentos obrigatórios (nick, password, game)');
        return postJSON('/roll', {nick, password, game});
    }


    // pass, args: nick, password, game, cell
    async function pass({nick, password, game}){
        if(!nick || password == null || game == null) throw new Error('pass: argumentos obrigatórios (nick, password, game)');
        return postJSON('/pass', {nick, password, game});
    }

    // notify, args: nick, password, game, cell
    async function notify({nick, password, game, cell}){
        if(!nick || password == null || game == null || cell ==  null) throw new Error('notify: argumentos obrigatórios (nick, password, game, cell)');
        return postJSON('/notify', {nick, password, game, cell});
    }


    // update: SSE, Server-Sent Event, (EventSource) — deve ser GET com params urlencoded.
    // Retorna o EventSource para que o script principal o possa gerir (onmessage, onerror, close).
    function createUpdateEventSource({ nick, game }) {
        if (!nick) throw new Error('update SSE: argumentos obrigatórios (nick)');
        const params = {nick};
        if(game!=null && game!=='') params.game = game;
        const qs = new URLSearchParams(params);
        const url = BASE + '/update?' + qs.toString();
        // EventSource abre ligação GET persistente e recebe eventos do servidor.
        return new EventSource(url);
    }

    // ranking, args: group, size
    async function ranking({group, size}){
        if(group == null || size == null) throw new Error('ranking: argumentos obrigatórios (group, size)');
        return postJSON('/ranking', {group, size});
    }

    return {
        postJSON,
        getJSON,
        register, 
        join,
        leave, 
        roll,
        pass,
        notify,
        createUpdateEventSource,
        ranking
    };

    
})();