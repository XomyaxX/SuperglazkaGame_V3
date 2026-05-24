/**
 * Achievements system for Superglazka
 * Checks and unlocks achievements based on player actions.
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'superglazka_achievements';
  var ACHIEVEMENTS_LIST = [
    { key: 'first_step', titleKey: 'achievements.first_step', descKey: 'achievements.first_step_desc', icon: '🦶', type: 'frame', value: '1', reward: 10 },
    { key: 'pixel_hunter', titleKey: 'achievements.pixel_hunter', descKey: 'achievements.pixel_hunter_desc', icon: '🏃', type: 'game', value: 'runner', reward: 50 },
    { key: 'eye_gymnast', titleKey: 'achievements.eye_gymnast', descKey: 'achievements.eye_gymnast_desc', icon: '👁️', type: 'game_count', value: 'gym', count: 3, reward: 100 },
    { key: 'blinker', titleKey: 'achievements.blinker', descKey: 'achievements.blinker_desc', icon: '✨', type: 'game', value: 'blink', reward: 50 },
    { key: 'tracker', titleKey: 'achievements.tracker', descKey: 'achievements.tracker_desc', icon: '🔮', type: 'game', value: 'tracker', reward: 50 },
    { key: 'bookworm', titleKey: 'achievements.bookworm', descKey: 'achievements.bookworm_desc', icon: '📖', type: 'episode', value: '1', reward: 100 },
    { key: 'librarian', titleKey: 'achievements.librarian', descKey: 'achievements.librarian_desc', icon: '📚', type: 'episode_all', reward: 200 },
    { key: 'rich', titleKey: 'achievements.rich', descKey: 'achievements.rich_desc', icon: '💰', type: 'coins', value: '500', reward: 100 }
  ];

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function saveLocal(ids) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }

  function showToast(achievement) {
    var toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = '<div class="achievement-toast-icon">' + achievement.icon + '</div>' +
      '<div class="achievement-toast-body">' +
        '<div class="achievement-toast-title">🏆 Достижение разблокировано!</div>' +
        '<div class="achievement-toast-name">' + achievement.title + '</div>' +
        '<div class="achievement-toast-reward">+' + achievement.reward + ' 🪙</div>' +
      '</div>';
    document.body.appendChild(toast);
    requestAnimationFrame(function() { toast.classList.add('visible'); });
    setTimeout(function() {
      toast.classList.remove('visible');
      setTimeout(function() { toast.remove(); }, 400);
    }, 3500);
  }

  function injectStyles() {
    if (document.getElementById('achievement-styles')) return;
    var style = document.createElement('style');
    style.id = 'achievement-styles';
    style.textContent =
      '.achievement-toast{position:fixed;top:24px;right:24px;z-index:9999;' +
      'display:flex;align-items:center;gap:14px;padding:16px 20px;' +
      'background:linear-gradient(135deg,#1a0b2e,#2d1b4e);' +
      'border:1px solid rgba(192,132,252,0.3);border-radius:16px;' +
      'box-shadow:0 12px 32px rgba(0,0,0,0.4);' +
      'transform:translateX(120%);opacity:0;transition:all .4s cubic-bezier(.34,1.56,.64,1);' +
      'max-width:320px;font-family:Nunito,sans-serif;}' +
      '.achievement-toast.visible{transform:translateX(0);opacity:1;}' +
      '.achievement-toast-icon{font-size:36px;line-height:1;}' +
      '.achievement-toast-title{font-size:12px;font-weight:700;color:#c084fc;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px;}' +
      '.achievement-toast-name{font-size:16px;font-weight:800;color:#fff;margin-bottom:4px;}' +
      '.achievement-toast-reward{font-size:13px;font-weight:700;color:#fbbf24;}' +
      '.achievements-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-top:16px;}' +
      '.achievement-badge{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:16px;padding:16px;text-align:center;transition:all .25s;opacity:.4;}' +
      '.achievement-badge.unlocked{opacity:1;border-color:rgba(192,132,252,0.3);background:rgba(192,132,252,0.08);}' +
      '.achievement-badge-icon{font-size:32px;margin-bottom:8px;line-height:1;}' +
      '.achievement-badge-title{font-size:13px;font-weight:700;color:#fff;margin-bottom:4px;}' +
      '.achievement-badge-desc{font-size:11px;color:rgba(255,255,255,0.5);line-height:1.4;}' +
      '.achievement-badge-reward{font-size:12px;font-weight:700;color:#fbbf24;margin-top:6px;}';
    document.head.appendChild(style);
  }

  function unlock(achievement) {
    var unlocked = loadLocal();
    if (unlocked.indexOf(achievement.key) !== -1) return;
    unlocked.push(achievement.key);
    saveLocal(unlocked);

    // Add coins
    if (typeof PlayerProfile !== 'undefined' && PlayerProfile.addCoins) {
      PlayerProfile.addCoins(achievement.reward);
    }

    // Show toast
    injectStyles();
    showToast(achievement);

    // Sync to server (best effort)
    try {
      var token = localStorage.getItem('superglazka_guest_token') || '';
      fetch('/api/achievements/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Guest-Token': token },
        body: JSON.stringify({ type: achievement.type, value: achievement.value, count: achievement.count || 1 })
      }).catch(function(){});
    } catch (e) {}
  }

  function check(type, value, count) {
    ACHIEVEMENTS_LIST.forEach(function(ach) {
      if (ach.type !== type) return;
      var shouldUnlock = false;
      if (type === 'game' && ach.value === value) shouldUnlock = true;
      else if (type === 'game_count' && ach.value === value && (count || 1) >= (ach.count || 1)) shouldUnlock = true;
      else if (type === 'episode' && (count || 1) >= parseInt(ach.value || '1', 10)) shouldUnlock = true;
      else if (type === 'episode_all') {
        // Check if all episodes completed
        var prog = (typeof PlayerProfile !== 'undefined' && PlayerProfile.getProgress) ? PlayerProfile.getProgress() : {};
        var eps = prog.episodes || {};
        var allDone = Object.keys(eps).length > 0 && Object.values(eps).every(function(e) { return e.completed; });
        if (allDone) shouldUnlock = true;
      }
      else if (type === 'frame' && (count || 1) >= parseInt(ach.value || '1', 10)) shouldUnlock = true;
      else if (type === 'coins' && (count || 0) >= parseInt(ach.value || '0', 10)) shouldUnlock = true;

      if (shouldUnlock) unlock(ach);
    });
  }

  function getUnlocked() {
    return loadLocal();
  }

  function renderGrid(container) {
    if (!container) return;
    injectStyles();
    var unlocked = loadLocal();
    container.innerHTML = '<h3 style="font-family:Comfortaa,cursive;font-size:18px;color:#fff;margin-bottom:12px;">' + (window.I18n ? I18n.t('achievements.title') : '🏆 Достижения') + '</h3>' +
      '<div class="achievements-grid">' +
      ACHIEVEMENTS_LIST.map(function(a) {
        var isUnlocked = unlocked.indexOf(a.key) !== -1;
        return '<div class="achievement-badge ' + (isUnlocked ? 'unlocked' : '') + '">' +
          '<div class="achievement-badge-icon">' + a.icon + '</div>' +
          '<div class="achievement-badge-title">' + (window.I18n ? I18n.t(a.titleKey) : a.title) + '</div>' +
          '<div class="achievement-badge-desc">' + (window.I18n ? I18n.t(a.descKey) : a.desc) + '</div>' +
          '<div class="achievement-badge-reward">+' + a.reward + ' 🪙</div>' +
        '</div>';
      }).join('') +
      '</div>';
  }

  window.Achievements = { check, getUnlocked, renderGrid };
})();
