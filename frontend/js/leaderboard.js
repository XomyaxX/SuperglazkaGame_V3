/* Local leaderboard (top-5 per game, weekly + all-time) */
(function() {
  'use strict';

  var STORAGE_KEY = 'superglazka_leaderboard';

  function getCurrentWeek() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    var yearStart = new Date(d.getFullYear(), 0, 1);
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getFullYear() + '-W' + weekNo;
  }

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { weekly: {}, allTime: {} };
    } catch (e) {
      return { weekly: {}, allTime: {} };
    }
  }

  function saveData(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function getNickname() {
    try {
      var p = localStorage.getItem('superglazka_profile');
      if (p) return JSON.parse(p).nickname || 'Игрок';
    } catch (e) {}
    return 'Игрок';
  }

  function recordScore(game, score) {
    var data = loadData();
    var week = getCurrentWeek();
    var name = getNickname();
    var entry = { name: name, score: score, date: new Date().toISOString() };

    // Weekly
    if (!data.weekly[week]) data.weekly[week] = {};
    if (!data.weekly[week][game]) data.weekly[week][game] = [];
    data.weekly[week][game].push(entry);
    data.weekly[week][game].sort(function(a, b) { return b.score - a.score; });
    data.weekly[week][game] = data.weekly[week][game].slice(0, 10);

    // All-time
    if (!data.allTime[game]) data.allTime[game] = [];
    data.allTime[game].push(entry);
    data.allTime[game].sort(function(a, b) { return b.score - a.score; });
    data.allTime[game] = data.allTime[game].slice(0, 20);

    saveData(data);
  }

  function getTop5(game, mode) {
    var data = loadData();
    var list;
    if (mode === 'weekly') {
      var week = getCurrentWeek();
      list = (data.weekly[week] && data.weekly[week][game]) || [];
    } else {
      list = data.allTime[game] || [];
    }
    return list.slice(0, 5);
  }

  function renderList(container, list) {
    if (!list.length) {
      container.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.5);padding:16px;">Пока нет рекордов</div>';
      return;
    }
    container.innerHTML = list.map(function(item, i) {
      var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">' +
        '<span style="font-weight:700;">' + medal + ' ' + escapeHtml(item.name) + '</span>' +
        '<span style="color:var(--neon-cyan);font-weight:800;">' + item.score + '</span>' +
        '</div>';
    }).join('');
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showModal(game) {
    var existing = document.getElementById('leaderboard-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'leaderboard-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(8px);';

    var gameNames = {
      runner: 'Погоня',
      gym: 'Битва с Ленивусом',
      blink: 'Моргайка',
      peripheral: 'Периферийный охотник',
      scrollshoter: 'Скролл-шутер'
    };
    var gameName = gameNames[game] || game;

    modal.innerHTML = '<div style="background:var(--bg-glass);border:1px solid rgba(255,255,255,0.1);border-radius:var(--radius-lg);padding:24px;width:90%;max-width:360px;max-height:80vh;overflow-y:auto;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
      '<h3 style="margin:0;font-size:18px;font-weight:800;">🏆 ' + escapeHtml(gameName) + '</h3>' +
      '<button id="lb-close" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
      '<button id="lb-weekly" class="lb-tab active" style="flex:1;padding:6px 12px;border-radius:50px;border:none;background:var(--gradient-primary);color:#fff;font-weight:700;font-size:12px;cursor:pointer;">Неделя</button>' +
      '<button id="lb-alltime" class="lb-tab" style="flex:1;padding:6px 12px;border-radius:50px;border:none;background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);font-weight:700;font-size:12px;cursor:pointer;">Всё время</button>' +
      '</div>' +
      '<div id="lb-list"></div>' +
      '</div>';

    document.body.appendChild(modal);

    var listContainer = modal.querySelector('#lb-list');
    var mode = 'weekly';

    function refresh() {
      renderList(listContainer, getTop5(game, mode));
      var wBtn = modal.querySelector('#lb-weekly');
      var aBtn = modal.querySelector('#lb-alltime');
      if (mode === 'weekly') {
        wBtn.style.background = 'var(--gradient-primary)';
        wBtn.style.color = '#fff';
        aBtn.style.background = 'rgba(255,255,255,0.08)';
        aBtn.style.color = 'rgba(255,255,255,0.6)';
      } else {
        aBtn.style.background = 'var(--gradient-primary)';
        aBtn.style.color = '#fff';
        wBtn.style.background = 'rgba(255,255,255,0.08)';
        wBtn.style.color = 'rgba(255,255,255,0.6)';
      }
    }

    modal.querySelector('#lb-close').onclick = function() { modal.remove(); };
    modal.querySelector('#lb-weekly').onclick = function() { mode = 'weekly'; refresh(); };
    modal.querySelector('#lb-alltime').onclick = function() { mode = 'alltime'; refresh(); };
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

    refresh();
  }

  window.Leaderboard = { recordScore, getTop5, showModal, getCurrentWeek };
})();
