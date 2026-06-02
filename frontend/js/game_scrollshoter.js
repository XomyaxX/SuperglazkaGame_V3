/* ═══════════════════════════════════════════════════════════
   SCROLL SHOOTER ADAPTER — обёртка для интеграции в Superglazka
   ═══════════════════════════════════════════════════════════ */
let scrollShooterModule = null;
let currentGame = null;

async function loadModule() {
  if (!scrollShooterModule) {
    scrollShooterModule = await import('./scrollshoter_game.js');
  }
  return scrollShooterModule;
}

window.scrollShooterRestart = async function(targetLevel) {
  // Called from inside the game when a level button is clicked
  // We close current instance and start fresh
  if (currentGame) {
    currentGame.destroy();
    currentGame = null;
  }
  const container = document.getElementById('game-container');
  if (container) container.innerHTML = '';
  document.getElementById('wave-clear-flash').style.display = 'none';
  document.getElementById('game-over').style.display = 'none';
  
  // Small delay to let DOM clear
  setTimeout(() => startScrollShooterGame(), 100);
};

window.startScrollShooterGame = async function() {
  console.log('[ScrollShooter] startScrollShooterGame called');
  const mod = await loadModule();
  const { GameRunner } = mod;
  
  const overlay = document.getElementById('game-overlay-scrollshoter');
  if (overlay) overlay.classList.add('visible');
  
  // Ensure container exists
  let container = document.getElementById('game-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'game-container';
    overlay.appendChild(container);
  }
  container.innerHTML = '';
  
  // Reset UI overlays
  const flash = document.getElementById('wave-clear-flash');
  const go = document.getElementById('game-over');
  const hud = document.getElementById('boss-hud');
  if (flash) { flash.innerHTML = ''; flash.style.display = 'none'; flash.style.pointerEvents = 'none'; }
  if (go) go.style.display = 'none';
  if (hud) hud.style.display = 'block';
  
  // Patch prototype methods for integration
  const originalLevelWin = GameRunner.prototype.levelWin;
  GameRunner.prototype.levelWin = function() {
    this.state.isLevelWon = true;
    const hudEl = document.getElementById('boss-hud');
    if (hudEl) hudEl.style.display = 'none';
    
    const nextWave = this.state.wave + 1;
    if (nextWave > this.state.unlockedWave) {
      this.state.unlockedWave = nextWave;
      localStorage.setItem('scrollshoter_unlocked_wave', this.state.unlockedWave);
    }
    localStorage.setItem('scrollshoter_wave', nextWave);
    localStorage.setItem('scrollshoter_shooters', this.state.shooters);
    localStorage.setItem('scrollshoter_firerate', this.state.fireRate);
    
    const flashEl = document.getElementById('wave-clear-flash');
    if (flashEl) {
      let buttonsHTML = '';
      for (let i = 1; i <= this.state.unlockedWave; i++) {
        const isCurrent = i === nextWave;
        const btnColor = isCurrent ? '#00ff88' : '#00ffff';
        buttonsHTML += `<button class="menu-level-btn" data-level="${i}" style="
          background: rgba(20, 0, 40, 0.8); border: 2px solid ${btnColor}; color: ${btnColor}; 
          padding: 10px 20px; font-size: 18px; font-weight: bold; cursor: pointer;
          margin: 5px; border-radius: 5px; text-transform: uppercase; transition: 0.2s; pointer-events: auto;
        ">Уровень ${i}</button>`;
      }
      flashEl.innerHTML = `
        <div style="background: rgba(10, 0, 20, 0.95); padding: 30px; border-radius: 15px; border: 2px solid #00ff88; box-shadow: 0 0 30px #00ff88; text-align: center;">
          <div style="font-size: 36px; color: #00ff88; text-shadow: 0 0 15px #00ff88; margin-bottom: 15px;">УРОВЕНЬ ${this.state.wave} ПРОЙДЕН!</div>
          <div style="font-size: 18px; color: #ffffff; margin-bottom: 25px;">Прогресс сохранен в кэш.<br>Выберите уровень для игры:</div>
          <div style="display: flex; flex-wrap: wrap; justify-content: center; max-width: 500px; margin: 0 auto;">
            ${buttonsHTML}
          </div>
        </div>
      `;
      flashEl.style.pointerEvents = 'auto';
      flashEl.style.display = 'block';
      
      flashEl.querySelectorAll('.menu-level-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const targetLevel = e.target.getAttribute('data-level');
          localStorage.setItem('scrollshoter_wave', targetLevel);
          if (typeof window.scrollShooterRestart === 'function') {
            window.scrollShooterRestart(targetLevel);
          } else {
            location.reload();
          }
        });
      });
    }
    
    // Integration with Superglazka systems
    const score = this.state.wave * 100 + Math.floor(this.state.shooters) * 10;
    if (typeof PlayerProfile !== 'undefined') {
      PlayerProfile.completeGame('scrollshoter', score);
      PlayerProfile.addCoins(score);
    }
    if (typeof Leaderboard !== 'undefined') {
      Leaderboard.recordScore('scrollshoter', score);
    }
    if (typeof Achievements !== 'undefined' && Achievements.check) {
      Achievements.check('game', 'scrollshoter');
    }
    if (typeof GameDifficulty !== 'undefined') {
      GameDifficulty.increaseLevel('scrollshoter');
    }
    if (typeof Haptic !== 'undefined') {
      Haptic.vibrateSuccess();
    }
    if (typeof trackEvent === 'function') {
      trackEvent('game_completed', { game_type: 'scrollshoter', score: score, wave: this.state.wave });
    }
  };
  
  const originalGameOver = GameRunner.prototype.gameOver;
  GameRunner.prototype.gameOver = function() {
    this.state.isGameOver = true;
    const hudEl = document.getElementById('boss-hud');
    if (hudEl) hudEl.style.display = 'none';
    const goEl = document.getElementById('game-over');
    if (goEl) {
      goEl.style.display = 'block';
      const fw = document.getElementById('final-wave');
      if (fw) fw.innerText = `База пала на ${this.state.wave} уровне`;
    }
    
    const score = this.state.wave * 50;
    if (typeof PlayerProfile !== 'undefined') {
      PlayerProfile.completeGame('scrollshoter', score);
      PlayerProfile.addCoins(score);
    }
    if (typeof Leaderboard !== 'undefined') {
      Leaderboard.recordScore('scrollshoter', score);
    }
    if (typeof Haptic !== 'undefined') {
      Haptic.vibratePattern([50, 100, 50]);
    }
    if (typeof trackEvent === 'function') {
      trackEvent('game_completed', { game_type: 'scrollshoter', score: score, wave: this.state.wave, gameover: true });
    }
  };
  
  currentGame = new GameRunner();
};

window.closeScrollShooter = function(skip) {
  console.log('[ScrollShooter] closeScrollShooter called');
  if (currentGame) {
    currentGame.destroy();
    currentGame = null;
  }
  const container = document.getElementById('game-container');
  if (container) container.innerHTML = '';
  
  const overlay = document.getElementById('game-overlay-scrollshoter');
  if (overlay) overlay.classList.remove('visible');
  
  const flash = document.getElementById('wave-clear-flash');
  const go = document.getElementById('game-over');
  if (flash) { flash.innerHTML = ''; flash.style.display = 'none'; }
  if (go) go.style.display = 'none';
  
  if (skip) {
    if (typeof trackEvent === 'function') trackEvent('game_skipped', { game_type: 'scrollshoter' });
    if (typeof App !== 'undefined') setTimeout(() => App.advanceFromGame(), 300);
  }
};

window.closeScrollShooterContinue = function() {
  closeScrollShooter();
  setTimeout(() => {
    if (typeof App !== 'undefined') App.advanceFromGame();
  }, 300);
};
