/**
 * Player Profile — manages coins, episode progress and game stats.
 * All data is persisted in localStorage under `superglazka_profile`.
 * @namespace PlayerProfile
 */
const PlayerProfile = (function() {
  'use strict';

  const STORAGE_KEY = 'superglazka_profile';

  /** @returns {Object} Default empty profile */
  function getDefaultProfile() {
    return {
      nickname: 'Игрок',
      coins: 0,
      episodes: {
        1: { completed: false, framesSeen: 0, maxFrame: -1 },
        2: { completed: false, framesSeen: 0, maxFrame: -1 },
        3: { completed: false, framesSeen: 0, maxFrame: -1 }
      },
      games: {
        blink: { played: 0, bestScore: 0 },
        tracker: { played: 0, bestScore: 0 },
        runner: { played: 0, bestScore: 0 },
        gym: { played: 0, bestScore: 0 }
      }
    };
  }

  /** @returns {Object} Parsed profile from localStorage or default */
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getDefaultProfile();
      const parsed = JSON.parse(raw);
      // Merge with defaults in case new fields were added
      const merged = { ...getDefaultProfile(), ...parsed };
      // Migrate old episode data: add maxFrame if missing
      for (const id of Object.keys(merged.episodes)) {
        if (typeof merged.episodes[id].maxFrame === 'undefined') {
          merged.episodes[id].maxFrame = -1;
        }
      }
      return merged;
    } catch (e) {
      console.warn('Profile load failed, using default');
      return getDefaultProfile();
    }
  }

  /** @param {Object} profile - Profile object to persist */
  function save(profile) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('Profile save failed');
    }
  }

  /** @param {number} amount - Coins to add @returns {number} New coin balance */
  function addCoins(amount) {
    const p = load();
    p.coins += Math.max(0, amount);
    save(p);
    renderBadge();
    return p.coins;
  }

  /** @param {number} amount - Coins to spend @returns {boolean} Whether purchase succeeded */
  function spendCoins(amount) {
    const p = load();
    if (p.coins < amount) return false;
    p.coins -= amount;
    save(p);
    renderBadge();
    return true;
  }

  /** @param {string|number} epId - Episode identifier */
  function completeEpisode(epId) {
    const p = load();
    if (!p.episodes[epId]) p.episodes[epId] = { completed: false, framesSeen: 0, maxFrame: -1 };
    p.episodes[epId].completed = true;
    save(p);
    renderBadge();
  }

  /** @param {string|number} epId - Episode identifier @param {number} frameIdx - Zero-based frame index */
  function markFrameSeen(epId, frameIdx) {
    const p = load();
    if (!p.episodes[epId]) p.episodes[epId] = { completed: false, framesSeen: 0, maxFrame: -1 };
    if (frameIdx > p.episodes[epId].maxFrame) {
      p.episodes[epId].maxFrame = frameIdx;
    }
    save(p);
  }

  /** @param {string|number} epId - Episode identifier @returns {Object} Episode progress */
  function getProgress(epId) {
    const p = load();
    return p.episodes[epId] || { completed: false, framesSeen: 0, maxFrame: -1 };
  }

  /** @returns {{episodeId:string, frameIdx:number}|null} Last viewed position */
  function getLastPosition() {
    const p = load();
    let lastEp = null, lastFrame = -1;
    for (const [id, data] of Object.entries(p.episodes)) {
      if (data.maxFrame > lastFrame) {
        lastFrame = data.maxFrame;
        lastEp = id;
      }
    }
    return lastEp ? { episodeId: lastEp, frameIdx: lastFrame } : null;
  }

  function completeGame(name, score) {
    const p = load();
    if (!p.games[name]) p.games[name] = { played: 0, bestScore: 0 };
    p.games[name].played += 1;
    if (score > p.games[name].bestScore) {
      p.games[name].bestScore = score;
    }
    save(p);
    renderBadge();
  }

  function getProfile() {
    return load();
  }

  function setNickname(name) {
    const p = load();
    p.nickname = (name || 'Игрок').trim().substring(0, 20);
    save(p);
    renderBadge();
  }

  /* ─── UI ─── */
  function renderBadge() {
    const p = load();
    document.querySelectorAll('.profile-coins-val').forEach(badge => {
      badge.textContent = p.coins;
    });
  }

  function openModal() {
    const p = load();
    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    const nicknameInput = modal.querySelector('.profile-nickname');
    if (nicknameInput) nicknameInput.value = p.nickname;

    const coinsEl = modal.querySelector('.profile-coins-big');
    if (coinsEl) coinsEl.textContent = p.coins;

    // Episode list
    const epList = modal.querySelector('.profile-episodes');
    if (epList) {
      epList.textContent = '';
      const names = { 1: 'Рождение героини', 2: 'Кто я?', 3: 'Великая битва' };
      Object.entries(p.episodes).forEach(([id, data]) => {
        const row = document.createElement('div');
        row.className = 'profile-row';
        const left = document.createElement('span');
        left.textContent = 'Эпизод ' + id + ': ' + (names[id] || '');
        const right = document.createElement('span');
        right.textContent = data.completed ? '✅' : '🔒';
        row.appendChild(left);
        row.appendChild(right);
        epList.appendChild(row);
      });
    }

    // Games stats
    const gamesList = modal.querySelector('.profile-games');
    if (gamesList) {
      const names = { blink: 'Моргайка', tracker: 'Следи за шариком', runner: 'Погоня', gym: 'Ваня vs Ленивус' };
      gamesList.textContent = '';
      Object.entries(p.games).forEach(([name, data]) => {
        const row = document.createElement('div');
        row.className = 'profile-row';
        const left = document.createElement('span');
        left.textContent = names[name] || name;
        const right = document.createElement('span');
        right.textContent = 'Игр: ' + data.played + ' | Рекорд: ' + data.bestScore;
        row.appendChild(left);
        row.appendChild(right);
        gamesList.appendChild(row);
      });
    }

    modal.classList.add('visible');
  }

  function closeModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.remove('visible');
  }

  function init() {
    renderBadge();

    // Bind profile buttons (main menu + episode viewer)
    document.querySelectorAll('.profile-btn').forEach(btn => {
      btn.addEventListener('click', openModal);
    });

    // Bind close button inside modal
    const closeBtn = document.querySelector('.profile-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Bind nickname save
    const nickInput = document.querySelector('.profile-nickname');
    if (nickInput) {
      nickInput.addEventListener('change', (e) => setNickname(e.target.value));
      nickInput.addEventListener('blur', (e) => setNickname(e.target.value));
    }

    // Close on backdrop click
    const modal = document.getElementById('profile-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    addCoins,
    spendCoins,
    completeEpisode,
    completeGame,
    getProfile,
    setNickname,
    renderBadge,
    openModal,
    closeModal,
    markFrameSeen,
    getProgress,
    getLastPosition
  };
})();
