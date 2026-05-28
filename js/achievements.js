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
    { key: 'peripheral', titleKey: 'achievements.peripheral', descKey: 'achievements.peripheral_desc', icon: '🎯', type: 'game', value: 'peripheral', reward: 50 },
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
      // Toast
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
      // Modal grid
      '.achievements-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:20px;}' +
      '@media (max-width: 768px){.achievements-grid{grid-template-columns:repeat(2,1fr);gap:12px;}}' +
      // Badge card
      '.achievement-badge{' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'aspect-ratio:1/1;padding:20px;border-radius:20px;text-align:center;' +
        'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);' +
        'transition:all .25s ease;opacity:.35;filter:grayscale(100%);' +
      '}' +
      '.achievement-badge.unlocked{' +
        'opacity:1;filter:grayscale(0%);' +
        'background:linear-gradient(135deg,rgba(192,132,252,0.12),rgba(147,51,234,0.06));' +
        'border-color:rgba(192,132,252,0.35);' +
        'box-shadow:0 4px 20px rgba(192,132,252,0.15);' +
      '}' +
      '.achievement-badge-icon{font-size:32px;line-height:1;margin-bottom:10px;}' +
      '.achievement-badge.unlocked .achievement-badge-icon{font-size:48px;margin-bottom:8px;}' +
      '.achievement-badge-title{font-size:13px;font-weight:800;color:#fff;margin-bottom:4px;}' +
      '.achievement-badge-desc{font-size:11px;color:rgba(255,255,255,0.45);line-height:1.4;margin-bottom:6px;}' +
      '.achievement-badge-reward{font-size:13px;font-weight:700;color:#fbbf24;}' +
      // Menu button
      '.achievements-menu-btn{' +
        'background:none;border:none;font-size:22px;cursor:pointer;padding:6px 8px;' +
        'border-radius:12px;transition:all .2s;line-height:1;' +
      '}' +
      '.achievements-menu-btn:hover{background:rgba(255,255,255,0.08);transform:scale(1.1);}' +
      // Profile compact link
      '.profile-achievements-link{' +
        'display:flex;align-items:center;justify-content:space-between;' +
        'padding:12px 16px;background:rgba(255,255,255,0.04);' +
        'border:1px solid rgba(255,255,255,0.08);border-radius:14px;' +
        'cursor:pointer;transition:all .2s;color:#fff;' +
      '}' +
      '.profile-achievements-link:hover{background:rgba(255,255,255,0.08);border-color:rgba(192,132,252,0.25);}' +
      '.profile-achievements-link-text{font-size:14px;font-weight:700;}' +
      '.profile-achievements-link-arrow{color:#c084fc;font-size:14px;font-weight:700;}';
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
      var authData = JSON.parse(localStorage.getItem('superglazka_auth') || '{}');
      var headers = { 'Content-Type': 'application/json' };
      if (authData.type === 'guest' && authData.token) {
        headers['X-Guest-Token'] = authData.token;
      } else if (authData.type === 'user' && authData.token) {
        headers['Authorization'] = 'Bearer ' + authData.token;
      }
      if (authData.token) {
        fetch('/api/achievements/check', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ type: achievement.type, value: achievement.value, count: achievement.count || 1 })
        }).catch(function(){});
      }
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

  function getTitle(ach) {
    if (window.I18n && I18n.t) return I18n.t(ach.titleKey);
    return ach.titleKey;
  }
  function getDesc(ach) {
    if (window.I18n && I18n.t) return I18n.t(ach.descKey);
    return ach.descKey;
  }

  function renderGrid(container) {
    if (!container) return;
    injectStyles();
    var unlocked = loadLocal();
    container.innerHTML = ACHIEVEMENTS_LIST.map(function(a) {
      var isUnlocked = unlocked.indexOf(a.key) !== -1;
      return '<div class="achievement-badge ' + (isUnlocked ? 'unlocked' : '') + '">' +
        '<div class="achievement-badge-icon">' + a.icon + '</div>' +
        '<div class="achievement-badge-title">' + getTitle(a) + '</div>' +
        '<div class="achievement-badge-desc">' + getDesc(a) + '</div>' +
        '<div class="achievement-badge-reward">+' + a.reward + ' 🪙</div>' +
      '</div>';
    }).join('');
  }

  function renderCounter(el) {
    if (!el) return;
    var unlocked = loadLocal().length;
    var total = ACHIEVEMENTS_LIST.length;
    var text = (window.I18n && I18n.t)
      ? I18n.t('achievements.count', { current: unlocked, total: total })
      : unlocked + ' из ' + total;
    el.textContent = text;
  }

  function renderProfileLink(container) {
    if (!container) return;
    injectStyles();
    var unlocked = loadLocal().length;
    var total = ACHIEVEMENTS_LIST.length;
    var label = (window.I18n && I18n.t) ? I18n.t('achievements.title') : '🏆 Достижения';
    var text = (window.I18n && I18n.t)
      ? I18n.t('achievements.count', { current: unlocked, total: total })
      : unlocked + ' из ' + total;
    container.innerHTML = '<div class="profile-achievements-link" id="profileAchievementsLink">' +
      '<span class="profile-achievements-link-text">' + label + ' — ' + text + '</span>' +
      '<span class="profile-achievements-link-arrow">→</span>' +
    '</div>';
    var link = container.querySelector('#profileAchievementsLink');
    if (link) {
      link.addEventListener('click', function() {
        openModal();
      });
    }
  }

  function openModal() {
    injectStyles();
    var modal = document.getElementById('achievements-modal');
    var grid = document.getElementById('achievementsGrid');
    var counter = document.getElementById('achievementsCounter');
    if (!modal) return;
    renderGrid(grid);
    renderCounter(counter);
    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';

    // Close on overlay click
    modal.addEventListener('click', onOverlayClick);
    document.addEventListener('keydown', onKeyDown);
  }

  function closeModal() {
    var modal = document.getElementById('achievements-modal');
    if (!modal) return;
    modal.classList.remove('visible');
    document.body.style.overflow = '';
    modal.removeEventListener('click', onOverlayClick);
    document.removeEventListener('keydown', onKeyDown);
  }

  function onOverlayClick(e) {
    if (e.target === document.getElementById('achievements-modal')) {
      closeModal();
    }
  }
  function onKeyDown(e) {
    if (e.key === 'Escape') closeModal();
  }

  window.Achievements = { check, getUnlocked, renderGrid, renderProfileLink, openModal, closeModal };
})();
