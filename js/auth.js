/* ═══════════════════════════════════════════════════════════
   AUTH MODULE — backend synchronization for Superglazka
   Supports guest (token) and full (JWT) authentication.
   Falls back to localStorage when offline.
   ═══════════════════════════════════════════════════════════ */

const Auth = {
  API_BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000/api' : '/api',
  STORAGE_KEY: 'superglazka_auth',
  token: null,
  type: null,
  user: null,
  offlineQueue: [],

  init() {
    this.loadFromStorage();
    this.setupOnlineSync();
  },

  loadFromStorage() {
    try {
      var raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        this.token = data.token || null;
        this.type = data.type || null;
        this.user = data.user || null;
      }
    } catch (e) {}
  },

  saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        token: this.token,
        type: this.type,
        user: this.user
      }));
    } catch (e) {}
  },

  isLoggedIn() {
    return !!this.token;
  },

  isGuest() {
    return this.type === 'guest';
  },

  canSpendCoins() {
    return this.type === 'user';
  },

  getHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    if (this.type === 'guest' && this.token) {
      headers['X-Guest-Token'] = this.token;
    } else if (this.type === 'user' && this.token) {
      headers['Authorization'] = 'Bearer ' + this.token;
    }
    return headers;
  },

  api: async function(path, options) {
    options = options || {};
    var url = this.API_BASE + path;
    var headers = Object.assign({}, this.getHeaders(), options.headers || {});
    try {
      var resp = await fetch(url, Object.assign({}, options, { headers: headers }));
      if (!resp.ok) {
        var errData = await resp.json().catch(function() { return {}; });
        throw new Error(errData.error || 'HTTP ' + resp.status);
      }
      return await resp.json();
    } catch (err) {
      if (err.message.indexOf('fetch') !== -1 || err.message.indexOf('NetworkError') !== -1 || err.message.indexOf('Failed to fetch') !== -1) {
        throw new Error('offline');
      }
      throw err;
    }
  },

  guestLogin: async function(nickname) {
    var data = await this.api('/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ nickname: nickname })
    });
    this.token = data.token;
    this.type = 'guest';
    this.user = { nickname: data.nickname };
    this.saveToStorage();
    return data;
  },

  register: async function(email, phone, password, nickname) {
    var data = await this.api('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: email, phone: phone, password: password, nickname: nickname })
    });
    this.token = data.token;
    this.type = 'user';
    this.user = data.user;
    this.saveToStorage();
    return data;
  },

  login: async function(email, password) {
    var data = await this.api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email, password: password })
    });
    this.token = data.token;
    this.type = 'user';
    this.user = data.user;
    this.saveToStorage();
    return data;
  },

  logout() {
    this.token = null;
    this.type = null;
    this.user = null;
    try { localStorage.removeItem(this.STORAGE_KEY); } catch (e) {}
    window.location.reload();
  },

  fetchProgress: async function() {
    return await this.api('/progress');
  },

  saveProgress: async function(episodeId, maxFrame, completed) {
    try {
      await this.api('/progress', {
        method: 'POST',
        body: JSON.stringify({ episodeId: String(episodeId), maxFrame: maxFrame, completed: !!completed })
      });
    } catch (err) {
      if (err.message === 'offline') {
        this.enqueue('progress', { episodeId: episodeId, maxFrame: maxFrame, completed: !!completed });
      } else {
        throw err;
      }
    }
  },

  fetchCoins: async function() {
    return await this.api('/coins');
  },

  addCoins: async function(amount) {
    try {
      var data = await this.api('/coins/add', {
        method: 'POST',
        body: JSON.stringify({ amount: amount })
      });
      return data.amount;
    } catch (err) {
      if (err.message === 'offline') {
        this.enqueue('coinsAdd', { amount: amount });
      }
      throw err;
    }
  },

  spendCoins: async function(amount) {
    if (!this.canSpendCoins()) return { error: 'Full account required' };
    var data = await this.api('/coins/spend', {
      method: 'POST',
      body: JSON.stringify({ amount: amount })
    });
    return data.amount;
  },

  subscribeEmail: async function(email) {
    return await this.api('/subscribe', {
      method: 'POST',
      body: JSON.stringify({ email: email })
    });
  },

  enqueue: function(type, payload) {
    this.offlineQueue.push({ type: type, payload: payload, time: Date.now() });
    try {
      localStorage.setItem('superglazka_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (e) {}
  },

  setupOnlineSync: function() {
    var self = this;
    window.addEventListener('online', function() { self.syncOfflineQueue(); });
    if (navigator.onLine) {
      setTimeout(function() { self.syncOfflineQueue(); }, 2000);
    }
  },

  syncOfflineQueue: async function() {
    if (!this.isLoggedIn()) return;
    try {
      var raw = localStorage.getItem('superglazka_offline_queue');
      var queue = raw ? JSON.parse(raw) : [];
      if (queue.length === 0) return;
      console.log('Syncing offline queue:', queue.length);
      for (var i = 0; i < queue.length; i++) {
        var item = queue[i];
        try {
          if (item.type === 'progress') {
            await this.saveProgress(item.payload.episodeId, item.payload.maxFrame, item.payload.completed);
          } else if (item.type === 'coinsAdd') {
            await this.addCoins(item.payload.amount);
          }
        } catch (e) {
          console.warn('Sync item failed:', e);
        }
      }
      localStorage.removeItem('superglazka_offline_queue');
      this.offlineQueue = [];
    } catch (e) {
      console.warn('Offline sync failed:', e);
    }
  }
};
