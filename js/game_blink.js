/* ═══════════════════════════════════════════════════════════
   BLINK GAME — Тренажёр для глаз
   ═══════════════════════════════════════════════════════════ */
const BlinkGame = (function() {
  'use strict';

  let canvas, ctx;
  let round = 1;
  let state = 'idle'; // idle | blink | squeeze | wide | won | lost
  let timer = 0;
  let clicks = 0;
  let holdTime = 0;
  let isHolding = false;
  let targetPos = 0; // 0-100 for round 3
  let targetDir = 1;
  let raf;
  let lastTime = 0;
  let roundStartTime = 0;

  let TARGET_CLICKS = 8;
  let ROUND1_TIME = 5000;
  let ROUND2_HOLD = 3000;
  let ROUND3_ZONE = { min: 40, max: 60 };
  let ROUND3_SPEED = 0.06;
  let MAX_ROUNDS = 3;
  let diffConfig = null;

  function getEl(id) { return document.getElementById(id); }

  function init() {
    canvas = getEl('blink-canvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('mousedown', onPointerDown);
    canvas.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('touchend', onPointerUp);

    return true;
  }

  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = Math.floor(rect.width);
    canvas.height = Math.floor(rect.height);
  }

  function onPointerDown(e) {
    e.preventDefault();
    if (state === 'squeeze') {
      isHolding = true;
    } else if (state === 'blink') {
      clicks++;
      triggerBlinkAnim();
      if (clicks >= TARGET_CLICKS) {
        nextRound();
      }
    } else if (state === 'wide') {
      if (targetPos >= ROUND3_ZONE.min && targetPos <= ROUND3_ZONE.max) {
        nextRound();
      } else {
        setHint(window.I18n ? I18n.t('games.blink.miss') : 'Промах! Попробуй ещё раз');
      }
    }
  }

  function onPointerUp(e) {
    e.preventDefault();
    if (state === 'squeeze') {
      isHolding = false;
    }
  }

  function onClick(e) {
    if (state === 'blink') {
      clicks++;
      triggerBlinkAnim();
      if (clicks >= TARGET_CLICKS) {
        nextRound();
      }
    } else if (state === 'wide') {
      if (targetPos >= ROUND3_ZONE.min && targetPos <= ROUND3_ZONE.max) {
        nextRound();
      } else {
        setHint(window.I18n ? I18n.t('games.blink.miss') : 'Промах! Попробуй ещё раз');
      }
    }
  }

  let blinkAnim = 0; // 0 = open, 1 = closed
  let blinkAnimDir = 0;

  function triggerBlinkAnim() {
    blinkAnimDir = 1;
  }

  function startGame() {
    if (!canvas) init();
    // Load progressive difficulty
    try {
      if (typeof GameDifficulty !== 'undefined') {
        diffConfig = GameDifficulty.getConfig('blink');
      }
    } catch (e) {
      console.warn('[Blink] GameDifficulty error, using defaults', e);
      diffConfig = null;
    }
    var cfg = diffConfig || {};
    TARGET_CLICKS = cfg.targetClicks || 8;
    ROUND1_TIME = cfg.round1Time || 5000;
    ROUND2_HOLD = cfg.round2Hold || 3000;
    ROUND3_ZONE = cfg.round3Zone || { min: 40, max: 60 };
    ROUND3_SPEED = cfg.round3Speed || 0.06;
    MAX_ROUNDS = cfg.maxRounds || 3;
    document.getElementById('game-overlay-blink').classList.add('visible');
    setTimeout(() => {
      round = 1;
      startRound();
      lastTime = performance.now();
      raf = requestAnimationFrame(loop);
    }, 50);
  }

  function startRound() {
    if (round <= MAX_ROUNDS) {
      state = round === 1 ? 'blink' : round === 2 ? 'squeeze' : 'wide';
    } else {
      state = 'wide'; // extra rounds default to wide mode
    }
    clicks = 0;
    holdTime = 0;
    isHolding = false;
    targetPos = 0;
    targetDir = 1;
    roundStartTime = performance.now();

    updateUI();
    if (round === 1) setHint((window.I18n ? I18n.t('games.blink.hintRound1') : 'Кликай по экрану, чтобы моргать! ') + TARGET_CLICKS + (window.I18n ? I18n.t('games.blink.timesSuffix') : ' раз!'));
    else if (round === 2) setHint(window.I18n ? I18n.t('games.blink.hintRound2') : 'Зажми кнопку мыши / тапни и держи!');
    else setHint(window.I18n ? I18n.t('games.blink.hintRound3') : 'Кликни, когда шкала в зелёной зоне!');
  }

  function nextRound() {
    if (round < MAX_ROUNDS) {
      round++;
      startRound();
    } else {
      winGame();
    }
  }

  function setHint(text) {
    const el = getEl('blink-hint');
    if (el) el.textContent = text;
  }

  function updateUI() {
    const roundEl = getEl('blink-round');
    const timerEl = getEl('blink-timer');
    const diffEl = getEl('blink-difficulty');
    if (roundEl) roundEl.textContent = round + '/' + MAX_ROUNDS;
    if (timerEl) timerEl.textContent = state === 'blink' ? Math.ceil((ROUND1_TIME - (performance.now() - roundStartTime)) / 1000) : '-';
    if (diffEl) diffEl.textContent = (diffConfig && diffConfig.level) ? diffConfig.level : 1;
  }

  function loop(now) {
    if (!document.getElementById('game-overlay-blink').classList.contains('visible')) return;
    const dt = now - lastTime;
    lastTime = now;

    update(dt, now);
    draw();

    raf = requestAnimationFrame(loop);
  }

  function update(dt, now) {
    // Blink animation
    if (blinkAnimDir !== 0) {
      blinkAnim += blinkAnimDir * dt * 0.008;
      if (blinkAnim >= 1) { blinkAnim = 1; blinkAnimDir = -1; }
      if (blinkAnim <= 0) { blinkAnim = 0; blinkAnimDir = 0; }
    }

    if (state === 'blink') {
      const elapsed = now - roundStartTime;
      if (elapsed >= ROUND1_TIME) {
        if (clicks >= TARGET_CLICKS) nextRound();
        else { setHint(window.I18n ? I18n.t('games.blink.timeUp') : 'Время вышло! Попробуй снова.'); clicks = 0; roundStartTime = now; }
      }
      updateUI();
    } else if (state === 'squeeze') {
      if (isHolding) {
        holdTime += dt;
        if (holdTime >= ROUND2_HOLD) nextRound();
      } else {
        if (holdTime > 0 && holdTime < ROUND2_HOLD) {
          setHint(window.I18n ? I18n.t('games.blink.releaseEarly') : 'Отпустил слишком рано! Начинаем заново.');
          holdTime = 0;
        }
      }
      const progress = Math.min(holdTime / ROUND2_HOLD, 1) * 100;
      const bar = getEl('blink-progress');
      if (bar) bar.style.width = progress + '%';
    } else if (state === 'wide') {
      targetPos += targetDir * dt * ROUND3_SPEED;
      if (targetPos >= 100) { targetPos = 100; targetDir = -1; }
      if (targetPos <= 0) { targetPos = 0; targetDir = 1; }
    }
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;

    // Background glow
    const grad = ctx.createRadialGradient(cx, cy, 20, cx, cy, w * 0.6);
    grad.addColorStop(0, 'rgba(168, 85, 247, 0.08)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Eye draw
    ctx.save();
    ctx.translate(cx, cy);

    const eyeW = w * 0.35;
    const eyeH = h * 0.25;

    if (state === 'squeeze' || (state === 'blink' && blinkAnim > 0.5)) {
      // Closed eye (line)
      ctx.beginPath();
      ctx.moveTo(-eyeW * 0.6, 0);
      ctx.quadraticCurveTo(0, eyeH * 0.15, eyeW * 0.6, 0);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#fff';
      ctx.stroke();

      // Eyelashes
      ctx.beginPath();
      ctx.moveTo(-eyeW * 0.5, -4);
      ctx.lineTo(-eyeW * 0.55, -12);
      ctx.moveTo(0, -2);
      ctx.lineTo(0, -10);
      ctx.moveTo(eyeW * 0.5, -4);
      ctx.lineTo(eyeW * 0.55, -12);
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (state === 'wide') {
      // Wide open
      const wideScale = 1.3;
      drawEye(eyeW * wideScale, eyeH * wideScale, true);
    } else {
      // Normal open
      drawEye(eyeW, eyeH, false);
    }

    ctx.restore();

    // Round 3 target bar
    if (state === 'wide') {
      const barW = w * 0.7;
      const barH = 16;
      const barX = (w - barW) / 2;
      const barY = h - 50;

      // Track
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 8);
      ctx.fill();

      // Green zone
      const zoneX = barX + (barW * ROUND3_ZONE.min / 100);
      const zoneW = barW * (ROUND3_ZONE.max - ROUND3_ZONE.min) / 100;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.5)';
      ctx.beginPath();
      ctx.roundRect(zoneX, barY, zoneW, barH, 8);
      ctx.fill();

      // Marker
      const markerX = barX + (barW * targetPos / 100);
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(markerX, barY + barH / 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawEye(ew, eh, wide) {
    // Sclera
    ctx.beginPath();
    ctx.ellipse(0, 0, ew, eh, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f0e6ff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();

    // Iris
    const irisR = ew * 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, irisR, 0, Math.PI * 2);
    const irisGrad = ctx.createRadialGradient(-irisR * 0.2, -irisR * 0.2, irisR * 0.2, 0, 0, irisR);
    irisGrad.addColorStop(0, '#06b6d4');
    irisGrad.addColorStop(1, '#7c3aed');
    ctx.fillStyle = irisGrad;
    ctx.fill();

    // Pupil
    ctx.beginPath();
    ctx.arc(0, 0, irisR * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0618';
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(-irisR * 0.25, -irisR * 0.25, irisR * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();

    if (wide) {
      // Extra highlight for wide
      ctx.beginPath();
      ctx.arc(irisR * 0.3, irisR * 0.2, irisR * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fill();
    }
  }

  function winGame() {
    state = 'won';
    cancelAnimationFrame(raf);
    document.getElementById('game-overlay-blink').classList.remove('visible');
    document.getElementById('blink-win-overlay').classList.add('visible');
    if (typeof PlayerProfile !== 'undefined') {
      PlayerProfile.addCoins(100);
      PlayerProfile.completeGame('blink', 100);
    }
    if (typeof Haptic !== 'undefined') {
      Haptic.vibrateSuccess();
    }
    var bestBlink = 0;
    if (typeof PlayerProfile !== 'undefined' && PlayerProfile.getProfile) {
      var pb = PlayerProfile.getProfile();
      if (pb && pb.games && pb.games.blink) bestBlink = pb.games.blink.bestScore || 0;
    }
    var bestEl = document.getElementById('blink-best-score');
    if (bestEl) bestEl.textContent = (window.I18n ? I18n.t('games.stats.best') : '🏆 Рекорд: ') + bestBlink;
    if (typeof GameDifficulty !== 'undefined') {
      GameDifficulty.increaseLevel('blink');
    }
  }

  function closeGame() {
    cancelAnimationFrame(raf);
    document.getElementById('game-overlay-blink').classList.remove('visible');
    document.getElementById('blink-win-overlay').classList.remove('visible');
  }

  return { startGame, closeGame };
})();

/* ─── GLOBAL API FOR app.js ─── */
window.startBlinkGame = function() {
  console.log('[Blink] startBlinkGame called');
  BlinkGame.startGame();
};

window.closeBlink = function(skip) {
  BlinkGame.closeGame();
  if (skip && typeof App !== 'undefined') {
    setTimeout(() => App.advanceFromGame(), 300);
  }
};

window.closeBlinkContinue = function() {
  document.getElementById('blink-win-overlay').classList.remove('visible');
  setTimeout(() => {
    if (typeof App !== 'undefined') App.advanceFromGame();
  }, 300);
};
