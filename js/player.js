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
      nickname: window.I18n ? I18n.t('player.defaultNickname') : 'Игрок',
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
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) {
      Auth.addCoins(amount).catch(function() {});
    }
    // Check coin-based achievements
    if (typeof Achievements !== 'undefined' && Achievements.check) {
      Achievements.check('coins', null, p.coins);
    }
    return p.coins;
  }

  /** @param {number} amount - Coins to spend @returns {boolean} Whether purchase succeeded */
  function spendCoins(amount) {
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn() && !Auth.canSpendCoins()) {
      alert('\uD83D\uDD12 \u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u0443\u0439\u0442\u0435\u0441\u044c \u0441 \u043f\u043e\u043b\u043d\u044b\u043c \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u043e\u043c, \u0447\u0442\u043e\u0431\u044b \u0442\u0440\u0430\u0442\u0438\u0442\u044c \u043c\u043e\u043d\u0435\u0442\u043a\u0438!');
      return false;
    }
    const p = load();
    if (p.coins < amount) return false;
    p.coins -= amount;
    save(p);
    renderBadge();
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) {
      Auth.spendCoins(amount).catch(function() {});
    }
    return true;
  }

  /** @param {string|number} epId - Episode identifier */
  function completeEpisode(epId) {
    const p = load();
    if (!p.episodes[epId]) p.episodes[epId] = { completed: false, framesSeen: 0, maxFrame: -1 };
    p.episodes[epId].completed = true;
    save(p);
    renderBadge();
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) {
      Auth.saveProgress(epId, p.episodes[epId].maxFrame, true).catch(function() {});
    }
    if (typeof Achievements !== 'undefined' && Achievements.check) {
      var completedCount = Object.values(p.episodes).filter(function(e) { return e.completed; }).length;
      Achievements.check('episode', null, completedCount);
      var totalEpisodes = Object.keys(p.episodes).length;
      if (completedCount >= totalEpisodes && totalEpisodes > 0) {
        Achievements.check('episode_all', null, completedCount);
      }
    }
  }

  /** @param {string|number} epId - Episode identifier @param {number} frameIdx - Zero-based frame index */
  function markFrameSeen(epId, frameIdx) {
    const p = load();
    if (!p.episodes[epId]) p.episodes[epId] = { completed: false, framesSeen: 0, maxFrame: -1 };
    if (frameIdx > p.episodes[epId].maxFrame) {
      p.episodes[epId].maxFrame = frameIdx;
    }
    save(p);
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) {
      Auth.saveProgress(epId, frameIdx, p.episodes[epId].completed).catch(function() {});
    }
    if (typeof Achievements !== 'undefined' && Achievements.check) {
      var totalFrames = Object.values(p.episodes).reduce(function(sum, ep) { return sum + (ep.maxFrame + 1); }, 0);
      Achievements.check('frame', null, totalFrames);
    }
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
    if (typeof Achievements !== 'undefined' && Achievements.check) {
      Achievements.check('game', name);
      var playedCount = p.games[name] ? p.games[name].played : 0;
      Achievements.check('game_count', name, playedCount);
    }
    renderBadge();
  }

  function getProfile() {
    return load();
  }

  function setNickname(name) {
    const p = load();
    p.nickname = (name || (window.I18n ? I18n.t('player.defaultNickname') : 'Игрок')).trim().substring(0, 20);
    save(p);
    renderBadge();
  }

  async function syncFromServer() {
    if (typeof Auth === 'undefined' || !Auth.isLoggedIn || !Auth.isLoggedIn()) return;
    try {
      var serverProgress = await Auth.fetchProgress();
      var p = load();
      if (serverProgress.progress) {
        Object.entries(serverProgress.progress).forEach(function(entry) {
          var epId = entry[0];
          var data = entry[1];
          if (!p.episodes[epId]) p.episodes[epId] = { completed: false, framesSeen: 0, maxFrame: -1 };
          if (data.maxFrame > p.episodes[epId].maxFrame) {
            p.episodes[epId].maxFrame = data.maxFrame;
          }
          if (data.completed) p.episodes[epId].completed = true;
        });
        save(p);
      }
      var serverCoins = await Auth.fetchCoins();
      if (serverCoins.amount > p.coins) {
        p.coins = serverCoins.amount;
        save(p);
      }
      renderBadge();
    } catch (e) {
      console.warn('Server sync failed:', e);
    }
  }

  /* ─── UI ─── */
  function renderBadge() {
    var p = load();
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) {
      Auth.fetchCoins().then(function(data) {
        document.querySelectorAll('.profile-coins-val').forEach(function(badge) {
          badge.textContent = data.amount;
        });
      }).catch(function() {
        document.querySelectorAll('.profile-coins-val').forEach(function(badge) {
          badge.textContent = p.coins;
        });
      });
    } else {
      document.querySelectorAll('.profile-coins-val').forEach(function(badge) {
        badge.textContent = p.coins;
      });
    }
  }

  function openModal() {
    const p = load();
    const modal = document.getElementById('profile-modal');
    if (!modal) return;

    // Sync nickname from Auth if available
    var displayName = p.nickname;
    if (typeof Auth !== 'undefined' && Auth.user && Auth.user.nickname) {
      displayName = Auth.user.nickname;
      // Also update local profile so it persists
      if (p.nickname !== Auth.user.nickname) {
        setNickname(Auth.user.nickname);
      }
    }

    const nicknameInput = modal.querySelector('.profile-nickname');
    if (nicknameInput) nicknameInput.value = displayName;

    const coinsEl = modal.querySelector('.profile-coins-big');
    if (coinsEl) coinsEl.textContent = p.coins;

    // Episode list
    const epList = modal.querySelector('.profile-episodes');
    if (epList) {
      epList.textContent = '';
      Object.entries(p.episodes).forEach(([id, data]) => {
        const row = document.createElement('div');
        row.className = 'profile-row';
        const left = document.createElement('span');
        left.textContent = (window.I18n ? I18n.t('episodes.ep1.num') : 'Глава') + ' ' + id;
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
      var names = {
        blink: window.I18n ? I18n.t('games.blink.title') : 'Моргайка',
        tracker: window.I18n ? I18n.t('games.tracker.title') : 'Следи за шариком',
        runner: window.I18n ? I18n.t('games.runner.title') : 'Погоня',
        gym: window.I18n ? I18n.t('games.gym.title') : 'Ваня vs Ленивус'
      };
      gamesList.textContent = '';
      Object.entries(p.games).forEach(([name, data]) => {
        const row = document.createElement('div');
        row.className = 'profile-row';
        const left = document.createElement('span');
        left.textContent = names[name] || name;
        const right = document.createElement('span');
        right.textContent = (window.I18n ? I18n.t('profileLanding.playedTimes', {count: data.played}) : 'Игр: ' + data.played) + ' | ' + (window.I18n ? I18n.t('profileLanding.bestScore', {score: data.bestScore}) : 'Рекорд: ' + data.bestScore);
        row.appendChild(left);
        row.appendChild(right);
        gamesList.appendChild(row);
      });
    }

    // Account block
    const accountBlock = modal.querySelector('#profileAccount');
    if (accountBlock) {
      accountBlock.textContent = '';
      if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.isLoggedIn()) {
        if (Auth.isGuest && Auth.isGuest()) {
          const text = document.createElement('div');
          text.className = 'profile-account-text';
          text.textContent = window.I18n ? I18n.t('player.guestText') : 'Ты играешь как гость. Прогресс сохраняется, но монетки пока нельзя тратить.';
          accountBlock.appendChild(text);

          const regBtn = document.createElement('button');
          regBtn.className = 'profile-account-btn';
          regBtn.id = 'profileRegBtn';
          regBtn.textContent = window.I18n ? I18n.t('player.createAccount') : '🔐 Создать полный аккаунт';
          accountBlock.appendChild(regBtn);

          const loginBtn = document.createElement('button');
          loginBtn.className = 'profile-account-btn';
          loginBtn.id = 'profileLoginBtn';
          loginBtn.textContent = window.I18n ? I18n.t('player.login') : '🔑 Уже есть аккаунт? Войти';
          accountBlock.appendChild(loginBtn);
        } else {
          const emailText = document.createElement('div');
          emailText.className = 'profile-account-email';
          emailText.textContent = Auth.user && Auth.user.email ? Auth.user.email : '';
          accountBlock.appendChild(emailText);

          const logoutBtn = document.createElement('button');
          logoutBtn.className = 'profile-account-btn';
          logoutBtn.id = 'profileLogoutBtn';
          logoutBtn.textContent = window.I18n ? I18n.t('player.logout') : '🚪 Выйти';
          accountBlock.appendChild(logoutBtn);
        }
      } else {
        const text = document.createElement('div');
        text.className = 'profile-account-text';
        text.textContent = window.I18n ? I18n.t('profile.guestText') : 'Войди или создай аккаунт, чтобы сохранить прогресс.';
        accountBlock.appendChild(text);

        const loginBtn = document.createElement('button');
        loginBtn.className = 'profile-account-btn';
        loginBtn.id = 'profileLoginBtn';
        loginBtn.textContent = window.I18n ? I18n.t('player.enterLogin') : '🔑 Войти / Зарегистрироваться';
        accountBlock.appendChild(loginBtn);
      }
    }

    // Achievements compact link
    const achContainer = modal.querySelector('.profile-achievements');
    if (achContainer && typeof Achievements !== 'undefined' && Achievements.renderProfileLink) {
      Achievements.renderProfileLink(achContainer);
    }

    modal.classList.add('visible');
  }

  function closeModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.remove('visible');
  }

  function init() {
    // Sync nickname from Auth on startup
    if (typeof Auth !== 'undefined' && Auth.user && Auth.user.nickname) {
      const p = load();
      if (p.nickname !== Auth.user.nickname) {
        setNickname(Auth.user.nickname);
      }
    }
    renderBadge();
    syncFromServer();

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
