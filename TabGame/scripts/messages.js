// i18n and chat bubbles

window.Messages = (function () {
    let S;
  
    function init(GameState) { S = GameState; }
  
    function t(key, params = {}) {
      const lang = window.currentLang || 'pt';
      const root = (typeof i18n !== 'undefined' ? i18n : window.i18n) || {};
      const dict = root[lang] || {};
      let str = dict[key] ?? root.en?.[key] ?? root.pt?.[key] ?? key;
      return String(str).replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '');
    }
  
    function system(key, params) {
      showMessage({ who: 'system', key, params });
    }
  
    function player(playerNum, key, params) {
      showMessage({ who: 'player', player: playerNum, key, params });
    }
  
    function showMessage({ who = 'system', player = null, text, key, params }) {
      const messagesEl = S.elements.messagesEl;
      const wrap = document.createElement('div');
      wrap.className = 'message';
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
  
      if (key) {
        bubble.dataset.i18nKey = key;
        if (params && Object.keys(params).length) bubble.dataset.i18nParams = JSON.stringify(params);
        bubble.textContent = t(key, params || {});
      } else {
        bubble.textContent = text ?? '';
      }
  
      if (who === 'system') {
        wrap.classList.add('msg-server');
        wrap.appendChild(bubble);
      } else {
        wrap.classList.add(player === 1 ? 'msg-player1' : 'msg-player2');
        const avatar = document.createElement('div');
        avatar.className = 'avatar';
        avatar.textContent = 'P' + player;
        const stack = document.createElement('div');
        stack.appendChild(bubble);
        wrap.appendChild(avatar);
        wrap.appendChild(stack);
      }
      messagesEl.appendChild(wrap);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  
    return { init, t, system, player };
  })();