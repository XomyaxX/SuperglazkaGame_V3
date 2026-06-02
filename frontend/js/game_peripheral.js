/* ═══════════════════════════════════════════════════════════
   PERIPHERAL HUNTER — Периферийный охотник (тренажёр глаз)
   ═══════════════════════════════════════════════════════════ */
const PeripheralGame = (function() {
  'use strict';

  let canvas, ctx;
  let raf;
  let lastTime = 0;
  let gameState = 'idle'; // idle | playing | gameover | won

  // Config from difficulty
  let diffConfig = null;
  let level = 1;

  // Game settings
  let GAME_DURATION = 60000; // ms
  let LIVES = 3;
  let SPAWN_INTERVAL_MIN = 800;
  let SPAWN_INTERVAL_MAX = 1800;
  let TARGET_LIFETIME = 2500;
  let TRAP_CHANCE = 0;
  let MOVING_CHANCE = 0;
  let FADING_CHANCE = 0;
  let GOLDEN_CHANCE = 0;
  let MAX_ACTIVE = 3;
  let SHOW_HINT = true;

  // Game state
  let score = 0;
  let lives = 3;
  let timeLeft = 60000;
  let combo = 0;
  let maxCombo = 0;
  let targetsHit = 0;
  let trapsHit = 0;
  let missedClicks = 0;
  let spawnTimer = 0;
  let nextSpawnIn = 1000;
  let activeTargets = []; // {id, x, y, type, createdAt, lifetime, basePoints, dx, dy, opacityDir, hit, scale}
  let particles = []; // {x, y, vx, vy, life, color}
  let floatingTexts = []; // {x, y, text, color, life, dy}

  // Center fixation
  let fixPulse = 0;

  function getEl(id) { return document.getElementById(id); }

  function init() {
    canvas = getEl('peripheral-canvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    // Input
    canvas.addEventListener('pointerdown', onPointerDown);
    return true;
  }

  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    canvas.width = Math.floor(rect.width);
    canvas.height = Math.floor(rect.height);
  }

  function getCenterZone() {
    const w = canvas.width;
    const h = canvas.height;
    const minDim = Math.min(w, h);
    return minDim * 0.18; // radius of center dead zone
  }

  function randomPeripheralPos(margin) {
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const deadR = getCenterZone() + 40;
    const m = margin || 40;
    let x, y, dist;
    let attempts = 0;
    do {
      x = m + Math.random() * (w - m * 2);
      y = m + Math.random() * (h - m * 2);
      const dx = x - cx;
      const dy = y - cy;
      dist = Math.sqrt(dx * dx + dy * dy);
      attempts++;
    } while (dist < deadR && attempts < 50);
    return { x, y };
  }

  function spawnTarget() {
    if (activeTargets.length >= MAX_ACTIVE) return;
    const pos = randomPeripheralPos(50);
    const rand = Math.random();

    let type = 'normal';
    let basePoints = 10;
    let lifetime = TARGET_LIFETIME;
    let radius = 22;
    let dx = 0, dy = 0;
    let opacityDir = 0;

    if (rand < GOLDEN_CHANCE) {
      type = 'golden';
      basePoints = 50;
      lifetime = Math.max(800, TARGET_LIFETIME * 0.6);
      radius = 18;
    } else if (rand < GOLDEN_CHANCE + FADING_CHANCE) {
      type = 'fading';
      basePoints = 30;
      lifetime = TARGET_LIFETIME;
      radius = 20;
      opacityDir = 1; // will pulse opacity
    } else if (rand < GOLDEN_CHANCE + FADING_CHANCE + MOVING_CHANCE) {
      type = 'moving';
      basePoints = 25;
      lifetime = TARGET_LIFETIME * 1.2;
      radius = 20;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.5;
      dx = Math.cos(angle) * speed;
      dy = Math.sin(angle) * speed;
    } else if (Math.random() < TRAP_CHANCE && diffConfig && diffConfig.traps) {
      type = 'trap';
      basePoints = -10;
      lifetime = TARGET_LIFETIME;
      radius = 22;
    }

    activeTargets.push({
      id: Math.random().toString(36).slice(2),
      x: pos.x,
      y: pos.y,
      type,
      createdAt: performance.now(),
      lifetime,
      basePoints,
      dx,
      dy,
      opacityDir: type === 'fading' ? 1 : 0,
      opacity: 1,
      hit: false,
      scale: 0,
      radius
    });
  }

  function startGame() {
    if (!canvas) init();
    // Load difficulty
    try {
      if (typeof GameDifficulty !== 'undefined') {
        diffConfig = GameDifficulty.getConfig('peripheral');
        level = diffConfig.level || 1;
      }
    } catch (e) {
      console.warn('[Peripheral] GameDifficulty error, using defaults', e);
      diffConfig = null;
      level = 1;
    }
    const cfg = diffConfig || {};
    GAME_DURATION = cfg.duration || 60000;
    LIVES = cfg.lives || 3;
    SPAWN_INTERVAL_MIN = cfg.spawnMin || 800;
    SPAWN_INTERVAL_MAX = cfg.spawnMax || 1800;
    TARGET_LIFETIME = cfg.targetLifetime || 2500;
    TRAP_CHANCE = cfg.trapChance || 0;
    MOVING_CHANCE = cfg.movingChance || 0;
    FADING_CHANCE = cfg.fadingChance || 0;
    GOLDEN_CHANCE = cfg.goldenChance || 0;
    MAX_ACTIVE = cfg.maxActive || 3;
    SHOW_HINT = cfg.showHint !== false;

    // Reset state
    score = 0;
    lives = LIVES;
    timeLeft = GAME_DURATION;
    combo = 0;
    maxCombo = 0;
    targetsHit = 0;
    trapsHit = 0;
    missedClicks = 0;
    spawnTimer = 0;
    nextSpawnIn = 600;
    activeTargets = [];
    particles = [];
    floatingTexts = [];
    gameState = 'playing';
    lastTime = performance.now();

    document.getElementById('game-overlay-peripheral').classList.add('visible');
    updateUI();
    raf = requestAnimationFrame(loop);
  }

  function loop(now) {
    if (!getEl('game-overlay-peripheral').classList.contains('visible')) return;
    const dt = Math.min(now - lastTime, 50); // cap dt
    lastTime = now;

    if (gameState === 'playing') {
      update(dt, now);
    }
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  function update(dt, now) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      endGame(true);
      return;
    }

    // Spawn
    spawnTimer += dt;
    if (spawnTimer >= nextSpawnIn) {
      spawnTarget();
      spawnTimer = 0;
      nextSpawnIn = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
    }

    // Update targets
    for (let i = activeTargets.length - 1; i >= 0; i--) {
      const t = activeTargets[i];
      const age = now - t.createdAt;

      // Entrance scale
      if (t.scale < 1) {
        t.scale += dt * 0.004;
        if (t.scale > 1) t.scale = 1;
      }

      // Move
      t.x += t.dx * dt * 0.06;
      t.y += t.dy * dt * 0.06;
      // Bounce off edges
      if (t.x < t.radius) { t.x = t.radius; t.dx *= -1; }
      if (t.x > canvas.width - t.radius) { t.x = canvas.width - t.radius; t.dx *= -1; }
      if (t.y < t.radius) { t.y = t.radius; t.dy *= -1; }
      if (t.y > canvas.height - t.radius) { t.y = canvas.height - t.radius; t.dy *= -1; }

      // Fading pulse
      if (t.type === 'fading') {
        t.opacity += t.opacityDir * dt * 0.0015;
        if (t.opacity >= 1) { t.opacity = 1; t.opacityDir = -1; }
        if (t.opacity <= 0.15) { t.opacity = 0.15; t.opacityDir = 1; }
      }

      // Expire
      if (age > t.lifetime && !t.hit) {
        if (t.type !== 'trap') {
          // Missed a target
          combo = 0;
          addFloatingText(t.x, t.y, '❌', '#ef4444');
        }
        activeTargets.splice(i, 1);
      }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Update floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y += ft.dy * dt * 0.06;
      ft.life -= dt;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }

    // Fixation pulse
    fixPulse += dt * 0.003;

    updateUI();
  }

  function onPointerDown(e) {
    if (gameState !== 'playing') return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    // Check center zone (ignore clicks there to encourage peripheral focus)
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const deadR = getCenterZone();
    const distCenter = Math.hypot(x - cx, y - cy);
    if (distCenter < deadR) {
      // Clicking center is neutral but breaks combo if abused? Let's just ignore.
      return;
    }

    // Find closest target
    let hitIdx = -1;
    let hitDist = Infinity;
    for (let i = 0; i < activeTargets.length; i++) {
      const t = activeTargets[i];
      if (t.hit) continue;
      const d = Math.hypot(x - t.x, y - t.y);
      if (d < t.radius * 1.5 && d < hitDist) {
        hitDist = d;
        hitIdx = i;
      }
    }

    if (hitIdx >= 0) {
      const t = activeTargets[hitIdx];
      t.hit = true;

      if (t.type === 'trap') {
        lives--;
        trapsHit++;
        combo = 0;
        addFloatingText(t.x, t.y, '-1 ❤️', '#ef4444');
        spawnParticles(t.x, t.y, '#ef4444', 12);
        if (typeof Haptic !== 'undefined') Haptic.vibratePattern([30, 50, 30]);
        if (lives <= 0) {
          endGame(false);
        }
      } else {
        combo++;
        if (combo > maxCombo) maxCombo = combo;
        targetsHit++;
        const speedBonus = Math.max(0, 30 - Math.floor((performance.now() - t.createdAt) / 100));
        const comboMult = Math.min(2.5, 1 + combo * 0.15);
        const points = Math.round((t.basePoints + speedBonus) * comboMult);
        score += points;
        addFloatingText(t.x, t.y, '+' + points + (combo > 1 ? ' x' + combo.toFixed(1) : ''), '#fbbf24');
        const color = t.type === 'golden' ? '#fbbf24' : t.type === 'moving' ? '#60a5fa' : t.type === 'fading' ? '#a78bfa' : '#34d399';
        spawnParticles(t.x, t.y, color, 10);
        if (typeof Haptic !== 'undefined') Haptic.vibrateSuccess();
      }

      // Remove hit target after short delay for visual
      setTimeout(() => {
        const idx = activeTargets.indexOf(t);
        if (idx >= 0) activeTargets.splice(idx, 1);
      }, 150);
    } else {
      // Missed click (no target there)
      missedClicks++;
      combo = Math.max(0, combo - 1);
      addFloatingText(x, y, '✖', '#ef4444');
    }

    updateUI();
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 400 + Math.random() * 400,
        color
      });
    }
  }

  function addFloatingText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, life: 900, dy: -1.5 });
  }

  function draw(now) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const deadR = getCenterZone();

    // Background vignette
    const grad = ctx.createRadialGradient(cx, cy, deadR * 0.5, cx, cy, Math.max(w, h) * 0.8);
    grad.addColorStop(0, 'rgba(15, 10, 30, 0.2)');
    grad.addColorStop(1, 'rgba(5, 3, 15, 0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Center fixation zone
    ctx.beginPath();
    ctx.arc(cx, cy, deadR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Fixation dot
    const pulseR = 4 + Math.sin(fixPulse) * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    // Hint text near center
    if (SHOW_HINT && gameState === 'playing') {
      ctx.font = '600 12px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(window.I18n ? I18n.t('games.peripheral.fixate') : 'Смотри сюда', cx, cy + deadR + 18);
    }

    // Draw targets
    for (const t of activeTargets) {
      if (t.hit) continue;
      const age = now - t.createdAt;
      const remaining = Math.max(0, t.lifetime - age);
      const urgency = remaining < 600 ? 0.5 + 0.5 * Math.sin(now * 0.01) : 1;
      const alpha = t.type === 'fading' ? t.opacity : 1;
      const r = t.radius * t.scale;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Glow
      ctx.shadowBlur = 15;

      if (t.type === 'trap') {
        ctx.shadowColor = '#ef4444';
        ctx.fillStyle = `rgba(239, 68, 68, ${0.8 * urgency})`;
        ctx.beginPath();
        // Draw X shape
        const s = r * 0.7;
        ctx.moveTo(t.x - s, t.y - s);
        ctx.lineTo(t.x + s, t.y + s);
        ctx.moveTo(t.x + s, t.y - s);
        ctx.lineTo(t.x - s, t.y + s);
        ctx.lineWidth = 5;
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.9 * urgency})`;
        ctx.stroke();
      } else if (t.type === 'golden') {
        ctx.shadowColor = '#fbbf24';
        ctx.fillStyle = `rgba(251, 191, 36, ${0.9 * urgency})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Nunito';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', t.x, t.y);
      } else if (t.type === 'moving') {
        ctx.shadowColor = '#60a5fa';
        ctx.fillStyle = `rgba(96, 165, 250, ${0.85 * urgency})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (t.type === 'fading') {
        ctx.shadowColor = '#a78bfa';
        ctx.fillStyle = `rgba(167, 139, 250, ${0.85 * urgency})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.shadowColor = '#34d399';
        ctx.fillStyle = `rgba(52, 211, 153, ${0.85 * urgency})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.restore();

      // Life ring (shrinking)
      if (remaining < 1200 && t.type !== 'trap') {
        ctx.beginPath();
        ctx.arc(t.x, t.y, r + 6, -Math.PI / 2, -Math.PI / 2 + (remaining / t.lifetime) * Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${0.3 * urgency})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 600);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2 + (p.life / 800) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Floating texts
    for (const ft of floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.life / 900);
      ctx.font = 'bold 18px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
  }

  function updateUI() {
    const scoreEl = getEl('peripheral-score');
    const livesEl = getEl('peripheral-lives');
    const comboEl = getEl('peripheral-combo');
    const timeEl = getEl('peripheral-time');
    const diffEl = getEl('peripheral-difficulty');

    if (scoreEl) scoreEl.textContent = score;
    if (livesEl) livesEl.textContent = '❤️'.repeat(Math.max(0, lives));
    if (comboEl) comboEl.textContent = combo > 1 ? 'x' + combo : '';
    if (timeEl) {
      const sec = Math.ceil(timeLeft / 1000);
      timeEl.textContent = sec + 's';
      if (sec <= 5) timeEl.style.color = '#ef4444';
      else timeEl.style.color = '';
    }
    if (diffEl) diffEl.textContent = level;
  }

  function endGame(completed) {
    gameState = completed ? 'won' : 'gameover';
    cancelAnimationFrame(raf);

    // Save to profile
    if (typeof PlayerProfile !== 'undefined') {
      PlayerProfile.completeGame('peripheral', score);
      PlayerProfile.addCoins(score); // coins = score earned
    }
    if (typeof Leaderboard !== 'undefined') {
      Leaderboard.recordScore('peripheral', score);
    }
    if (typeof GameDifficulty !== 'undefined' && completed) {
      GameDifficulty.increaseLevel('peripheral');
    }
    if (typeof trackEvent === 'function') {
      trackEvent('game_completed', {
        game_type: 'peripheral',
        score: score,
        max_combo: maxCombo,
        targets_hit: targetsHit,
        traps_hit: trapsHit,
        completed: completed
      });
    }

    // Show stats overlay
    const overlay = getEl('peripheral-stats-overlay');
    if (overlay) {
      const statusEl = getEl('peripheral-stats-status');
      const scoreEl = getEl('peripheral-stats-score');
      const bestEl = getEl('peripheral-stats-best');
      const comboEl = getEl('peripheral-stats-combo');
      const targetsEl = getEl('peripheral-stats-targets');

      if (statusEl) {
        if (completed) {
          statusEl.textContent = window.I18n ? I18n.t('games.peripheral.completed') : 'Время вышло! Отличный результат!';
          statusEl.style.color = '#34d399';
        } else {
          statusEl.textContent = window.I18n ? I18n.t('games.peripheral.gameover') : 'Жизни закончились! Попробуй ещё!';
          statusEl.style.color = '#ef4444';
        }
      }
      if (scoreEl) scoreEl.textContent = score;
      if (comboEl) comboEl.textContent = maxCombo + 'x';
      if (targetsEl) targetsEl.textContent = targetsHit;

      var bestScore = 0;
      if (typeof PlayerProfile !== 'undefined' && PlayerProfile.getProfile) {
        var pt = PlayerProfile.getProfile();
        if (pt && pt.games && pt.games.peripheral) bestScore = pt.games.peripheral.bestScore || 0;
      }
      if (bestEl) bestEl.textContent = (window.I18n ? I18n.t('games.stats.best') : '🏆 Рекорд: ') + bestScore;

      overlay.classList.add('visible');
    }

    if (typeof Haptic !== 'undefined') {
      if (completed) Haptic.vibrateSuccess();
    }

    // Check achievements
    if (typeof Achievements !== 'undefined' && Achievements.check) {
      Achievements.check('game', 'peripheral');
      Achievements.check('game_count', 'peripheral', targetsHit);
    }
  }

  function closeGame() {
    cancelAnimationFrame(raf);
    getEl('game-overlay-peripheral').classList.remove('visible');
    const statsOverlay = getEl('peripheral-stats-overlay');
    if (statsOverlay) statsOverlay.classList.remove('visible');
    gameState = 'idle';
  }

  return { startGame, closeGame };
})();

/* ─── GLOBAL API FOR app.js ─── */
window.startPeripheralGame = function() {
  console.log('[Peripheral] startPeripheralGame called');
  PeripheralGame.startGame();
};

window.closePeripheral = function(skip) {
  PeripheralGame.closeGame();
  if (skip) {
    if (typeof trackEvent === 'function') trackEvent('game_skipped', { game_type: 'peripheral' });
    if (typeof App !== 'undefined') setTimeout(() => App.advanceFromGame(), 300);
  }
};

window.closePeripheralContinue = function() {
  const statsOverlay = document.getElementById('peripheral-stats-overlay');
  if (statsOverlay) statsOverlay.classList.remove('visible');
  setTimeout(() => {
    if (typeof App !== 'undefined') App.advanceFromGame();
  }, 300);
};
