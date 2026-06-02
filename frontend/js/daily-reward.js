/**
 * Daily Reward system for Superglazka
 * Tracks streak and gives coins for daily visits.
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'superglazka_daily';
  var REWARDS = [10, 15, 20, 25, 30, 50, 50];

  function getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function daysBetween(a, b) {
    var d1 = new Date(a);
    var d2 = new Date(b);
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function getRewardForStreak(streak) {
    var idx = Math.max(0, streak - 1);
    return REWARDS[Math.min(idx, REWARDS.length - 1)] || 10;
  }

  function getStatus() {
    var data = load();
    var today = getToday();
    var lastDate = data.lastDate;
    var streak = data.streak || 0;
    var claimedToday = false;

    if (lastDate === today) {
      claimedToday = data.claimed || false;
    } else if (lastDate) {
      var diff = daysBetween(lastDate, today);
      if (diff === 1) {
        // streak continues, can claim
      } else if (diff > 1) {
        streak = 0;
      }
    } else {
      streak = 0;
    }

    var canClaim = !claimedToday;
    var nextStreak = claimedToday ? streak : (streak + 1);
    var reward = getRewardForStreak(nextStreak);

    return { streak: streak, nextStreak: nextStreak, canClaim: canClaim, claimedToday: claimedToday, reward: reward, today: today };
  }

  function claim() {
    var status = getStatus();
    if (status.claimedToday) return null;

    var data = load();
    var today = getToday();

    if (data.lastDate) {
      var diff = daysBetween(data.lastDate, today);
      if (diff === 1) {
        data.streak = (data.streak || 0) + 1;
      } else {
        data.streak = 1;
      }
    } else {
      data.streak = 1;
    }

    data.lastDate = today;
    data.claimed = true;
    save(data);

    var reward = getRewardForStreak(data.streak);

    // Add coins
    if (typeof PlayerProfile !== 'undefined' && PlayerProfile.addCoins) {
      PlayerProfile.addCoins(reward);
    }

    // Sync to server
    try {
      var authData = JSON.parse(localStorage.getItem('superglazka_auth') || '{}');
      var headers = { 'Content-Type': 'application/json' };
      if (authData.type === 'guest' && authData.token) {
        headers['X-Guest-Token'] = authData.token;
      } else if (authData.type === 'user' && authData.token) {
        headers['Authorization'] = 'Bearer ' + authData.token;
      }
      if (authData.token) {
        fetch('/api/daily/claim', { method: 'POST', headers: headers }).catch(function(){});
      }
    } catch (e) {}

    return { streak: data.streak, reward: reward };
  }

  function injectStyles() {
    if (document.getElementById('daily-reward-styles')) return;
    var style = document.createElement('style');
    style.id = 'daily-reward-styles';
    style.textContent =
      '.daily-modal{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);opacity:0;pointer-events:none;transition:opacity .3s;}' +
      '.daily-modal.visible{opacity:1;pointer-events:auto;}' +
      '.daily-panel{background:linear-gradient(180deg,#1a0b2e,#2d1b4e);border:1px solid rgba(192,132,252,0.25);' +
      'border-radius:24px;padding:32px 28px;max-width:380px;width:90%;text-align:center;' +
      'box-shadow:0 24px 64px rgba(0,0,0,0.5);transform:scale(.9);transition:transform .3s cubic-bezier(.34,1.56,.64,1);}' +
      '.daily-modal.visible .daily-panel{transform:scale(1);}' +
      '.daily-title{font-family:Comfortaa,cursive;font-size:24px;color:#fff;margin-bottom:4px;}' +
      '.daily-sub{font-size:14px;color:rgba(255,255,255,0.55);margin-bottom:20px;}' +
      '.daily-streak{font-size:18px;font-weight:800;color:#fbbf24;margin-bottom:16px;}' +
      '.daily-calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:20px;}' +
      '.daily-day{background:rgba(255,255,255,0.06);border-radius:10px;padding:10px 4px;text-align:center;}' +
      '.daily-day.done{background:rgba(192,132,252,0.15);border:1px solid rgba(192,132,252,0.3);}' +
      '.daily-day-num{font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:4px;}' +
      '.daily-day-coin{font-size:14px;font-weight:800;color:#fff;}' +
      '.daily-btn{display:inline-block;padding:14px 36px;border:none;border-radius:24px;' +
      'background:linear-gradient(135deg,#c084fc,#e879f9);color:#fff;font-weight:800;font-size:16px;' +
      'cursor:pointer;transition:all .25s;}' +
      '.daily-btn:hover{transform:scale(1.04);box-shadow:0 8px 24px rgba(192,132,252,0.3);}' +
      '.daily-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none;}' +
      '.daily-close{position:absolute;top:16px;right:16px;background:none;border:none;color:rgba(255,255,255,0.5);' +
      'font-size:24px;cursor:pointer;}' +
      '.daily-close:hover{color:#fff;}' +
      '.daily-claimed{font-size:16px;font-weight:700;color:#4ade80;margin-top:8px;}';
    document.head.appendChild(style);
  }

  function showModal() {
    var status = getStatus();
    if (status.claimedToday && !window.__forceDailyModal) return;

    injectStyles();

    var existing = document.getElementById('dailyRewardModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'dailyRewardModal';
    modal.className = 'daily-modal';

    var daysHtml = '';
    for (var i = 0; i < 7; i++) {
      var dayNum = i + 1;
      var isDone = i < status.streak;
      var dayReward = REWARDS[i] || 50;
      daysHtml += '<div class="daily-day ' + (isDone ? 'done' : '') + '">' +
        '<div class="daily-day-num">' + (window.I18n ? I18n.t('daily.day') : 'День') + ' ' + dayNum + '</div>' +
        '<div class="daily-day-coin">' + dayReward + '🪙</div>' +
      '</div>';
    }

    modal.innerHTML = '<div class="daily-panel" style="position:relative;">' +
      '<button class="daily-close" id="dailyClose">✕</button>' +
      '<div class="daily-title">' + (window.I18n ? I18n.t('daily.title') : '🎁 Ежедневная награда') + '</div>' +
      '<div class="daily-sub">' + (window.I18n ? I18n.t('daily.subtitle') : 'Заходи каждый день и получай монеты!') + '</div>' +
      '<div class="daily-streak">🔥 ' + (window.I18n ? I18n.t('daily.streak', {count: status.streak}) : 'Streak: ' + status.streak + ' дней') + '</div>' +
      '<div class="daily-calendar">' + daysHtml + '</div>' +
      (status.claimedToday
        ? '<div class="daily-claimed">' + (window.I18n ? I18n.t('daily.claimed') : '✅ Вы уже забрали награду сегодня. Приходи завтра!') + '</div>'
        : '<button class="daily-btn" id="dailyClaimBtn">' + (window.I18n ? I18n.t('daily.claim', {amount: status.reward}) : 'Забрать ' + status.reward + ' 🪙') + '</button>'
      ) +
    '</div>';

    document.body.appendChild(modal);

    requestAnimationFrame(function() {
      modal.classList.add('visible');
    });

    var closeBtn = document.getElementById('dailyClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        modal.classList.remove('visible');
        setTimeout(function() { modal.remove(); }, 300);
      });
    }

    var claimBtn = document.getElementById('dailyClaimBtn');
    if (claimBtn) {
      claimBtn.addEventListener('click', function() {
        var result = claim();
        if (result) {
          claimBtn.outerHTML = '<div class="daily-claimed">' + (window.I18n ? I18n.t('daily.received', {amount: result.reward, streak: result.streak}) : '🎉 Получено ' + result.reward + ' монет! Streak: ' + result.streak) + '</div>';
          // Re-render calendar
          showModal();
          document.getElementById('dailyRewardModal').classList.add('visible');
        }
      });
    }

    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.classList.remove('visible');
        setTimeout(function() { modal.remove(); }, 300);
      }
    });
  }

  function init() {
    var status = getStatus();
    if (status.canClaim) {
      // Delay slightly to let app load
      setTimeout(showModal, 1500);
    }
  }

  window.DailyReward = { init, showModal, getStatus, claim };
})();
