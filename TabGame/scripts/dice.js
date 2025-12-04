// Dice overlay, local spawn/launch, and remote roll display.

window.Dice = (function () {
    let S, Msg;
  
    const upCountProbs = [0.06, 0.25, 0.38, 0.25, 0.06];
  
    function init(GameState, Messages) { S = GameState; Msg = Messages; }
  
    function sampleFromDistribution(probs) {
      const r = Math.random();
      let c = 0;
      for (let i = 0; i < probs.length; i++) { c += probs[i]; if (r <= c) return i; }
      return probs.length - 1;
    }
  
    function createDicePouch(autoDrop = false) {
      const prev = document.body.querySelector('.dice-overlay');
      if (prev) prev.remove();
      const overlay = document.createElement('div');
      overlay.className = 'dice-overlay';
      const arena = document.createElement('div');
      arena.className = 'dice-arena';
      overlay.appendChild(arena);
      const hint = document.createElement('div');
      hint.style.position = 'absolute';
      hint.style.bottom = '12px';
      hint.style.left = '14px';
      hint.style.fontSize = '13px';
      hint.style.color = '#333';
      hint.style.opacity = '0.8';
      hint.dataset.i18nKey = 'dice_auto_hint';
      hint.textContent = Messages.t('dice_auto_hint');
      arena.appendChild(hint);
      const pouch = document.createElement('div');
      pouch.className = 'dice-pouch';
      arena.appendChild(pouch);
  
      for (let i = 0; i < 4; i++) {
        const s = document.createElement('div');
        s.className = 'dice-stick initial';
        s.dataset.index = i;
        s.style.left = "50%";
        s.style.top = "50%";
        const randZ = (Math.random() * 8 - 4);
        s.style.transform = `translate(-50%,-50%) rotateX(-90deg) rotateZ(${randZ}deg)`;
        s.style.transformOrigin = '50% 85%';
        const faceUp = document.createElement('div');
        faceUp.className = 'face dice-face-up';
        faceUp.dataset.i18nKey = 'dice_face_up';
        faceUp.textContent = Messages.t('dice_face_up');
        const faceDown = document.createElement('div');
        faceDown.className = 'face dice-face-down';
        faceDown.dataset.i18nKey = 'dice_face_down';
        faceDown.textContent = Messages.t('dice_face_down');
        s.appendChild(faceUp);
        s.appendChild(faceDown);
        pouch.appendChild(s);
      }
      document.body.appendChild(overlay);
      if (S.elements.throwBtn) S.elements.throwBtn.disabled = true;
      if (autoDrop) setTimeout(() => dropDiceSticks(pouch, arena, overlay), 120);
    }
  
    function dropDiceSticks(pouch, arena, overlay, forcedValue = null) {
      const sticks = Array.from(pouch.querySelectorAll('.dice-stick'));
      const indices = [0, 1, 2, 3];
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      let chosenUpCount = forcedValue != null ? (forcedValue === 6 ? 0 : forcedValue) : sampleFromDistribution(upCountProbs);
      const results = new Array(4).fill(false);
      for (let k = 0; k < chosenUpCount; k++) results[indices[k]] = true;
  
      const maxWide = Math.min(window.innerWidth, 900);
      const gapPx = Math.max(54, Math.round(maxWide * 0.08));
      sticks.forEach((s, i) => {
        s.classList.remove('initial'); void s.offsetWidth; s.classList.add('fallen');
        const posIndex = i - 1.5;
        const offsetX = Math.round(posIndex * gapPx);
        const offsetY = Math.round(6 + (Math.random() * 6 - 3));
        const isUp = results[i];
        const rotX = isUp ? 0 : 180;
        const rotZ = (Math.random() * 6 - 3);
        s.style.left = `calc(50% + ${offsetX}px)`;
        s.style.top = `calc(50% + ${offsetY}px)`;
        s.style.transform = `translate(-50%,-50%) rotateX(${rotX}deg) rotateZ(${rotZ}deg)`;
        s.style.transitionDelay = `${i * 80}ms`;
      });
  
      const totalAnim = 700 + (sticks.length - 1) * 80;
      setTimeout(() => {
        const actualUp = results.reduce((a, b) => a + (b ? 1 : 0), 0);
        const gameValue = (actualUp === 0) ? 6 : actualUp;
        S.lastDiceValue = gameValue;
        showDiceResult(gameValue, actualUp, overlay);
        if (window.tabGame && typeof window.tabGame._resolveResult === 'function') {
          try { window.tabGame._resolveResult(gameValue); } catch {}
          window.tabGame._resolveResult = null;
        }
      }, totalAnim + 40);
    }
  
    function showDiceResult(gameValue, upCount, overlay) {
      const prevBubble = overlay.querySelector('.dice-result-bubble');
      if (prevBubble) prevBubble.remove();
      const bubble = document.createElement('div');
      bubble.className = 'dice-result-bubble';
      const big = document.createElement('div'); big.className = 'big'; big.textContent = String(gameValue);
      const label = document.createElement('div'); label.className = 'label';
      label.dataset.i18nKey = 'dice_label'; label.dataset.diceUp = String(upCount);
      const diceName = Messages.t(`dice_name_${upCount}`);
      label.dataset.i18nParams = JSON.stringify({ name: diceName, up: upCount });
      label.textContent = Messages.t('dice_label', { name: diceName, up: upCount });
      const countdown = document.createElement('div'); countdown.className = 'dice-countdown';
      let secs = 1; countdown.dataset.i18nKey = 'dice_countdown'; countdown.dataset.secs = String(secs);
      countdown.textContent = Messages.t('dice_countdown', { secs });
      bubble.appendChild(big); bubble.appendChild(label); bubble.appendChild(countdown);
      overlay.appendChild(bubble);
      setTimeout(() => bubble.classList.add('show'), 20);
      const intervalId = setInterval(() => {
        secs -= 1;
        if (secs > 0) {
          countdown.dataset.i18nKey = 'dice_countdown';
          countdown.dataset.secs = String(secs);
          countdown.textContent = Messages.t('dice_countdown', { secs });
        } else {
          countdown.dataset.i18nKey = 'dice_closing';
          delete countdown.dataset.secs;
          countdown.textContent = Messages.t('dice_closing');
          clearInterval(intervalId);
        }
      }, 1000);
      overlay._countdownInterval = intervalId;
      overlay._autoCloseTimer = setTimeout(() => {
        if (overlay._countdownInterval) { clearInterval(overlay._countdownInterval); overlay._countdownInterval = null; }
        const ov = document.body.querySelector('.dice-overlay');
        if (ov) ov.remove();
      }, 1000);
    }
  
    function spawnAndLaunch() {
      return new Promise((resolve) => {
        const prev = document.body.querySelector('.dice-overlay');
        if (prev) {
          try {
            if (prev._countdownInterval) { clearInterval(prev._countdownInterval); prev._countdownInterval = null; }
            if (prev._autoCloseTimer) { clearTimeout(prev._autoCloseTimer); prev._autoCloseTimer = null; }
          } catch {}
          prev.remove();
        }
        window.tabGame = window.tabGame || {};
        window.tabGame._resolveResult = resolve;
        createDicePouch(true);
      });
    }
  
    function showRemoteRoll(value) {
      return new Promise((resolve) => {
        const prev = document.body.querySelector('.dice-overlay');
        if (prev) prev.remove();
        window.tabGame = window.tabGame || {};
        window.tabGame._resolveResult = resolve;
        createDicePouch(false);
        const overlay = document.body.querySelector('.dice-overlay');
        const arena = overlay.querySelector('.dice-arena');
        const pouch = overlay.querySelector('.dice-pouch');
        setTimeout(() => { dropDiceSticks(pouch, arena, overlay, value); }, 100);
        S.lastDiceValue = value;
      });
    }
  
    return { init, spawnAndLaunch, showRemoteRoll };
  })();