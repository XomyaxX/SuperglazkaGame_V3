/* ═══════════════════════════════════════════════════════════
   TRACKER GAME — Следи за шариком (тренажёр для глаз)
   ═══════════════════════════════════════════════════════════ */
const TrackerGame = (function() {
  'use strict';

  let canvas, ctx;
  let phase = 0;
  let PHASE_COUNT = 4;
  let PHASE_DURATION = 8000;
  let PAUSE_DURATION = 1500;
  let SPEED_FACTOR = 4;
  let RADIUS = 0.35;
  let PATTERNS = ['updown','leftright','cw','ccw'];
  let TRAIL_OPACITY = 0.15;
  let SHOW_HINT = true;
  let diffConfig = null;
  let state = 'idle'; // idle | phase | pause | won
  let phaseTime = 0;
  let pauseTime = 0;
  let raf;
  let lastTime = 0;
  let ballX = 0, ballY = 0;

  const HINTS = [
    function getTrackerHint(idx) {
    var hints = [
      window.I18n ? I18n.t('games.tracker.hintUpDown') : 'Следи за шариком вверх и вниз 👆👇',
      window.I18n ? I18n.t('games.tracker.hintLeftRight') : 'Следи за шариком влево и вправо 👈👉',
      window.I18n ? I18n.t('games.tracker.hintClockwise') : 'Следи за шариком по кругу по часовой стрелке ⭕',
      window.I18n ? I18n.t('games.tracker.hintCounterClockwise') : 'Следи за шариком против часовой стрелки 🔄'
    ];
    return hints[idx] || (window.I18n ? I18n.t('games.tracker.getReady') : 'Готовься...');
  }
  ];

  function getEl(id) { return document.getElementById(id); }

  function init() {
    canvas = getEl('tracker-canvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    return true;
  }

  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = Math.floor(rect.width);
    canvas.height = Math.floor(rect.height);
  }

  function startGame() {
    if (!canvas) init();
    // Load progressive difficulty
    try {
      if (typeof GameDifficulty !== 'undefined') {
        diffConfig = GameDifficulty.getConfig('tracker');
      }
    } catch (e) {
      console.warn('[Tracker] GameDifficulty error, using defaults', e);
      diffConfig = null;
    }
    var cfg = diffConfig || {};
    PHASE_COUNT = cfg.phaseCount || 4;
    PHASE_DURATION = cfg.phaseDuration || 8000;
    PAUSE_DURATION = cfg.pauseDuration || 1500;
    SPEED_FACTOR = cfg.speedFactor || 4;
    RADIUS = cfg.radius || 0.35;
    PATTERNS = cfg.patterns || ['updown','leftright','cw','ccw'];
    TRAIL_OPACITY = cfg.trailOpacity || 0.15;
    SHOW_HINT = cfg.showHint !== false;
    document.getElementById('game-overlay-tracker').classList.add('visible');
    setTimeout(() => {
      phase = 0;
      state = 'pause';
      pauseTime = 0;
      phaseTime = 0;
      lastTime = performance.now();
      updateUI();
      raf = requestAnimationFrame(loop);
    }, 50);
  }

  function startPhase() {
    state = 'phase';
    phaseTime = 0;
    updateUI();
  }

  function nextPhase() {
    if (phase < (PATTERNS.length || PHASE_COUNT) - 1) {
      phase++;
      state = 'pause';
      pauseTime = 0;
      updateUI();
    } else {
      winGame();
    }
  }

  function updateUI() {
    const phaseEl = getEl('tracker-phase');
    const hintEl = getEl('tracker-hint');
    const diffEl = getEl('tracker-difficulty');
    var totalPhases = PATTERNS.length || PHASE_COUNT;
    if (phaseEl) phaseEl.textContent = (phase + 1) + '/' + totalPhases;
    if (diffEl) diffEl.textContent = (diffConfig && diffConfig.level) ? diffConfig.level : 1;
    if (hintEl && SHOW_HINT) {
      if (state === 'pause') hintEl.textContent = getTrackerHint(phase);
      else if (state === 'phase') hintEl.textContent = window.I18n ? I18n.t('games.tracker.hint') : 'Следи глазами за шариком 👀';
    } else if (hintEl) {
      hintEl.textContent = '';
    }
    const progressEl = getEl('tracker-progress');
    if (progressEl) {
      const totalProgress = ((phase + (state === 'phase' ? phaseTime / PHASE_DURATION : 0)) / totalPhases) * 100;
      progressEl.style.width = totalProgress + '%';
    }
  }

  function loop(now) {
    if (!document.getElementById('game-overlay-tracker').classList.contains('visible')) return;
    const dt = now - lastTime;
    lastTime = now;

    update(dt);
    draw();

    raf = requestAnimationFrame(loop);
  }

  function update(dt) {
    if (state === 'pause') {
      pauseTime += dt;
      if (pauseTime >= PAUSE_DURATION) {
        startPhase();
      }
    } else if (state === 'phase') {
      phaseTime += dt;
      if (phaseTime >= PHASE_DURATION) {
        nextPhase();
      }
    }
    updateUI();
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const t = state === 'phase' ? phaseTime / PHASE_DURATION : 0;

    // Calculate ball position based on phase pattern
    if (state === 'phase') {
      var radius = Math.min(w, h) * RADIUS;
      var pattern = PATTERNS[phase] || 'updown';
      var speed = t * Math.PI * SPEED_FACTOR;
      if (pattern === 'updown') {
        ballX = cx;
        ballY = cy + Math.sin(speed) * radius;
      } else if (pattern === 'leftright') {
        ballX = cx + Math.sin(speed) * radius;
        ballY = cy;
      } else if (pattern === 'cw') {
        var angle = speed;
        ballX = cx + Math.cos(angle) * radius;
        ballY = cy + Math.sin(angle) * radius;
      } else if (pattern === 'ccw') {
        var angle = -speed;
        ballX = cx + Math.cos(angle) * radius;
        ballY = cy + Math.sin(angle) * radius;
      } else if (pattern === 'figure8') {
        ballX = cx + Math.sin(speed) * radius;
        ballY = cy + Math.sin(speed * 2) * radius * 0.5;
      } else if (pattern === 'zigzag') {
        var saw = (speed / Math.PI) % 2;
        if (saw > 1) saw = 2 - saw;
        ballX = cx + (saw * 2 - 1) * radius;
        ballY = cy + Math.sin(speed * 2) * radius * 0.3;
      } else if (pattern === 'spiral') {
        var spiralR = radius * (0.2 + 0.8 * ((t % 1) || 0));
        var angle = speed * 2;
        ballX = cx + Math.cos(angle) * spiralR;
        ballY = cy + Math.sin(angle) * spiralR;
      } else if (pattern === 'random') {
        var seed = Math.floor(t * 10);
        ballX = cx + Math.sin(seed * 1.7) * radius;
        ballY = cy + Math.cos(seed * 2.3) * radius;
      }
    }

    // Draw trail (ghost circles)
    if (state === 'phase') {
      var radius = Math.min(w, h) * RADIUS;
      var pattern = PATTERNS[phase] || 'updown';
      for (let i = 1; i <= 6; i++) {
        const trailT = Math.max(0, phaseTime / PHASE_DURATION - i * 0.03);
        let tx, ty;
        var trailSpeed = trailT * Math.PI * SPEED_FACTOR;
        if (pattern === 'updown') { tx = cx; ty = cy + Math.sin(trailSpeed) * radius; }
        else if (pattern === 'leftright') { tx = cx + Math.sin(trailSpeed) * radius; ty = cy; }
        else if (pattern === 'cw') { var a = trailSpeed; tx = cx + Math.cos(a) * radius; ty = cy + Math.sin(a) * radius; }
        else if (pattern === 'ccw') { var a = -trailSpeed; tx = cx + Math.cos(a) * radius; ty = cy + Math.sin(a) * radius; }
        else if (pattern === 'figure8') { tx = cx + Math.sin(trailSpeed) * radius; ty = cy + Math.sin(trailSpeed * 2) * radius * 0.5; }
        else if (pattern === 'zigzag') { var saw = (trailSpeed / Math.PI) % 2; if (saw > 1) saw = 2 - saw; tx = cx + (saw * 2 - 1) * radius; ty = cy + Math.sin(trailSpeed * 2) * radius * 0.3; }
        else if (pattern === 'spiral') { var spiralR = radius * (0.2 + 0.8 * ((trailT % 1) || 0)); var a = trailSpeed * 2; tx = cx + Math.cos(a) * spiralR; ty = cy + Math.sin(a) * spiralR; }
        else if (pattern === 'random') { var seed = Math.floor(trailT * 10); tx = cx + Math.sin(seed * 1.7) * radius; ty = cy + Math.cos(seed * 2.3) * radius; }

        ctx.beginPath();
        ctx.arc(tx, ty, 8 - i, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168, 85, 247, ${TRAIL_OPACITY - i * 0.02})`;
        ctx.fill();
      }
    }

    // Draw ball
    ctx.beginPath();
    ctx.arc(ballX, ballY, 14, 0, Math.PI * 2);
    const ballGrad = ctx.createRadialGradient(ballX - 4, ballY - 4, 2, ballX, ballY, 14);
    ballGrad.addColorStop(0, '#a5f3fc');
    ballGrad.addColorStop(0.5, '#06b6d4');
    ballGrad.addColorStop(1, '#7c3aed');
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Glow
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Inner highlight
    ctx.beginPath();
    ctx.arc(ballX - 4, ballY - 4, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fill();
  }

  function winGame() {
    state = 'won';
    cancelAnimationFrame(raf);
    document.getElementById('game-overlay-tracker').classList.remove('visible');
    document.getElementById('tracker-win-overlay').classList.add('visible');
    if (typeof PlayerProfile !== 'undefined') {
      PlayerProfile.addCoins(100);
      PlayerProfile.completeGame('tracker', 100);
    }
    if (typeof GameDifficulty !== 'undefined') {
      GameDifficulty.increaseLevel('tracker');
    }
  }

  function closeGame() {
    cancelAnimationFrame(raf);
    document.getElementById('game-overlay-tracker').classList.remove('visible');
    document.getElementById('tracker-win-overlay').classList.remove('visible');
  }

  return { startGame, closeGame };
})();

/* ─── GLOBAL API FOR app.js ─── */
window.startTrackerGame = function() {
  console.log('[Tracker] startTrackerGame called');
  TrackerGame.startGame();
};

window.closeTracker = function(skip) {
  TrackerGame.closeGame();
  if (skip && typeof App !== 'undefined') {
    setTimeout(() => App.advanceFromGame(), 300);
  }
};

window.closeTrackerContinue = function() {
  document.getElementById('tracker-win-overlay').classList.remove('visible');
  setTimeout(() => {
    if (typeof App !== 'undefined') App.advanceFromGame();
  }, 300);
};
