/* ═══════════════════════════════════════════════════════════════════
   VANYA vs LENIVUS — Детская версия со статистикой и регистрацией
   ═══════════════════════════════════════════════════════════════════ */
const GymGame = (function(){
  'use strict';
  // Fallback if app.js cached version lacks hideOverlay
  if (typeof window.hideOverlay !== 'function') {
    window.hideOverlay = function(id) {
      const el = typeof id === 'string' ? document.getElementById(id) : id;
      if (el) el.classList.remove('visible');
    };
  }
  
  // ═══ GAME CONSTANTS (Увеличено для детей) ═══
  let TARGETS = {
    LASER: 8,
    AIM: 5,
    TEARS: 4
  };
  
  let CHARGE_TIME = {
    LASER: 2000,
    AIM: 1500,
    TEAR: 5
  };

  let diffConfig = null;
  let LASER_THRESHOLD = 90;
  let AIM_HITBOX = 22;
  let AIM_DECAY = 25;
  let AIM_TRANSITION = '0.8s ease';
  let COOLDOWNS = { laser: 800, aim: 1000, tears: 1200 };
  
  // ═══ STATE ═══
  let phase = 0;
  let bossHp = 100;
  let rays = 0;
  let isTransitioning = false;
  
  // Timers
  let gameStartTime = 0;
  let phaseStartTime = 0;
  let lastHitTime = 0;
  
  // Statistics
  const gameStats = {
    totalTime: 0,
    phase1: { hits: 0, attempts: 0, accuracy: 100 },
    phase2: { hits: 0, timeOnTarget: 0, accuracy: 100 },
    phase3: { hits: 0, blinks: 0, accuracy: 100 },
    totalScore: 0
  };
  
  // Phase 0: Laser
  let laserCharge = 0;
  let laserHits = 0;
  let isCharging = false;
  let chargeAnimId = null;
  let chargeStartTime = 0;
  
  // Phase 1: Aim
  let aimCursor = { x: 50, y: 50 };
  let aimHoldTime = 0;
  let aimHits = 0;
  let aimAnimId = null;
  let targetPos = { x: 50, y: 50 };
  let timeOnTarget = 0;
  let targetEnterTime = 0;
  
  // Phase 2: Tears
  let tearCharge = 0;
  let tearCycles = 0;
  let totalBlinks = 0;
  
  // DOM cache
  function getEl(id) { return document.getElementById(id); }
  
  // ═══ VIDEO MANAGEMENT ═══
  function initVideo() {
    const video = getEl('boss-video');
    if (!video) return;
    
    video.onerror = () => {
      video.style.display = 'none';
      const img = document.createElement('img');
      img.src = 'assets/shared/characters/lenivus.png';
      img.className = 'boss-bg-video';
      img.style.cssText = video.style.cssText;
      video.parentNode.insertBefore(img, video);
    };
    
    video.play().catch(() => {});
  }
  
  function shakeVideo() {
    const video = getEl('boss-video');
    if (!video) return;
    video.style.transform = 'scale(1.03) translateX(8px)';
    setTimeout(() => {
      video.style.transform = 'scale(1) translateX(0)';
    }, 150);
  }
  
  function flashVideo() {
    const video = getEl('boss-video');
    if (!video) return;
    video.classList.add('boss-hit-flash');
    setTimeout(() => video.classList.remove('boss-hit-flash'), 300);
  }
  
  // ═══ BOSS HP ═══
  function updateBossHp() {
    const fill = getEl('boss-hp-fill');
    if (fill) {
      fill.style.width = Math.max(0, bossHp) + '%';
    }
  }
  
  function showDamage(damage) {
    const effects = getEl('attack-effects');
    if (!effects) return;
    
    const dmg = document.createElement('div');
    dmg.className = 'damage-number-new';
    dmg.textContent = '-' + damage;
    dmg.style.left = (45 + Math.random() * 15) + '%';
    dmg.style.top = (25 + Math.random() * 15) + '%';
    effects.appendChild(dmg);
    
    setTimeout(() => dmg.remove(), 1000);
  }
  
  // ═══ VANYA ANIMATIONS ═══
  function animateVanyaAttack() {
    const vanya = getEl('player-vanya');
    if (!vanya) return;
    vanya.classList.add('attacking');
    setTimeout(() => vanya.classList.remove('attacking'), 500);
  }
  
  function setVanyaCharge(percent) {
    const indicator = getEl('player-charge');
    if (!indicator) return;
    
    if (percent > 0) {
      indicator.classList.add('charging');
      indicator.style.setProperty('--charge', percent + '%');
    } else {
      indicator.classList.remove('charging');
    }
  }
  
  // ═══ ATTACK EFFECTS ═══
  function createLaserEffect() {
    const effects = getEl('attack-effects');
    if (!effects) return;
    
    const beam = document.createElement('div');
    beam.className = 'laser-beam-new';
    effects.appendChild(beam);
    setTimeout(() => beam.remove(), 500);
  }
  
  function createWaterfallEffect() {
    const effects = getEl('attack-effects');
    if (!effects) return;
    
    const waterfall = document.createElement('div');
    waterfall.className = 'waterfall-effect-new';
    effects.appendChild(waterfall);
    setTimeout(() => waterfall.remove(), 1500);
  }
  
  function createPrecisionEffect() {
    const effects = getEl('attack-effects');
    if (!effects) return;
    
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const beam = document.createElement('div');
        beam.className = 'laser-beam-new';
        beam.style.top = (45 + i * 5) + '%';
        beam.style.height = '4px';
        beam.style.background = 'linear-gradient(90deg, transparent, #06b6d4, #fff, #06b6d4)';
        beam.style.boxShadow = '0 0 20px #06b6d4';
        effects.appendChild(beam);
        setTimeout(() => beam.remove(), 500);
      }, i * 150);
    }
  }
  
  // ═══ PHASE 0: LASER (8 hits, 2 sec charge) ═══
  function setupLaserPhase() {
    const container = getEl('phase-container');
    if (!container) return;

    container.textContent = '';

    const instruction = document.createElement('div');
    instruction.className = 'phase-instruction';
    instruction.textContent = '⚡ ' + (window.I18n ? I18n.t('games.gym.laserInstruction', {sec: CHARGE_TIME.LASER / 1000}) : 'Зажми кнопку на ' + (CHARGE_TIME.LASER / 1000) + ' секунды, потом отпусти!');
    container.appendChild(instruction);

    const btn = document.createElement('button');
    btn.className = 'phase-btn-new' + (isCharging ? ' charging' : '');
    btn.id = 'laser-btn';
    const btnSpan = document.createElement('span');
    btnSpan.textContent = isCharging ? '🔥 ' + (window.I18n ? I18n.t('games.gym.charging') : 'ЗАРЯЖАЮ...') : '⚡ ' + (window.I18n ? I18n.t('games.gym.ray') : 'СОЛНЕЧНЫЙ ЛУЧ');
    btn.appendChild(btnSpan);
    container.appendChild(btn);

    const hitsDiv = document.createElement('div');
    hitsDiv.style.cssText = 'text-align: center; margin-top: 16px; font-size: 15px; color: rgba(255,255,255,0.8); font-weight: 700;';
    hitsDiv.textContent = (window.I18n ? I18n.t('games.stats.hits') : 'Попаданий: ') + laserHits + ' / ' + TARGETS.LASER;
    container.appendChild(hitsDiv);

    const leftDiv = document.createElement('div');
    leftDiv.style.cssText = 'text-align: center; margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.5);';
    leftDiv.textContent = (window.I18n ? I18n.t('games.stats.left') : 'Осталось: ') + (TARGETS.LASER - laserHits);
    container.appendChild(leftDiv);

    if (!btn) return;
    
    const startCharge = (e) => {
      e.preventDefault();
      if (isCharging) return;
      
      isCharging = true;
      laserCharge = 0;
      chargeStartTime = Date.now();
      
      // Обновляем кнопку напрямую, не пересоздавая (иначе теряется touchend)
      const btnEl = getEl('laser-btn');
      if (btnEl) {
        btnEl.classList.add('charging');
        btnEl.textContent = '';
        const span = document.createElement('span');
        span.textContent = '🔥 ' + (window.I18n ? I18n.t('games.gym.charging') : 'ЗАРЯЖАЮ...');
        btnEl.appendChild(span);
      }
      
      const chargeLoop = () => {
        if (!isCharging) return;
        
        const elapsed = Date.now() - chargeStartTime;
        laserCharge = Math.min((elapsed / CHARGE_TIME.LASER) * 100, 100);
        setVanyaCharge(laserCharge);
        
        if (laserCharge < 100) {
          chargeAnimId = requestAnimationFrame(chargeLoop);
        }
      };
      chargeLoop();
    };
    
    const releaseCharge = (e) => {
      e.preventDefault();
      if (!isCharging) return;
      
      isCharging = false;
      cancelAnimationFrame(chargeAnimId);
      setVanyaCharge(0);
      
      gameStats.phase1.attempts++;
      
      if (laserCharge >= LASER_THRESHOLD) {
        fireLaser();
      } else {
        // Too early - miss
        const btn = getEl('laser-btn');
        if (btn) {
          btn.textContent = '⚠️ ' + (window.I18n ? I18n.t('games.gym.undercharge') : 'Недозаряд!');
          btn.style.background = '#64748b';
          setTimeout(updateUI, 1000);
        }
      }
    };
    
    btn.addEventListener('mousedown', startCharge);
    btn.addEventListener('touchstart', startCharge, {passive: false});
    btn.addEventListener('mouseup', releaseCharge);
    btn.addEventListener('touchend', releaseCharge);
    btn.addEventListener('mouseleave', releaseCharge);
  }
  
  function fireLaser() {
    animateVanyaAttack();
    
    setTimeout(() => {
      createLaserEffect();
      shakeVideo();
      flashVideo();
      
      setTimeout(() => {
        laserHits++;
        gameStats.phase1.hits++;
        bossHp = Math.max(0, bossHp - (100 / TARGETS.LASER));
        updateBossHp();
        showDamage(Math.floor(100 / TARGETS.LASER));
        
        // Pause between shots for kids
        const btn = getEl('laser-btn');
        if (btn) {
          btn.disabled = true;
          btn.textContent = '✅ ' + (window.I18n ? I18n.t('games.gym.hit') : 'Попадание!');
          btn.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
        }
        
        setTimeout(() => {
          if (laserHits >= TARGETS.LASER) {
            completePhase();
          } else {
            updateUI();
          }
        }, COOLDOWNS.laser || 800);
      }, 300);
    }, 300);
  }
  
  // ═══ PHASE 1: PRECISION AIM (5 hits, 1.5 sec aim) ═══
  function setupAimPhase() {
    const container = getEl('phase-container');
    if (!container) return;

    container.textContent = '';

    const instruction = document.createElement('div');
    instruction.className = 'phase-instruction';
    instruction.textContent = '🎯 ' + (window.I18n ? I18n.t('games.gym.aimInstruction', {sec: CHARGE_TIME.AIM / 1000}) : 'Веди прицел к красному кружку и держи ' + (CHARGE_TIME.AIM / 1000) + ' сек!');
    container.appendChild(instruction);

    const area = document.createElement('div');
    area.className = 'aim-area';
    area.id = 'aim-area';
    area.style.cssText = 'width: 100%; height: 160px; background: rgba(0,0,0,0.3); border: 2px dashed rgba(255,255,255,0.3); border-radius: 16px; position: relative; touch-action: none; overflow: hidden;';

    const target = document.createElement('div');
    target.id = 'aim-target';
    target.style.cssText = 'position: absolute; width: 70px; height: 70px; border: 4px solid #ef4444; border-radius: 50%; background: rgba(239,68,68,0.2); transform: translate(-50%,-50%); transition: all ' + AIM_TRANSITION + '; box-shadow: 0 0 25px rgba(239,68,68,0.5); display: flex; align-items: center; justify-content: center; font-size: 24px;';
    target.textContent = '🎯';
    area.appendChild(target);

    const cursor = document.createElement('div');
    cursor.id = 'aim-cursor';
    cursor.style.cssText = 'position: absolute; width: 50px; height: 50px; border: 3px solid #fff; border-radius: 50%; transform: translate(-50%,-50%); pointer-events: none; box-shadow: 0 0 20px rgba(255,255,255,0.8), inset 0 0 15px rgba(255,255,255,0.3); z-index: 10; display: flex; align-items: center; justify-content: center;';
    cursor.textContent = '👁️';
    area.appendChild(cursor);

    const progressWrap = document.createElement('div');
    progressWrap.style.cssText = 'position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); width: 120px; height: 8px; background: rgba(255,255,255,0.2); border-radius: 4px; overflow: hidden;';
    const progressBar = document.createElement('div');
    progressBar.id = 'aim-progress';
    progressBar.style.cssText = 'width: 0%; height: 100%; background: linear-gradient(90deg, #22c55e, #4ade80); transition: width 0.1s;';
    progressWrap.appendChild(progressBar);
    area.appendChild(progressWrap);

    container.appendChild(area);

    const hitsDiv = document.createElement('div');
    hitsDiv.style.cssText = 'text-align: center; margin-top: 16px; font-size: 15px; color: rgba(255,255,255,0.8); font-weight: 700;';
    hitsDiv.textContent = (window.I18n ? I18n.t('games.stats.hits') : 'Попаданий: ') + aimHits + ' / ' + TARGETS.AIM;
    container.appendChild(hitsDiv);

    const leftDiv = document.createElement('div');
    leftDiv.style.cssText = 'text-align: center; margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.5);';
    leftDiv.textContent = (window.I18n ? I18n.t('games.stats.left') : 'Осталось: ') + (TARGETS.AIM - aimHits);
    container.appendChild(leftDiv);

    if (!area || !cursor || !target) return;
    
    // Set initial positions
    cursor.style.left = aimCursor.x + '%';
    cursor.style.top = aimCursor.y + '%';
    
    moveAimTarget(target);
    
    const handleMove = (e) => {
      if (e.type.startsWith('touch')) e.preventDefault();
      const rect = area.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      aimCursor.x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      aimCursor.y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
      
      cursor.style.left = aimCursor.x + '%';
      cursor.style.top = aimCursor.y + '%';
    };
    
    area.addEventListener('mousemove', handleMove);
    area.addEventListener('touchmove', handleMove, {passive: false});
    area.addEventListener('mousedown', handleMove);
    area.addEventListener('touchstart', handleMove, {passive: false});
    
    startAimLoop(target);
  }
  
  function moveAimTarget(target) {
    targetPos.x = 15 + Math.random() * 70;
    targetPos.y = 15 + Math.random() * 70;
    
    if (target) {
      target.style.left = targetPos.x + '%';
      target.style.top = targetPos.y + '%';
    }
  }
  
  function startAimLoop(target) {
    if (phase !== 1) return;
    
    const progress = getEl('aim-progress');
    const cursor = getEl('aim-cursor');
    
    const checkAim = () => {
      if (phase !== 1 || aimHits >= TARGETS.AIM) return;
      
      const dx = aimCursor.x - targetPos.x;
      const dy = aimCursor.y - targetPos.y;
      const distance = Math.sqrt(dx*dx + dy*dy);
      
      if (distance < AIM_HITBOX) {
        if (targetEnterTime === 0) targetEnterTime = Date.now();
        aimHoldTime += 16;
        timeOnTarget += 16;
        
        if (progress) progress.style.width = (aimHoldTime / CHARGE_TIME.AIM * 100) + '%';
        if (cursor) {
          cursor.style.borderColor = '#22c55e';
          cursor.style.boxShadow = '0 0 25px rgba(34, 197, 94, 0.8)';
        }
        
        if (aimHoldTime >= CHARGE_TIME.AIM) {
          firePrecisionShot();
          aimHoldTime = 0;
          targetEnterTime = 0;
          if (progress) progress.style.width = '0%';
        }
      } else {
        aimHoldTime = Math.max(0, aimHoldTime - AIM_DECAY);
        targetEnterTime = 0;
        if (progress) progress.style.width = (aimHoldTime / CHARGE_TIME.AIM * 100) + '%';
        if (cursor) {
          cursor.style.borderColor = '#fff';
          cursor.style.boxShadow = '0 0 20px rgba(255,255,255,0.8)';
        }
      }
      
      aimAnimId = requestAnimationFrame(checkAim);
    };
    
    checkAim();
  }
  
  function firePrecisionShot() {
    animateVanyaAttack();
    
    setTimeout(() => {
      createPrecisionEffect();
      shakeVideo();
      flashVideo();
      
      setTimeout(() => {
        aimHits++;
        gameStats.phase2.hits++;
        gameStats.phase2.timeOnTarget += timeOnTarget;
        bossHp = Math.max(0, bossHp - (100 / TARGETS.AIM));
        updateBossHp();
        showDamage(Math.floor(100 / TARGETS.AIM));
        
        // Pause between shots
        const area = getEl('aim-area');
        if (area) {
          area.style.pointerEvents = 'none';
          area.style.opacity = '0.7';
        }
        
        setTimeout(() => {
          if (aimHits >= TARGETS.AIM) {
            cancelAnimationFrame(aimAnimId);
            completePhase();
          } else {
            if (area) {
              area.style.pointerEvents = 'auto';
              area.style.opacity = '1';
            }
            moveAimTarget(getEl('aim-target'));
          }
        }, COOLDOWNS.aim || 1000);
      }, 400);
    }, 300);
  }
  
  // ═══ PHASE 2: TEARS (4 cycles, 5 taps each) ═══
  function setupTearsPhase() {
    const container = getEl('phase-container');
    if (!container) return;
    
    const progressPercent = (tearCharge / CHARGE_TIME.TEAR) * 100;
    
    container.textContent = '';

    const instruction = document.createElement('div');
    instruction.className = 'phase-instruction';
    instruction.textContent = '💧 ' + (window.I18n ? I18n.t('games.gym.tearInstruction', {count: CHARGE_TIME.TEAR}) : 'Быстро тапай ' + CHARGE_TIME.TEAR + ' раз чтобы создать водопад!');
    container.appendChild(instruction);

    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 24px; margin-bottom: 20px;';

    const tank = document.createElement('div');
    tank.style.cssText = 'width: 50px; height: 120px; background: rgba(255,255,255,0.1); border-radius: 25px; overflow: hidden; border: 2px solid rgba(255,255,255,0.2); position: relative;';
    const fill = document.createElement('div');
    fill.id = 'tear-fill';
    fill.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; height: ' + progressPercent + '%; background: linear-gradient(180deg, #06b6d4, #3b82f6, #1d4ed8); transition: height 0.15s ease; box-shadow: 0 0 25px rgba(6,182,212,0.6);';
    tank.appendChild(fill);
    const dropIcon = document.createElement('div');
    dropIcon.style.cssText = 'position: absolute; top: 8px; left: 50%; transform: translateX(-50%); font-size: 20px; filter: grayscale(' + (100 - progressPercent) + '%); transition: filter 0.3s;';
    dropIcon.textContent = '💧';
    tank.appendChild(dropIcon);
    row.appendChild(tank);

    const cycles = document.createElement('div');
    cycles.style.cssText = 'font-size: 36px; letter-spacing: 4px;';
    cycles.textContent = '🌊'.repeat(tearCycles) + '⚪'.repeat(TARGETS.TEARS - tearCycles);
    row.appendChild(cycles);

    container.appendChild(row);

    const btn = document.createElement('button');
    btn.className = 'phase-btn-new';
    btn.id = 'tear-btn';
    btn.style.cssText = 'background: linear-gradient(135deg, #06b6d4, #3b82f6);';
    const btnIcon = document.createElement('span');
    btnIcon.style.fontSize = '20px';
    btnIcon.textContent = '💧';
    const btnText = document.createElement('span');
    btnText.textContent = window.I18n ? I18n.t('games.gym.blinkBtn') : 'МОРГНУТЬ!';
    btn.appendChild(btnIcon);
    btn.appendChild(btnText);
    container.appendChild(btn);

    const cyclesDiv = document.createElement('div');
    cyclesDiv.style.cssText = 'text-align: center; margin-top: 16px; font-size: 15px; color: rgba(255,255,255,0.8); font-weight: 700;';
    cyclesDiv.textContent = (window.I18n ? I18n.t('games.stats.waterfalls') : 'Водопадов: ') + tearCycles + ' / ' + TARGETS.TEARS;
    container.appendChild(cyclesDiv);

    const tapsDiv = document.createElement('div');
    tapsDiv.style.cssText = 'text-align: center; margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.5);';
    tapsDiv.textContent = (CHARGE_TIME.TEAR - tearCharge) + ' ' + (window.I18n ? I18n.t('games.gym.tapsToWaterfall') : 'тапов до водопада');
    container.appendChild(tapsDiv);

    if (!btn) return;
    
    const blink = (e) => {
      e.preventDefault();
      
      totalBlinks++;
      tearCharge++;
      
      const fill = getEl('tear-fill');
      if (fill) {
        const percent = (tearCharge / CHARGE_TIME.TEAR) * 100;
        fill.style.height = percent + '%';
      }
      
      // Button feedback
      btn.style.transform = 'scale(0.92)';
      setTimeout(() => btn.style.transform = 'scale(1)', 80);
      
      if (tearCharge >= CHARGE_TIME.TEAR) {
        btn.disabled = true;
        setTimeout(releaseWaterfall, 200);
      } else {
        // Update counter text
        const counter = btn.nextElementSibling.nextElementSibling;
        if (counter) {
          counter.textContent = (CHARGE_TIME.TEAR - tearCharge) + ' ' + (window.I18n ? I18n.t('games.gym.tapsToWaterfall') : 'тапов до водопада');
        }
      }
    };
    
    btn.addEventListener('click', blink);
    btn.addEventListener('touchstart', blink, {passive: false});
  }
  
  function releaseWaterfall() {
    tearCycles++;
    gameStats.phase3.hits++;
    tearCharge = 0;
    
    createWaterfallEffect();
    
    setTimeout(() => {
      shakeVideo();
      flashVideo();
      
      bossHp = Math.max(0, bossHp - (100 / TARGETS.TEARS));
      updateBossHp();
      showDamage(Math.floor(100 / TARGETS.TEARS));
      
      // Pause between cycles
      setTimeout(() => {
        if (tearCycles >= TARGETS.TEARS) {
          completePhase();
        } else {
          updateUI();
        }
      }, 1200);
    }, 600);
  }
  
  // ═══ CORE FUNCTIONS ═══
  function updateUI() {
    const container = getEl('phase-container');
    if (!container) return;
    
    if (phase === 0) setupLaserPhase();
    else if (phase === 1) setupAimPhase();
    else if (phase === 2) setupTearsPhase();
    
    const raysEl = getEl('gym-rays');
    if (raysEl) {
      raysEl.textContent = '☀️'.repeat(rays) + '⚪'.repeat(3 - rays);
    }
    
    const diffEl = getEl('gym-difficulty');
    if (diffEl) diffEl.textContent = (diffConfig && diffConfig.level) ? diffConfig.level : 1;
  }
  
  function completePhase() {
    if (isTransitioning) return;
    isTransitioning = true;
    
    // Save phase time
    const phaseTime = Date.now() - phaseStartTime;
    gameStats[`phase${phase + 1}`].time = phaseTime;
    
    rays++;
    updateUI();
    
    // Flash effect
    const video = getEl('boss-video');
    if (video) {
      video.style.filter = 'brightness(2.5) saturate(2)';
      setTimeout(() => video.style.filter = '', 500);
    }
    
    setTimeout(() => {
      phase++;
      bossHp = 100;
      phaseStartTime = Date.now();
      updateBossHp();
      
      // Reset vars
      laserCharge = 0; laserHits = 0; isCharging = false;
      aimHits = 0; aimHoldTime = 0; timeOnTarget = 0;
      tearCharge = 0; tearCycles = 0;
      
      if (aimAnimId) {
        cancelAnimationFrame(aimAnimId);
        aimAnimId = null;
      }
      
      if (phase >= 3) {
        showVictory();
      } else {
        isTransitioning = false;
        updateUI();
      }
    }, 1000);
  }
  
  function showVictory() {
    gameStats.totalTime = Date.now() - gameStartTime;
    gameStats.phase3.blinks = totalBlinks;
    
    // Increase difficulty on victory
    if (typeof GameDifficulty !== 'undefined') {
      GameDifficulty.increaseLevel('gym');
    }
    
    // Calculate scores
    calculateScores();
    
    // Fade out video
    const video = getEl('boss-video');
    if (video) {
      video.style.transition = 'opacity 2s, filter 2s';
      video.style.opacity = '0.2';
      video.style.filter = 'blur(15px) grayscale(1)';
    }
    
    setTimeout(() => {
      window.hideOverlay('game-overlay-gym');
      showStats();
    }, 1500);
  }
  
  function calculateScores() {
    // Phase 1: Accuracy based on hits/attempts
    gameStats.phase1.accuracy = gameStats.phase1.attempts > 0 
      ? Math.round((gameStats.phase1.hits / gameStats.phase1.attempts) * 100)
      : 100;
    
    // Phase 2: Time bonus
    const avgAimTime = gameStats.phase2.hits > 0 
      ? Math.round(gameStats.phase2.timeOnTarget / gameStats.phase2.hits / 10) / 100
      : 0;
    gameStats.phase2.accuracy = Math.max(0, 100 - Math.floor(avgAimTime * 20));
    
    // Phase 3: Efficiency (perfect would be 5*4=20 blinks)
    const idealBlinks = CHARGE_TIME.TEAR * TARGETS.TEARS;
    gameStats.phase3.accuracy = Math.max(50, Math.round((idealBlinks / Math.max(totalBlinks, idealBlinks)) * 100));
    
    // Total score
    const timeBonus = Math.max(0, 300 - Math.floor(gameStats.totalTime / 1000));
    const accuracyTotal = gameStats.phase1.accuracy + gameStats.phase2.accuracy + gameStats.phase3.accuracy;
    gameStats.totalScore = (timeBonus * 10) + (accuracyTotal * 15) + 1500;
  }
  
  // ═══ STATS DISPLAY ═══
  function showStats() {
    const overlay = getEl('stats-overlay');
    if (!overlay) return;
    
    overlay.classList.add('visible');
    
    // Fill data
    const formatTime = (ms) => {
      const sec = Math.floor(ms / 1000);
      const min = Math.floor(sec / 60);
      return `${min}:${String(sec % 60).padStart(2, '0')}`;
    };
    
    const timeEl = getEl('stats-time');
    if (timeEl) timeEl.textContent = '⏱️ ' + (window.I18n ? I18n.t('games.stats.time') : 'Время: ') + formatTime(gameStats.totalTime);
    
    const p1Hits = getEl('stats-p1-hits');
    if (p1Hits) p1Hits.textContent = `${gameStats.phase1.hits}/${TARGETS.LASER}`;
    
    const p1Acc = getEl('stats-p1-acc');
    if (p1Acc) p1Acc.textContent = `${gameStats.phase1.accuracy}%`;
    
    const p2Hits = getEl('stats-p2-hits');
    if (p2Hits) p2Hits.textContent = `${gameStats.phase2.hits}/${TARGETS.AIM}`;
    
    const p2Time = getEl('stats-p2-time');
    if (p2Time) {
      const avgTime = gameStats.phase2.hits > 0 
        ? (gameStats.phase2.timeOnTarget / gameStats.phase2.hits / 1000).toFixed(1)
        : '0';
      p2Time.textContent = avgTime + (window.I18n ? I18n.t('time.seconds') : 'с');
    }
    
    const p3Hits = getEl('stats-p3-hits');
    if (p3Hits) p3Hits.textContent = `${gameStats.phase3.hits}/${TARGETS.TEARS}`;
    
    const p3Blinks = getEl('stats-p3-blinks');
    if (p3Blinks) p3Blinks.textContent = totalBlinks;
    
    const scoreEl = getEl('stats-score');
    if (scoreEl) scoreEl.textContent = '🏆 ' + (window.I18n ? I18n.t('games.stats.totalScoreShort') : 'Общий счёт: ') + gameStats.totalScore;
  }
  
  window.showRegistration = function() {
    const statsOverlay = getEl('stats-overlay');
    if (statsOverlay) statsOverlay.classList.remove('visible');
    
    const regOverlay = getEl('registration-overlay');
    if (regOverlay) regOverlay.classList.add('visible');
  };
  
  window.skipRegistration = function() {
    const regOverlay = getEl('registration-overlay');
    if (regOverlay) regOverlay.classList.remove('visible');
    
    // Reset video and continue
    const video = getEl('boss-video');
    if (video) {
      video.style.transition = '';
      video.style.opacity = '1';
      video.style.filter = '';
    }
    
    window.closeWinContinue();
  };
  
  // Registration form handler
  document.addEventListener('DOMContentLoaded', () => {
    const form = getEl('reg-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const nickname = getEl('reg-nickname').value;
        const email = getEl('reg-email').value;
        
        // Save to localStorage
        const progress = {
          nickname: nickname,
          email: email,
          stats: gameStats,
          completedSeries: [1],
          totalPlayTime: gameStats.totalTime,
          achievements: [window.I18n ? I18n.t('games.gym.ach1') : 'Первый бой с Ленивусом', window.I18n ? I18n.t('games.gym.ach2') : 'Защитник Мира Глазки'],
          registeredAt: new Date().toISOString()
        };
        
        localStorage.setItem('superglazka_progress', JSON.stringify(progress));
        
        // Show success message
        const card = document.querySelector('.reg-card');
        if (card) {
          card.textContent = '';
          const success = document.createElement('div');
          success.className = 'reg-success';
          const icon = document.createElement('div');
          icon.className = 'reg-success-icon';
          icon.textContent = '🎉';
          const title = document.createElement('div');
          title.className = 'reg-success-title';
          title.textContent = (window.I18n ? I18n.t('auth.welcome') : 'Добро пожаловать, ') + nickname + '!';
          const text = document.createElement('div');
          text.className = 'reg-success-text';
          text.appendChild(document.createTextNode(window.I18n ? I18n.t('auth.progressSaved') : 'Твой прогресс сохранён!'));
          text.appendChild(document.createElement('br'));
          text.appendChild(document.createTextNode(window.I18n ? I18n.t('auth.teamMember') : 'Теперь ты часть команды Суперглазки!'));
          const btn = document.createElement('button');
          btn.className = 'tr-btn';
          btn.style.cssText = 'margin-top: 24px; width: 100%;';
          btn.textContent = window.I18n ? I18n.t('app.continueAdventure') : 'Продолжить приключение ➜';
          btn.addEventListener('click', finishRegistration);
          success.appendChild(icon);
          success.appendChild(title);
          success.appendChild(text);
          success.appendChild(btn);
          card.appendChild(success);
        }
      });
    }
  });
  
  window.finishRegistration = function() {
    const regOverlay = getEl('registration-overlay');
    if (regOverlay) regOverlay.classList.remove('visible');
    
    const video = getEl('boss-video');
    if (video) {
      video.style.transition = '';
      video.style.opacity = '1';
      video.style.filter = '';
    }
    
    window.closeWinContinue();
  };
  
  // ═══ PUBLIC API ═══
  window.startGymGame = function() {
    console.log('[Gym] startGymGame called');
    window.hideOverlay('tr-overlay-gym');
    const overlay = getEl('game-overlay-gym');
    if (overlay) overlay.classList.add('visible');

    // Load progressive difficulty
    try {
      if (typeof GameDifficulty !== 'undefined') {
        diffConfig = GameDifficulty.getConfig('gym');
      }
    } catch (e) {
      console.warn('[Gym] GameDifficulty error, using defaults', e);
      diffConfig = null;
    }
    var cfg = diffConfig || {};
    TARGETS = {
      LASER: (cfg.targets && cfg.targets.laser) || 8,
      AIM: (cfg.targets && cfg.targets.aim) || 5,
      TEARS: (cfg.targets && cfg.targets.tears) || 4
    };
    CHARGE_TIME = {
      LASER: (cfg.chargeTime && cfg.chargeTime.laser) || 2000,
      AIM: (cfg.chargeTime && cfg.chargeTime.aim) || 1500,
      TEAR: (cfg.chargeTime && cfg.chargeTime.tear) || 5
    };
    LASER_THRESHOLD = cfg.laserThreshold || 90;
    AIM_HITBOX = cfg.aimHitbox || 22;
    AIM_DECAY = cfg.aimDecay || 25;
    AIM_TRANSITION = cfg.aimTransition ? (cfg.aimTransition + 's ease') : '0.8s ease';
    COOLDOWNS = cfg.cooldowns || { laser: 800, aim: 1000, tears: 1200 };
    
    // Reset all state
    phase = 0;
    bossHp = cfg.bossHp || 100;
    rays = 0;
    isTransitioning = false;
    
    laserCharge = 0; laserHits = 0; isCharging = false;
    aimHits = 0; aimHoldTime = 0; timeOnTarget = 0;
    tearCharge = 0; tearCycles = 0; totalBlinks = 0;
    targetEnterTime = 0;
    
    // Reset stats
    gameStats.totalTime = 0;
    gameStats.phase1 = { hits: 0, attempts: 0, accuracy: 100 };
    gameStats.phase2 = { hits: 0, timeOnTarget: 0, accuracy: 100 };
    gameStats.phase3 = { hits: 0, blinks: 0, accuracy: 100 };
    gameStats.totalScore = 0;
    
    if (aimAnimId) {
      cancelAnimationFrame(aimAnimId);
      aimAnimId = null;
    }
    if (chargeAnimId) {
      cancelAnimationFrame(chargeAnimId);
      chargeAnimId = null;
    }
    
    // Start timers
    gameStartTime = Date.now();
    phaseStartTime = gameStartTime;
    
    // Init
    initVideo();
    updateBossHp();
    // Небольшая задержка, чтобы браузер успел выполнить layout
    setTimeout(() => {
      updateUI();
      
      // Быстрый отклик на кнопку "Пропустить" с телефона
      const skipBtn = document.querySelector('#game-overlay-gym .skip-btn');
      if (skipBtn) {
        skipBtn.addEventListener('touchstart', (e) => { e.preventDefault(); closeGym(true); }, {passive: false});
      }
    }, 50);
  };
  
  window.closeGym = function(skip) {
    if (aimAnimId) cancelAnimationFrame(aimAnimId);
    if (chargeAnimId) cancelAnimationFrame(chargeAnimId);
    
    isCharging = false;
    
    const video = getEl('boss-video');
    if (video) {
      video.style.filter = '';
      video.style.opacity = '1';
      video.style.transform = '';
    }
    
    window.hideOverlay('game-overlay-gym');
    if (skip) window.closeWinContinue();
  };
  
  return { startGymGame: window.startGymGame, closeGym: window.closeGym };
})();
