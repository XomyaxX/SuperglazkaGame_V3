/* ═══════════════════════════════════════════════════════════
   AUTH MODULE — backend synchronization for Superglazka
   Supports guest (token) and full (JWT) authentication.
   Implements access/refresh tokens, auto-refresh, OAuth.
   ═══════════════════════════════════════════════════════════ */

const Auth = {
  API_BASE: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000/api' : '/api',
  STORAGE_KEY: 'superglazka_auth',
  token: null,
  refreshToken: null,
  type: null,
  user: null,
  offlineQueue: [],
  _refreshPromise: null,

  init() {
    this.loadFromStorage();
    this.setupOnlineSync();
    this.handleUrlAuth();
    this.setupOAuthListener();
  },

  setupOAuthListener: function() {
    var self = this;
    window.addEventListener('message', function(e) {
      if (!e.data || e.data.type !== 'oauth') return;
      if (e.data.status === 'success' && e.data.token && e.data.refreshToken) {
        self.token = e.data.token;
        self.refreshToken = e.data.refreshToken;
        self.type = 'user';
        self.saveToStorage();
        window.location.reload();
      } else if (e.data.status === 'error') {
        alert('Ошибка входа через соцсеть: ' + (e.data.message || 'неизвестная ошибка'));
      }
    });
  },

  loadFromStorage() {
    try {
      var raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        this.token = data.token || null;
        this.refreshToken = data.refreshToken || null;
        this.type = data.type || null;
        this.user = data.user || null;
      }
    } catch (e) {}
  },

  saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        token: this.token,
        refreshToken: this.refreshToken,
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
    var self = this;

    async function doRequest() {
      var resp = await fetch(url, Object.assign({}, options, { headers: headers }));
      if (resp.status === 401 && self.refreshToken && self.type === 'user') {
        var refreshed = await self.tryRefresh();
        if (refreshed) {
          headers['Authorization'] = 'Bearer ' + self.token;
          resp = await fetch(url, Object.assign({}, options, { headers: headers }));
        }
      }
      if (!resp.ok) {
        var errData = await resp.json().catch(function() { return {}; });
        var err = new Error(errData.error || 'HTTP ' + resp.status);
        err.code = errData.code || null;
        err.status = resp.status;
        throw err;
      }
      return await resp.json();
    }

    try {
      return await doRequest();
    } catch (err) {
      if (err.message.indexOf('fetch') !== -1 || err.message.indexOf('NetworkError') !== -1 || err.message.indexOf('Failed to fetch') !== -1) {
        throw new Error('offline');
      }
      throw err;
    }
  },

  tryRefresh: async function() {
    if (this._refreshPromise) return this._refreshPromise;
    var self = this;
    this._refreshPromise = (async function() {
      try {
        var resp = await fetch(self.API_BASE + '/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: self.refreshToken })
        });
        if (!resp.ok) throw new Error('refresh failed');
        var data = await resp.json();
        self.token = data.token;
        if (data.user) self.user = data.user;
        self.saveToStorage();
        return true;
      } catch (e) {
        self.logoutLocal();
        return false;
      } finally {
        self._refreshPromise = null;
      }
    })();
    return this._refreshPromise;
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
    return data;
  },

  resendVerification: async function(email) {
    return await this.api('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email: email })
    });
  },

  login: async function(email, password, rememberMe) {
    var data = await this.api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email, password: password, rememberMe: !!rememberMe })
    });
    this.token = data.token;
    this.refreshToken = data.refreshToken;
    this.type = 'user';
    this.user = data.user;
    this.saveToStorage();
    return data;
  },

  logout: function() {
    if (this.refreshToken) {
      this.api('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken })
      }).catch(function(){});
    }
    this.logoutLocal();
  },

  logoutLocal: function() {
    this.token = null;
    this.refreshToken = null;
    this.type = null;
    this.user = null;
    try { localStorage.removeItem(this.STORAGE_KEY); } catch (e) {}
    window.location.reload();
  },

  forgotPassword: async function(email) {
    return await this.api('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: email })
    });
  },

  resetPassword: async function(token, newPassword) {
    return await this.api('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: token, newPassword: newPassword })
    });
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

  openOAuth: function(provider) {
    var url = this.API_BASE + '/auth/oauth/' + provider;
    var w = window.open(url, 'oauth', 'width=500,height=600');
    if (!w) {
      window.location.href = url;
    }
  },

  handleUrlAuth: function() {
    var params = new URLSearchParams(window.location.search);
    var oauth = params.get('oauth');
    var token = params.get('token');
    var refresh = params.get('refresh');
    var verified = params.get('verified');
    var reset = params.get('reset');

    if (oauth === 'success' && token && refresh) {
      this.token = token;
      this.refreshToken = refresh;
      this.type = 'user';
      this.saveToStorage();
      // clean URL
      var cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      window.location.reload();
      return;
    }

    if (verified === '1') {
      // clean URL and maybe show toast later
      var cleanUrl2 = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl2);
      // trigger a custom event that UI can listen to
      try {
        window.dispatchEvent(new CustomEvent('auth:verified'));
      } catch (e) {}
      return;
    }

    if (reset) {
      // trigger event for UI to show reset password modal
      try {
        window.dispatchEvent(new CustomEvent('auth:reset', { detail: { token: reset } }));
      } catch (e) {}
    }
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
