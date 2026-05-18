/* ═══════════════════════════════════════════════════════════
   PLAYER PROFILE — Coins, Stats & Progress
   ═══════════════════════════════════════════════════════════ */
const PlayerProfile = (function() {
  'use strict';

  const STORAGE_KEY = 'superglazka_profile';

  function getDefaultProfile() {
    return {
      nickname: 'Игрок',
      coins: 0,
      episodes: {
        1: { completed: false, framesSeen: 0 },
        2: { completed: false, framesSeen: 0 },
        3: { completed: false, framesSeen: 0 }
      },
      games: {
        blink: { played: 0, bestScore: 0 },
        tracker: { played: 0, bestScore: 0 },
        runner: { played: 0, bestScore: 0 },
        gym: { played: 0, bestScore: 0 }
      }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getDefaultProfile();
      const parsed = JSON.parse(raw);
      // Merge with defaults in case new fields were added
      return { ...getDefaultProfile(), ...parsed };
    } catch (e) {
      console.warn('Profile load failed, using default');
      return getDefaultProfile();
    }
  }

  function save(profile) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('Profile save failed');
    }
  }

  function addCoins(amount) {
    const p = load();
    p.coins += Math.max(0, amount);
    save(p);
    renderBadge();
    return p.coins;
  }

  function spendCoins(amount) {
    const p = load();
    if (p.coins < amount) return false;
    p.coins -= amount;
    save(p);
    renderBadge();
    return true;
  }

  function completeEpisode(epId) {
    const p = load();
    if (!p.episodes[epId]) p.episodes[epId] = { completed: false, framesSeen: 0 };
    p.episodes[epId].completed = true;
    save(p);
    renderBadge();
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
      epList.innerHTML = Object.entries(p.episodes).map(([id, data]) => {
        const status = data.completed ? '✅' : '🔒';
        const names = { 1: 'Рождение героини', 2: 'Кто я?', 3: 'Скоро...' };
        return `<div class="profile-row"><span>Эпизод ${id}: ${names[id] || ''}</span><span>${status}</span></div>`;
      }).join('');
    }

    // Games stats
    const gamesList = modal.querySelector('.profile-games');
    if (gamesList) {
      const names = { blink: 'Моргайка', tracker: 'Следи за шариком', runner: 'Погоня', gym: 'Ваня vs Ленивус' };
      gamesList.innerHTML = Object.entries(p.games).map(([name, data]) => {
        return `<div class="profile-row"><span>${names[name] || name}</span><span>Игр: ${data.played} | Рекорд: ${data.bestScore}</span></div>`;
      }).join('');
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
    closeModal
  };
})();
