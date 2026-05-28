/**
 * Progressive Difficulty System for Superglazka mini-games
 * Difficulty increases automatically after each victory.
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'superglazka_difficulty';
  var MAX_LEVEL = 20;

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getLevel(game) {
    var data = load();
    return Math.min(MAX_LEVEL, Math.max(1, data[game] || 1));
  }

  function increaseLevel(game) {
    var data = load();
    var current = data[game] || 1;
    if (current < MAX_LEVEL) {
      data[game] = current + 1;
      save(data);
    }
    return data[game] || 1;
  }

  function resetLevel(game) {
    var data = load();
    data[game] = 1;
    save(data);
  }

  /**
   * Get difficulty configuration for a specific game and level.
   * @param {string} game - 'runner' | 'blink' | 'gym' | 'peripheral'
   * @param {number} [level] - optional override level
   */
  function getConfig(game, level) {
    try {
      var lv = level || getLevel(game);
      console.log('[GameDifficulty] getConfig', game, 'level', lv);
      switch (game) {
        case 'runner': return getRunnerConfig(lv);
        case 'blink':  return getBlinkConfig(lv);
        case 'gym':    return getGymConfig(lv);
        case 'peripheral':return getPeripheralConfig(lv);
        default: return {};
      }
    } catch (e) {
      console.error('[GameDifficulty] getConfig failed', game, e);
      return {};
    }
  }

  // ─── RUNNER ───
  function getRunnerConfig(lv) {
    return {
      level: lv,
      speedBase: 3 + (lv - 1) * 0.35,
      speedCap: Math.min(10, 6 + (lv - 1) * 0.4),
      speedIncrement: 0.001 + (lv - 1) * 0.0002,
      spawnIntervalBase: Math.max(35, 90 - (lv - 1) * 8),
      spawnIntervalVar: Math.max(20, 60 - (lv - 1) * 4),
      targetDist: 2000 + (lv - 1) * 300,
      lives: Math.max(1, 4 - Math.floor((lv - 1) / 5)),
      bonusChance: Math.max(0.03, 0.1 - (lv - 1) * 0.005),
      gravity: 0.6 + (lv - 1) * 0.02,
      doubleJump: lv <= 3, // отключаем двойной прыжок на высоких уровнях
      obstacleTypes: getRunnerObstacles(lv)
    };
  }
  function getRunnerObstacles(lv) {
    var base = ['can','cup','vase','sugar'];
    if (lv >= 3) base.push('book');
    if (lv >= 5) base.push('phone');
    if (lv >= 8) base.push('tablet');
    return base;
  }

  // ─── BLINK ───
  function getBlinkConfig(lv) {
    return {
      level: lv,
      targetClicks: 6 + lv * 2,
      round1Time: Math.max(2500, 6000 - lv * 350),
      round2Hold: Math.max(1200, 3500 - lv * 220),
      round3ZoneMin: Math.max(22, 45 - lv * 2),
      round3ZoneMax: Math.max(42, 65 - lv * 2),
      round3Speed: 0.05 + lv * 0.012,
      maxRounds: Math.min(5, 3 + Math.floor((lv - 1) / 4))
    };
  }

  // ─── GYM ───
  function getGymConfig(lv) {
    return {
      level: lv,
      targets: {
        laser: Math.min(16, 6 + lv * 2),
        aim: Math.min(12, 4 + lv),
        tears: Math.min(10, 3 + lv)
      },
      chargeTime: {
        laser: Math.max(800, 2500 - lv * 180),
        aim: Math.max(600, 1800 - lv * 120),
        tear: Math.min(12, 4 + Math.floor(lv / 2))
      },
      aimHitbox: Math.max(10, 26 - lv),
      aimDecay: 20 + lv * 4,
      aimTransition: Math.max(0.3, 0.9 - lv * 0.06),
      laserThreshold: Math.min(98, 85 + lv),
      bossHp: 100 + (lv - 1) * 30,
      cooldowns: {
        laser: Math.max(300, 900 - lv * 60),
        aim: Math.max(400, 1100 - lv * 70),
        tears: Math.max(500, 1300 - lv * 80)
      }
    };
  }

  // ─── PERIPHERAL HUNTER ───
  function getPeripheralConfig(lv) {
    return {
      level: lv,
      duration: Math.max(30000, 65000 - lv * 1500),
      lives: Math.max(1, 4 - Math.floor((lv - 1) / 5)),
      spawnMin: Math.max(300, 1100 - lv * 70),
      spawnMax: Math.max(500, 2000 - lv * 120),
      targetLifetime: Math.max(1200, 3200 - lv * 160),
      trapChance: lv >= 3 ? Math.min(0.35, 0.05 + (lv - 3) * 0.04) : 0,
      movingChance: lv >= 2 ? Math.min(0.3, 0.08 + (lv - 2) * 0.03) : 0,
      fadingChance: lv >= 4 ? Math.min(0.25, 0.05 + (lv - 4) * 0.03) : 0,
      goldenChance: lv >= 5 ? Math.min(0.15, 0.02 + (lv - 5) * 0.02) : 0,
      maxActive: Math.min(7, 2 + Math.floor(lv / 2)),
      showHint: lv <= 2
    };
  }

  window.GameDifficulty = {
    getLevel,
    increaseLevel,
    resetLevel,
    getConfig,
    MAX_LEVEL
  };
})();
