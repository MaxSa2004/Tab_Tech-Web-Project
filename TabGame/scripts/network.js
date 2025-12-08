/* Network module for TWServer API (group 36) */
(() => {
    const BASE_URL = 'http://twserver.alunos.dcc.fc.up.pt:8008';
    // const BASE_URL = 'http://localhost:8136/';     local server link for testing
    const GROUP = 36;
  
    async function _post(path, body) {
      const res = await fetch(`${BASE_URL}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      let data = null;
      try { data = await res.json(); } catch { /* some endpoints can return empty body */ }
      if (!res.ok) {
        const errMsg = (data && data.error) ? data.error : `HTTP ${res.status}`;
        throw new Error(errMsg);
      }
      if (data && data.error) throw new Error(data.error);
      return data;
    }
  
    function createUpdateEventSource({ nick, game }) {
      const url = new URL(`${BASE_URL}/update`);
      url.searchParams.set('nick', nick);
      url.searchParams.set('game', game);
      const es = new EventSource(url.toString());
      return es;
    }
  
    async function register({ nick, password }) {
      return _post('register', { nick, password });
    }
  
    async function join({ nick, password, size }) {
      return _post('join', { group: GROUP, nick, password, size });
    }
  
    async function leave({ nick, password, game }) {
      return _post('leave', { nick, password, game });
    }
  
    async function roll({ nick, password, game }) {
      return _post('roll', { nick, password, game });
    }
  
    // move: { cell: number, step: "from"|"to"|"take" }
    async function notify({ nick, password, game, move }) {
      return _post('notify', { nick, password, game, move });
    }
  
    async function pass({ nick, password, game }) {
      return _post('pass', { nick, password, game });
    }
  
    // Try GET first (typical for this server), fallback to POST if needed
    async function ranking({ size }) {
      const url = new URL(`${BASE_URL}/ranking`);
      url.searchParams.set('group', GROUP);
      url.searchParams.set('size', size);
      try {
        const res = await fetch(url.toString(), { method: 'GET' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (data?.error) throw new Error(data.error);
        return data;
      } catch {
        // fallback as POST (in case server expects POST)
        return _post('ranking', { group: GROUP, size });
      }
    }
  
    window.Network = Object.assign(window.Network || {}, {
      BASE_URL,
      GROUP,
      register,
      join,
      leave,
      roll,
      notify,
      pass,
      ranking,
      createUpdateEventSource,
    });
  })();