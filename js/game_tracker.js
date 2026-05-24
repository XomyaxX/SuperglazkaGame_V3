/* ═══════════════════════════════════════════════════════════
   TRACKER GAME — Следи за шариком (тренажёр для глаз)
   ═══════════════════════════════════════════════════════════ */
const TrackerGame = (function() {
  'use strict';

  let canvas, ctx;
  let phase = 0; // 0=up-down, 1=left-right, 2=cw, 3=ccw
  const PHASE_COUNT = 4;
  const PHASE_DURATION = 8000;
  const PAUSE_DURATION = 1500;
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
    document.getElementById('game-overlay-tracker').classList.add('visible');
    // Небольшая задержка, чтобы браузер успел выполнить layout
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
    if (phase < PHASE_COUNT - 1) {
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
    if (phaseEl) phaseEl.textContent = (phase + 1) + '/' + PHASE_COUNT;
    if (hintEl) {
      if (state === 'pause') hintEl.textContent = getTrackerHint(phase);
      else if (state === 'phase') hintEl.textContent = window.I18n ? I18n.t('games.tracker.hint') : 'Следи глазами за шариком 👀';
    }
    const progressEl = getEl('tracker-progress');
    if (progressEl) {
      const totalProgress = ((phase + (state === 'phase' ? phaseTime / PHASE_DURATION : 0)) / PHASE_COUNT) * 100;
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

    // Calculate ball position based on phase
    if (state === 'phase') {
      const radius = Math.min(w, h) * 0.35;
      if (phase === 0) {
        // Up-down
        ballX = cx;
        ballY = cy + Math.sin(t * Math.PI * 4) * radius;
      } else if (phase === 1) {
        // Left-right
        ballX = cx + Math.sin(t * Math.PI * 4) * radius;
        ballY = cy;
      } else if (phase === 2) {
        // Clockwise
        const angle = t * Math.PI * 4;
        ballX = cx + Math.cos(angle) * radius;
        ballY = cy + Math.sin(angle) * radius;
      } else if (phase === 3) {
        // Counter-clockwise
        const angle = -t * Math.PI * 4;
        ballX = cx + Math.cos(angle) * radius;
        ballY = cy + Math.sin(angle) * radius;
      }
    }

    // Draw trail (ghost circles)
    if (state === 'phase') {
      const radius = Math.min(w, h) * 0.35;
      for (let i = 1; i <= 6; i++) {
        const trailT = Math.max(0, phaseTime / PHASE_DURATION - i * 0.03);
        let tx, ty;
        if (phase === 0) { tx = cx; ty = cy + Math.sin(trailT * Math.PI * 4) * radius; }
        else if (phase === 1) { tx = cx + Math.sin(trailT * Math.PI * 4) * radius; ty = cy; }
        else if (phase === 2) { const a = trailT * Math.PI * 4; tx = cx + Math.cos(a) * radius; ty = cy + Math.sin(a) * radius; }
        else { const a = -trailT * Math.PI * 4; tx = cx + Math.cos(a) * radius; ty = cy + Math.sin(a) * radius; }

        ctx.beginPath();
        ctx.arc(tx, ty, 8 - i, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(168, 85, 247, ${0.15 - i * 0.02})`;
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
