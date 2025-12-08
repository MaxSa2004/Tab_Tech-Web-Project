/* Network module for TWServer API (group 36) */
(() => {
  const BASE_URL = 'http://twserver.alunos.dcc.fc.up.pt:8008';
  // const BASE_URL = 'http://localhost:8136/';     local server link for testing
  const GROUP = 36;
  // internal state
  let currentState = {
    game: null,
    nick: null,
    password: null,
    eventSource: null
  }
  // internal POST helper
  async function post(path, body) {
    try {
      const res = await fetch(`${BASE_URL}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data && data.error ? data.error : `HTTP ${res.status}`;
        throw new Error(errMsg);
      }
      return data;
    } catch (error) {
      console.error('Network error:', error);
      throw error;
    }

  }
  // EventSource for updates
  function createUpdateEventSource(msg) {
    stopUpdateEventSource();
    const { game, nick } = currentState;
    if (!game || !nick) return;
    const url = `${BASE_URL}/update?game=${encodeURIComponent(game)}&nick=${encodeURIComponent(nick)}`;
    currentState.eventSource = new EventSource(url);
    currentState.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data); // parse JSON data to use in the payload handler in gameScript 
      if (msg) {
        msg(data);
      }
    }
    currentState.eventSource.onerror = (err) => {
      console.log('EventSource error:', err);
    };

  }
  // stop EventSource
  function stopUpdateEventSource() {
    if (currentState.eventSource) {
      currentState.eventSource.close();
      currentState.eventSource = null;
    }
  }
  // get current state
  function getCurrentState() {
    return { ...currentState };
  }

  // register
  async function register({ nick, password }) {
    // check if input is omitted
    if (!nick || !password) {
      throw new Error('Nick and password are required');
    }
    // to convert to string (because the server requests it)
    const cleanNick = String(nick);
    const cleanPassword = String(password);
    // to check if it's empty
    if (cleanNick.trim() === '' || cleanPassword.trim() === '') {
      throw new Error('Nick and password cannot be empty');
    }
    return post('register', { nick: cleanNick, password: cleanPassword });
  }
  // join
  async function join({ group = GROUP, nick, password, size }) { // o enunciado gera um gameID automaticamente
    if (!nick || !password || !group || !size) {
      throw new Error('Parameters are required');
    }
    const data = await post('join', { group, nick, password, size });
    currentState.nick = nick;
    currentState.password = password;
    currentState.game = data.game;
    return data;
  }
  // leave
  async function leave() {
    const { nick, password, game } = currentState;
    if (!currentState.nick || !currentState.password || !currentState.game) throw new Error("Parameters are required");
    if (!currentState.game) return;
    stopUpdateEventSource();
    try {
      await post('leave', { nick, password, game });
    } finally {
      currentState.game = null;
    }
  }
  // roll
  async function roll() {
    const { nick, password, game } = currentState;
    if (!currentState.nick || !currentState.password || !currentState.game) throw new Error("Parameters are required");
    return post('roll', { nick, password, game });
  }
  // notify
  async function notify({ cell }) {
    const { nick, password, game } = currentState;
    if (!currentState.nick || !currentState.password || !currentState.game || cell === undefined) throw new Error("Parameters are required");
    const cellValue = (typeof cell === 'object' && cell.cell !== undefined) ? cell.cell : cell;
    return post('notify', { nick, password, game, cell: cellValue });
  }
  // pass
  async function pass() {
    if (!currentState.nick || !currentState.password || !currentState.game) throw new Error("Parameters are required");
    const { nick, password, game } = currentState;
    return post('pass', { nick, password, game });
  }

  // ranking
  async function ranking({ group = GROUP, size }) {
    if (!group || !size) throw new Error("Parameters are required");
    return post('ranking', { group, size });
  }

  window.Network = {
    createUpdateEventSource,
    stopUpdateEventSource,
    getCurrentState,
    register,
    join,
    leave,
    roll,
    notify,
    pass,
    ranking
  };

})();


