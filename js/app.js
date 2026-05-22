/* ═══════════════════════════════════════════════════════════
   СУПЕРГЛАЗКА — Stories Pro Engine
   ═══════════════════════════════════════════════════════════ */

const SPEAKER_NAMES = {
  hrust: "Мудрый Хрусталик",
  sovet: "Советник",
  dev: "Девочка",
  tolpa: "Толпа",
  nar: "Рассказчик"
};

const GAME_NAMES = { blink: 'Моргай-зарядка', tracker: 'Трекер-взгляд' };
const GAME_ICONS = { blink: '⚡', tracker: '👀' };

/**
 * Escape special HTML characters in a plain-text string.
 * @param {string} text
 * @returns {string} Escaped HTML string
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════
/**
 * Theme Manager — handles automatic theme detection and manual overrides.
 * Persists user choice in localStorage; falls back to `prefers-color-scheme`.
 * @namespace ThemeManager
 */
const ThemeManager = {
  STORAGE_KEY: 'superglazka_theme',

  /** Initialize theme from saved preference or system default. */
  init() {
    const saved = this._load();
    if (saved) {
      this._apply(saved);
    } else {
      this._applySystem();
    }
    this._listenSystem();
  },

  _load() {
    try {
      return localStorage.getItem(this.STORAGE_KEY);
    } catch (e) {
      return null;
    }
  },

  _save(value) {
    try {
      localStorage.setItem(this.STORAGE_KEY, value);
    } catch (e) {}
  },

  _apply(theme) {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add('theme-' + theme);
    this._updateToggleUI(theme);
  },

  _applySystem() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    this._apply(prefersDark ? 'dark' : 'light');
  },

  _listenSystem() {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', (e) => {
        if (!this._load()) {
          this._apply(e.matches ? 'dark' : 'light');
        }
      });
    }
  },

  /** Toggle between dark and light themes and persist the choice. */
  toggle() {
    const isDark = document.body.classList.contains('theme-dark');
    const next = isDark ? 'light' : 'dark';
    this._apply(next);
    this._save(next);
  },

  _updateToggleUI(theme) {
    const toggle = document.getElementById('settingsToggleDarkTheme');
    if (toggle) toggle.classList.toggle('active', theme === 'dark');
  }
};

// ═══════════════════════════════════════════════════════════
/**
 * App Settings — persistent user preferences stored in localStorage.
 * Manages volume, audio tracks, subtitles, accessibility and UI font size.
 * @namespace AppSettings
 */
const AppSettings = {
  defaults: {
    volume: 80,
    narration: true,
    subtitles: true,
    subtitleFontSize: 'medium',
    highContrast: false,
    reduceMotion: false,
    uiFontSize: 'medium',
    bgMusic: true
  },
  _data: {},

  /** Load settings from localStorage or use defaults. @returns {Object} Settings object */
  load() {
    try {
      const raw = localStorage.getItem('superglazka_settings');
      const saved = raw ? JSON.parse(raw) : {};
      this._data = Object.assign({}, this.defaults, saved);
    } catch (e) {
      this._data = Object.assign({}, this.defaults);
    }
    return this._data;
  },

  /** Persist current settings to localStorage. */
  save() {
    try {
      localStorage.setItem('superglazka_settings', JSON.stringify(this._data));
    } catch (e) {}
  },

  /** @param {string} key - Setting name @returns {*} Setting value */
  get(key) {
    return this._data[key];
  },

  /** @param {string} key - Setting name @param {*} value - New value */
  set(key, value) {
    this._data[key] = value;
    this.save();
    this.apply();
  },

  /** Apply all current settings to the DOM and audio controller. */
  apply() {
    const d = this._data;
    const prevNarration = AudioController.activeTracks.narration;

    AudioController.activeTracks.narration = d.narration;
    AudioController.volume = d.volume / 100;
    if (AudioController.currentAudio) {
      AudioController.currentAudio.volume = AudioController.volume;
    }

    if (typeof BackgroundMusic !== 'undefined') {
      BackgroundMusic.setEnabled(d.bgMusic);
      BackgroundMusic.setVolume(d.volume / 100);
    }

    document.body.classList.toggle('subtitles-off', !d.subtitles);
    document.body.classList.remove('subtitle-small', 'subtitle-medium', 'subtitle-large');
    document.body.classList.add('subtitle-' + d.subtitleFontSize);

    document.body.classList.toggle('high-contrast', d.highContrast);
    document.body.classList.toggle('reduce-motion', d.reduceMotion);

    document.body.classList.remove('ui-small', 'ui-medium', 'ui-large');
    document.body.classList.add('ui-' + d.uiFontSize);

    this.updateUI();
    AudioController.updateUI();
  },

  /** Sync settings toggles, sliders and font-size buttons with current values. */
  /** Update settings button active state based on current audio state. */
  updateUI() {
    const d = this._data;

    const toggles = {
      settingsToggleNarration: d.narration,
      settingsToggleBgMusic: d.bgMusic,
      settingsToggleSubtitles: d.subtitles,
      settingsToggleHighContrast: d.highContrast,
      settingsToggleReduceMotion: d.reduceMotion
    };
    Object.entries(toggles).forEach(([id, active]) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active', active);
    });

    const slider = document.getElementById('bsVolumeSlider');
    if (slider) slider.value = d.volume;

    const setFontActive = (groupId, size) => {
      const group = document.getElementById(groupId);
      if (group) {
        group.querySelectorAll('.font-size-btn').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.size === size);
        });
      }
    };
    setFontActive('subtitleFontSizeGroup', d.subtitleFontSize);
    setFontActive('uiFontSizeGroup', d.uiFontSize);
  }
};

// ═══════════════════════════════════════════════════════════
/**
 * Device Detector — identifies device type using UA strings, pointer/hover
 * capabilities and viewport dimensions. Adds utility flags to `window`.
 * @namespace DeviceDetector
 */
const DeviceDetector = {
  type: 'unknown',

  /** Detect device type and add corresponding CSS classes to `<body>`. */
  detect() {
    const ua = navigator.userAgent || '';

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const hasHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isPortrait = height > width;

    const isMobileUA = /Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isTabletUA = /iPad|Tablet|Kindle|Silk|PlayBook/i.test(ua);
    const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);

    let type = 'desktop';

    if (isTabletUA || isAndroidTablet) {
      type = 'tablet';
    } else if (isMobileUA || (isCoarsePointer && !hasHover && width < 768)) {
      type = 'mobile';
    } else if (isCoarsePointer && !hasHover && width >= 768 && width <= 1024) {
      type = 'tablet';
    } else if (!hasHover && isTouch && width < 1024) {
      type = 'mobile';
    }

    this.type = type;
    document.body.classList.add('device-' + type);
    document.body.classList.toggle('device-touch', isTouch);
    document.body.classList.toggle('device-no-hover', !hasHover);
    document.body.classList.toggle('device-portrait', isPortrait);
    document.body.classList.toggle('device-landscape', !isPortrait);
    window.DEVICE_TYPE = type;
    window.IS_TOUCH = isTouch;
    window.IS_MOBILE = type === 'mobile';
    window.IS_TABLET = type === 'tablet';
    window.IS_DESKTOP = type === 'desktop';
  },

  /** Listen to window resize to update orientation classes. */
  onResize() {
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      document.body.classList.toggle('device-portrait', height > width);
      document.body.classList.toggle('device-landscape', height <= width);
    });
  }
};

// ═══════════════════════════════════════════════════════════
/**
 * Audio Controller — queue-based unified audio mixer.
 * Handles narration audio with volume control,
 * resume support and toggling.
 * @namespace AudioController
 */
const AudioController = {
  queue: [],
  currentIdx: 0,
  currentAudio: null,
  state: 'idle',
  activeTracks: { narration: true },
  volume: 0.8,

  timeoutId: null,
  frameData: null,
  stateChangeCallback: null,
  audioStartCallback: null,
  savedTime: 0,
  savedSrc: null,

  _normalizeSrc(src) {
    try { return new URL(src, location.href).href; } catch (e) { return src; }
  },

  /** @param {Object} frameData - Current frame with audioSrc */
  setFrameData(frameData) {
    this.frameData = frameData;
    this.stop();
    this.currentIdx = 0;
    this.savedTime = 0;
    this.savedSrc = null;
    this.buildQueue();
    if (typeof MoodDetector !== 'undefined') {
      const mood = MoodDetector.detectMood(frameData);
      if (typeof BackgroundMusic !== 'undefined') {
        BackgroundMusic.crossfadeTo(mood);
      }
    }
  },

  /** @param {Function} fn - Callback invoked when audio state changes */
  onStateChange(fn) {
    this.stateChangeCallback = fn;
  },

  /** @param {Function} fn - Callback invoked when new audio starts playing */
  onAudioStart(fn) {
    this.audioStartCallback = fn;
  },

  _notifyStateChange() {
    if (this.stateChangeCallback) this.stateChangeCallback(this.state);
  },

  /** Rebuild the audio queue based on current frame data and active tracks. */
  buildQueue() {
    this.queue = [];
    if (this.activeTracks.narration && this.frameData?.audioSrc) {
      this.queue.push({ type: 'narration', src: this.frameData.audioSrc });
    }
  },

  /** Start or resume playback from the current queue position. */
  play() {
    if (this.queue.length === 0) {
      this.state = 'idle';
      this.onQueueEnd();
      return;
    }
    this.state = 'playing';
    this.playNext();
  },

  /** Play the next item in the queue; skip on error or timeout. */
  playNext() {
    this.stopCurrent();
    if (this.currentIdx >= this.queue.length) {
      this.state = 'idle';
      this.onQueueEnd();
      return;
    }
    const item = this.queue[this.currentIdx];
    const audio = new Audio(item.src);
    audio.volume = this.volume;
    audio.preload = 'auto';
    this.currentAudio = audio;

    if (this.audioStartCallback) {
      this.audioStartCallback(this.currentAudio);
    }

    if (this.savedTime > 0 && this._normalizeSrc(item.src) === this.savedSrc) {
      audio.currentTime = this.savedTime;
      this.savedTime = 0;
    }

    audio.onended = () => {
      this.clearTimeout();
      this.currentIdx++;
      this.playNext();
    };
    const handleAudioError = () => {
      if (typeof fallbackTypewriter === 'function' && item.type === 'narration') {
        fallbackTypewriter();
      }
      this.clearTimeout();
      this.currentIdx++;
      this.playNext();
    };

    audio.onerror = () => {
      console.warn('Audio failed:', item.src);
      handleAudioError();
    };

    audio.play().catch(err => {
      console.warn('Audio play failed:', item.src, err);
      handleAudioError();
    });

    this.timeoutId = setTimeout(() => {
      if (this.currentAudio) {
        console.warn('Audio timeout, skipping:', item.src);
        this.currentIdx++;
        this.playNext();
      }
    }, 30000);

    this.updateUI();
  },

  /** Stop and clear the currently playing audio element. */
  stopCurrent() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.clearTimeout();
  },

  clearTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  },

  /** Pause currently playing audio (not video). */
  pause() {
    if (this.currentAudio && this.state === 'playing') {
      this.currentAudio.pause();
      this.state = 'paused';
      this.updateUI();
    }
  },

  /** Resume paused audio or restart idle queue. */
  resume() {
    if (this.currentAudio && this.state === 'paused') {
      this.currentAudio.play().catch(() => {});
      this.state = 'playing';
      this.updateUI();
    } else if ((this.state === 'idle' || this.state === 'paused') && this.queue.length > 0) {
      this.play();
    }
  },

  /** Stop all audio, reset queue index and saved position. */
  stop() {
    this.stopCurrent();
    this.state = 'idle';
    this.currentIdx = 0;
    this.savedTime = 0;
    this.savedSrc = null;
    this._notifyStateChange();
    this.updateUI();
  },

  /** @param {string} type - 'narration' */
  toggleTrack(type) {
    const turningOn = !this.activeTracks[type];
    this.activeTracks[type] = !this.activeTracks[type];

    const wasPlaying = this.state === 'playing';
    if (this.currentAudio) {
      this.savedSrc = this._normalizeSrc(this.currentAudio.src);
      this.savedTime = this.currentAudio.currentTime;
    }
    this.stopCurrent();
    this.buildQueue();
    if (this.savedSrc) {
      const newIdx = this.queue.findIndex(q => this._normalizeSrc(q.src) === this.savedSrc);
      if (newIdx !== -1) {
        this.currentIdx = newIdx;
      } else {
        this.currentIdx = 0;
      }
    }
    if (turningOn) {
      this.play();
    } else if (wasPlaying) {
      this.state = 'playing';
      this.playNext();
    } else {
      this.state = 'idle';
      this.updateUI();
    }
    this._notifyStateChange();
    this.updateUI();
  },

  /** Notify the app when the entire audio queue finishes. */
  onQueueEnd() {
    if (typeof App !== 'undefined' && App.onAudioEnd) {
      App.onAudioEnd();
    }
  },

  /** @param {number} v - Volume level 0–100 */
  setVolume(v) {
    this.volume = v / 100;
    if (this.currentAudio) this.currentAudio.volume = this.volume;
  },

  updateUI() {
    const settingsMenuBtn = document.getElementById('settingsMenuBtn');
    if (settingsMenuBtn) {
      settingsMenuBtn.classList.toggle('active', this.state === 'playing');
    }
  }
};

// ═══════════════════════════════════════════════════════════
// SUBTITLE OVERLAY — floating line above bottom sheet
// ═══════════════════════════════════════════════════════════
const SubtitleOverlay = {
  el: document.getElementById('subtitleOverlay'),
  lineEl: document.getElementById('subLine'),

  setText(text) {
    if (!this.el || !this.lineEl) return;
    if (this._last === text) return;
    this._last = text;
    if (this._pendingTimeout) { clearTimeout(this._pendingTimeout); this._pendingTimeout = null; }
    this.el.classList.add('switching');
    this._pendingTimeout = setTimeout(() => {
      this.lineEl.textContent = text;
      this.el.classList.remove('switching');
      this._pendingTimeout = null;
    }, 300);
  },

  clear() {
    this._last = null;
    if (this._pendingTimeout) { clearTimeout(this._pendingTimeout); this._pendingTimeout = null; }
    if (this.lineEl) this.lineEl.textContent = '';
    if (this.el) this.el.classList.remove('switching');
  }
};

// ═══════════════════════════════════════════════════════════
// BOTTOM SHEET — unified bottom panel
// ═══════════════════════════════════════════════════════════
const BottomSheet = {
  state: 'collapsed',
  snapPoints: { expanded: 0, collapsed: 0, hidden: 0 },

  init() {
    this.el = document.getElementById('bottomSheet');
    this.backdrop = document.getElementById('bsBackdrop');
    this.dragHandle = document.getElementById('bsDragHandle');
    this.subtitleText = document.getElementById('bsSubtitleText');
    this.subtitleIcon = document.getElementById('bsSubtitleIcon');
    this.narratorFull = document.getElementById('bsNarratorFull');
    this.narratorWrapper = document.getElementById('bsNarratorWrapper');
    this.narratorToggle = document.getElementById('bsNarratorToggle');
    this.gameDock = document.getElementById('bsGameDock');
    this.gamePanelInner = document.getElementById('bsGamePanelInner');
    this.navNextBtn = document.getElementById('bsNavNextBtn');
    this.prevBtn = document.getElementById('bsPrevBtn');
    this.gameIsland = document.getElementById('bsGameIsland');

    if (this.gameIsland) {
      this.gameIsland.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._pendingGameType) {
          App.launchGame(this._pendingGameType);
        }
      });
    }

    if (this.narratorToggle) {
      this.narratorToggle.addEventListener('click', () => {
        if (this.narratorWrapper) {
          const isCollapsed = this.narratorWrapper.classList.contains('collapsed');
          this.narratorWrapper.classList.toggle('collapsed', !isCollapsed);
          this.narratorWrapper.classList.toggle('expanded', isCollapsed);
          this.narratorToggle.setAttribute('aria-expanded', isCollapsed ? 'true' : 'false');
        }
      });
    }

    this.recalcSnapPoints();
    window.addEventListener('resize', () => this.recalcSnapPoints());

    if (this.dragHandle) this.dragHandle.addEventListener('click', () => this.toggle());
    if (this.backdrop) this.backdrop.addEventListener('click', () => this.collapse());
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el || e.target.classList.contains('bs-subtitle')) {
        this.expand();
      }
    });

    // Narration toggle
    const narrationToggle = document.getElementById('settingsToggleNarration');
    if (narrationToggle) narrationToggle.addEventListener('click', () => {
      AppSettings.set('narration', !AppSettings.get('narration'));
    });

    // Background music toggle
    const bgmToggle = document.getElementById('settingsToggleBgMusic');
    if (bgmToggle) bgmToggle.addEventListener('click', () => {
      AppSettings.set('bgMusic', !AppSettings.get('bgMusic'));
    });

    // Subtitles toggle
    const subToggle = document.getElementById('settingsToggleSubtitles');
    if (subToggle) subToggle.addEventListener('click', () => {
      AppSettings.set('subtitles', !AppSettings.get('subtitles'));
    });

    // High contrast toggle
    const hcToggle = document.getElementById('settingsToggleHighContrast');
    if (hcToggle) hcToggle.addEventListener('click', () => {
      AppSettings.set('highContrast', !AppSettings.get('highContrast'));
    });

    // Reduce motion toggle
    const rmToggle = document.getElementById('settingsToggleReduceMotion');
    if (rmToggle) rmToggle.addEventListener('click', () => {
      AppSettings.set('reduceMotion', !AppSettings.get('reduceMotion'));
    });

    // Volume slider
    const volSlider = document.getElementById('bsVolumeSlider');
    if (volSlider) volSlider.addEventListener('input', (e) => {
      AppSettings.set('volume', parseInt(e.target.value, 10));
    });

    // Font size groups
    const bindFontGroup = (groupId, settingKey) => {
      const group = document.getElementById(groupId);
      if (group) {
        group.addEventListener('click', (e) => {
          const btn = e.target.closest('.font-size-btn');
          if (btn) {
            AppSettings.set(settingKey, btn.dataset.size);
          }
        });
      }
    };
    bindFontGroup('subtitleFontSizeGroup', 'subtitleFontSize');
    bindFontGroup('uiFontSizeGroup', 'uiFontSize');

    // Dark theme toggle
    const themeToggle = document.getElementById('settingsToggleDarkTheme');
    if (themeToggle) themeToggle.addEventListener('click', () => ThemeManager.toggle());

    if (this.navNextBtn) this.navNextBtn.addEventListener('click', () => App.nextFrame());
    if (this.prevBtn) this.prevBtn.addEventListener('click', () => App.prevFrame());

    this.initDrag();
  },

  recalcSnapPoints() {
    if (!this.el) return;
    const fullH = this.el.offsetHeight;
    const collapsedH = 110; // visible height in collapsed mode
    const handleH = this.dragHandle ? this.dragHandle.offsetHeight + 8 : 12;
    this.snapPoints = {
      expanded: 0,
      collapsed: Math.max(0, fullH - collapsedH),
      hidden: Math.max(0, fullH - handleH)
    };
    this.applyTranslateY(this.snapPoints[this.state], false);
  },

  getTranslateY() {
    const style = getComputedStyle(this.el).transform;
    if (style === 'none') return 0;
    const m = style.match(/matrix\(([^)]+)\)/);
    if (m) {
      const vals = m[1].split(',').map(v => parseFloat(v.trim()));
      return vals[5] || 0;
    }
    const m2 = style.match(/translateY\(([^)]+)\)/);
    if (m2) return parseFloat(m2[1]);
    return 0;
  },

  applyTranslateY(y, animate) {
    if (animate) this.el.style.transition = '';
    else this.el.style.transition = 'none';
    this.el.style.transform = `translateY(${Math.round(y)}px)`;
  },

  toggle() {
    if (this.state === 'hidden') this.collapse();
    else if (this.state === 'collapsed') this.expand();
    else this.collapse();
  },

  expand() {
    this.state = 'expanded';
    this.el.classList.remove('collapsed', 'hidden');
    this.applyTranslateY(this.snapPoints.expanded, true);
    if (this.backdrop) this.backdrop.classList.add('visible');
    if (SubtitleOverlay.el) SubtitleOverlay.el.classList.add('hidden');
  },

  collapse() {
    this.state = 'collapsed';
    this.el.classList.add('collapsed');
    this.el.classList.remove('hidden');
    this.applyTranslateY(this.snapPoints.collapsed, true);
    if (this.backdrop) this.backdrop.classList.remove('visible');
    if (SubtitleOverlay.el) SubtitleOverlay.el.classList.remove('hidden');
  },

  hide() {
    this.state = 'hidden';
    this.el.classList.add('hidden');
    this.el.classList.remove('collapsed');
    this.applyTranslateY(this.snapPoints.hidden, true);
    if (this.backdrop) this.backdrop.classList.remove('visible');
    if (SubtitleOverlay.el) SubtitleOverlay.el.classList.remove('hidden');
  },

  setSubtitle(text, icon) {
    if (this.subtitleText) this.subtitleText.textContent = text || '';
    if (this.subtitleIcon && icon) this.subtitleIcon.textContent = icon;
  },

  setNarratorFull(text) {
    if (this.narratorFull) this.narratorFull.textContent = text || '';
    if (this.narratorWrapper) {
      this.narratorWrapper.classList.remove('expanded');
      this.narratorWrapper.classList.add('collapsed');
    }
    if (this.narratorToggle) {
      this.narratorToggle.setAttribute('aria-expanded', 'false');
      requestAnimationFrame(() => {
        if (!this.narratorFull || !this.narratorWrapper) return;
        const overflow = this.narratorFull.scrollHeight > this.narratorWrapper.clientHeight + 4;
        this.narratorToggle.style.display = overflow ? 'inline-block' : 'none';
      });
    }
  },

  showNextButton(text) {
    if (this.navNextBtn) this.navNextBtn.classList.add('active');
  },

  hideNextButton() {
    if (this.navNextBtn) this.navNextBtn.classList.remove('active');
  },

  showGameIsland(gameType) {
    this._pendingGameType = gameType;
    if (this.gameIsland) this.gameIsland.style.display = 'flex';
    this.expand();
  },

  hideGameIsland() {
    this._pendingGameType = null;
    if (this.gameIsland) this.gameIsland.style.display = 'none';
  },

  renderGameDock(games) {
    if (!this.gameDock) return;
    this.gameDock.textContent = '';
    if (!games || games.length === 0) return;
    games.forEach(g => {
      const chip = document.createElement('button');
      chip.className = 'game-chip';
      chip.title = GAME_NAMES[g] || g;
      const icon = document.createElement('span');
      icon.className = 'game-chip-icon';
      icon.textContent = GAME_ICONS[g] || '🎮';
      chip.appendChild(icon);
      chip.addEventListener('click', () => App.startGame(g));
      this.gameDock.appendChild(chip);
    });
  },

  renderGamePanel(games) {
    if (!this.gamePanelInner) return;
    this.gamePanelInner.textContent = '';
    if (!games || games.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:rgba(255,255,255,0.4);font-size:13px;';
      empty.textContent = 'Нет доступных игр на этом кадре';
      this.gamePanelInner.appendChild(empty);
      return;
    }
    games.forEach(g => {
      const chip = document.createElement('button');
      chip.className = 'bs-game-chip';
      const icon = document.createElement('span');
      icon.className = 'bs-game-chip-icon';
      icon.textContent = GAME_ICONS[g] || '🎮';
      const name = document.createElement('span');
      name.textContent = GAME_NAMES[g] || g;
      chip.appendChild(icon);
      chip.appendChild(name);
      chip.addEventListener('click', () => App.startGame(g));
      this.gamePanelInner.appendChild(chip);
    });
  },

  initDrag() {
    if (!this.el) return;
    let startY = 0;
    let startTranslateY = 0;
    let startTime = 0;
    let isDragging = false;
    let rafId = null;

    const onStart = (y, target) => {
      if (target && target.closest('.bs-expanded')) return;
      if (target && target.closest('button, input, .bs-toggle, .bs-game-chip, .bs-audio-panel, select, textarea')) return;
      startY = y;
      startTime = performance.now();
      startTranslateY = this.getTranslateY();
      isDragging = true;
      this.el.style.transition = 'none';
      if (rafId) cancelAnimationFrame(rafId);
    };

    const onMove = (y) => {
      if (!isDragging) return;
      const deltaY = startY - y;
      let translateY = startTranslateY - deltaY;
      const minY = this.snapPoints.expanded;
      const maxY = this.snapPoints.hidden;
      if (translateY < minY) translateY = minY - (minY - translateY) * 0.3; // rubber band
      if (translateY > maxY) translateY = maxY + (translateY - maxY) * 0.3; // rubber band
      this.el.style.transform = `translateY(${Math.round(translateY)}px)`;
    };

    const onEnd = (y) => {
      if (!isDragging) return;
      isDragging = false;
      const deltaY = startY - y;
      const deltaTime = performance.now() - startTime;
      const velocity = deltaTime > 0 ? deltaY / deltaTime : 0;
      const minVel = 0.4; // px per ms

      if (Math.abs(deltaY) < 5 && Math.abs(velocity) < minVel) {
        // treat as click
        this.el.style.transition = '';
        return;
      }

      let targetState = this.state;
      const currentY = this.getTranslateY();
      const points = this.snapPoints;

      if (Math.abs(velocity) >= minVel) {
        // velocity-driven snap
        if (velocity > 0) {
          // dragged up
          if (this.state === 'hidden') targetState = 'collapsed';
          else if (this.state === 'collapsed') targetState = 'expanded';
        } else {
          // dragged down
          if (this.state === 'expanded') targetState = 'collapsed';
          else if (this.state === 'collapsed') targetState = 'hidden';
        }
      } else {
        // distance-driven snap: nearest point
        const dists = [
          { state: 'expanded', val: Math.abs(currentY - points.expanded) },
          { state: 'collapsed', val: Math.abs(currentY - points.collapsed) },
          { state: 'hidden', val: Math.abs(currentY - points.hidden) }
        ];
        dists.sort((a, b) => a.val - b.val);
        targetState = dists[0].state;
      }

      if (targetState === 'expanded') this.expand();
      else if (targetState === 'collapsed') this.collapse();
      else this.hide();
    };

    this.el.addEventListener('touchstart', (e) => onStart(e.touches[0].clientY, e.target), {passive: true});
    this.el.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => onMove(e.touches[0].clientY));
    }, {passive: true});
    this.el.addEventListener('touchend', (e) => {
      if (rafId) cancelAnimationFrame(rafId);
      onEnd(e.changedTouches[0].clientY);
    }, {passive: true});

    this.el.addEventListener('mousedown', (e) => {
      onStart(e.clientY, e.target);
      if (!isDragging) return;
      const moveHandler = (ev) => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => onMove(ev.clientY));
      };
      const upHandler = (ev) => {
        if (rafId) cancelAnimationFrame(rafId);
        onEnd(ev.clientY);
        window.removeEventListener('mousemove', moveHandler);
        window.removeEventListener('mouseup', upHandler);
      };
      window.addEventListener('mousemove', moveHandler);
      window.addEventListener('mouseup', upHandler);
    });
  }
};

// ═══════════════════════════════════════════════════════════
// APP CORE
// ═══════════════════════════════════════════════════════════
const App = (function() {
  'use strict';

  let currentEpisode = null;
  let currentFrameIdx = 0;
  let frames = [];
  let gameAdvancePending = false;
  let typeWriterInterval = null;

  let audioEndedForFrame = false;
  let typewriterEndedForFrame = false;
  let uiHideTimeout = null;
  let subtitleSyncCleanup = null;

  const episodesCache = {};

  const mainMenu = document.getElementById('main-menu');
  const episodeViewer = document.getElementById('episode-viewer');
  const frameContainer = document.getElementById('frame-container');

  // ─── TYPEWRITER ───
  function stopTypeWriter() {
    if (typeWriterInterval) { clearInterval(typeWriterInterval); typeWriterInterval = null; }
  }

  function typeWriter(text, onUpdate, onEnd, delayMs) {
    stopTypeWriter();
    if (!text) { if (onEnd) onEnd(); return; }
    const words = text.trim().split(/\s+/);
    let i = 0;
    typeWriterInterval = setInterval(() => {
      if (i < words.length) {
        if (onUpdate) onUpdate(words.slice(0, i + 1).join(' '));
        i++;
      } else {
        stopTypeWriter();
        if (onEnd) onEnd();
      }
    }, delayMs || 350);
  }

  function splitLines(text, maxLen = 42) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach(w => {
      if ((line + ' ' + w).trim().length > maxLen) {
        if (line.trim()) lines.push(line.trim());
        line = w;
      } else {
        line += (line ? ' ' : '') + w;
      }
    });
    if (line.trim()) lines.push(line.trim());
    return lines;
  }

  // ─── EPISODE API ───
  async function fetchEpisode(episodeId) {
    if (episodesCache[episodeId]) return episodesCache[episodeId];
    try {
      const res = await fetch('/api/episodes/' + episodeId);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const normalized = normalizeEpisode(data.episode || data);
      episodesCache[episodeId] = normalized;
      return normalized;
    } catch (e) {
      console.warn('Failed to fetch episode', episodeId, e);
      return null;
    }
  }

  function resolveMediaPath(path) {
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('/uploads/')) return path;
    if (path.startsWith('assets/')) return path;
    if (path.startsWith('/')) return '/uploads' + path;
    return '/uploads/' + path;
  }

  function normalizeEpisode(apiData) {
    if (!apiData || !apiData.frames) return null;
    return {
      id: apiData.id,
      title: apiData.title || '',
      cover_image: resolveMediaPath(apiData.cover_image),
      frames: apiData.frames.map(function(f, idx) {
        var dialogues = f.dialogue || [];
        if (!dialogues.length && f.dialogue_json) {
          try { dialogues = JSON.parse(f.dialogue_json); } catch(e) {}
        }
        var dialogueAudio = []; // dialogue audio removed from playback
        var choices = f.choices || [];
        if (!choices.length && f.choices_json) {
          try { choices = JSON.parse(f.choices_json); } catch(e) {}
        }
        var availableGames = f.availableGames || [];
        if (!availableGames.length && f.available_games_json) {
          try { availableGames = JSON.parse(f.available_games_json); } catch(e) {}
        }
        return {
          id: f.id != null ? f.id : (idx + 1),
          title: f.title || '',
          narration: f.narration || '',
          bgImage: resolveMediaPath(f.background_image || f.bgImage),
          bgGradient: f.bg_gradient || f.bgGradient || f.mood || null,
          audioSrc: resolveMediaPath(f.audio_src || f.audioSrc),
          videoSrc: resolveMediaPath(f.background_video || f.videoSrc),
          dialogues: dialogues,
          dialogueAudio: [],
          transitionText: f.transition_text || f.transitionText || null,
          game: f.game_type || f.game || null,
          videoPrompt: f.video_prompt || f.videoPrompt || '',
          availableGames: availableGames,
          choices: choices
        };
      })
    };
  }

  // ─── RENDER FRAME ───
  function createFrameElement(frameData, idx, total) {
    const frame = document.createElement('div');
    frame.className = 'frame';
    frame.dataset.index = String(idx);

    const videoLayer = document.createElement('div');
    videoLayer.className = 'video-layer';

    if (frameData.videoSrc) {
      const img = document.createElement('img');
      img.className = 'frame-preview';
      img.src = frameData.bgImage || '';
      img.alt = '';
      videoLayer.appendChild(img);

      const info = document.createElement('div');
      info.className = 'frame-preview-info';
      const num = document.createElement('div');
      num.className = 'frame-preview-num';
      num.textContent = 'Кадр ' + (idx + 1);
      const title = document.createElement('div');
      title.className = 'frame-preview-title';
      title.textContent = frameData.title || '';
      info.appendChild(num);
      info.appendChild(title);
      videoLayer.appendChild(info);

      const btn = document.createElement('button');
      btn.className = 'video-play-btn';
      btn.textContent = '▶';
      videoLayer.appendChild(btn);

      const video = document.createElement('video');
      video.src = frameData.videoSrc;
      video.setAttribute('playsinline', '');
      video.setAttribute('preload', 'auto');

      video.addEventListener('error', function() {
        videoLayer.classList.add('video-error');
        img.style.display = 'none';
        info.style.display = 'none';
        btn.style.display = 'none';
        video.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.className = 'video-placeholder';
        const phIcon = document.createElement('div');
        phIcon.className = 'ph-icon';
        phIcon.textContent = '⚠️';
        const phText = document.createElement('div');
        phText.className = 'ph-text';
        phText.textContent = 'Видео недоступно';
        const phNote = document.createElement('div');
        phNote.className = 'ph-note';
        phNote.textContent = frameData.videoPrompt || '';
        placeholder.appendChild(phIcon);
        placeholder.appendChild(phText);
        placeholder.appendChild(phNote);
        videoLayer.appendChild(placeholder);
      });

      videoLayer.appendChild(video);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'video-placeholder';
      const phIcon = document.createElement('div');
      phIcon.className = 'ph-icon';
      phIcon.textContent = '🎬';
      const phText = document.createElement('div');
      phText.className = 'ph-text';
      phText.textContent = 'Видео: ' + (frameData.title || '');
      const phNote = document.createElement('div');
      phNote.className = 'ph-note';
      phNote.textContent = frameData.videoPrompt || '';
      placeholder.appendChild(phIcon);
      placeholder.appendChild(phText);
      placeholder.appendChild(phNote);
      videoLayer.appendChild(placeholder);
    }

    frame.appendChild(videoLayer);
    return frame;
  }

  // ─── PROGRESS DOTS ───
  function updateProgressDots(current, total) {
    const container = document.getElementById('progressDots');
    if (!container) return;
    container.textContent = '';
    const isNarrow = window.innerWidth < 480;
    let maxFrame = -1;
    if (currentEpisode && typeof PlayerProfile !== 'undefined' && PlayerProfile.getProgress) {
      const epId = Object.keys(episodesCache).find(function(key) { return episodesCache[key] === currentEpisode; });
      if (epId) maxFrame = PlayerProfile.getProgress(epId).maxFrame;
    }
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('div');
      const isSeen = i <= maxFrame;
      const isActive = i === current;
      dot.className = 'progress-dot' + (isActive ? ' active' : isSeen ? ' seen' : '');
      if (isSeen && !isActive) dot.setAttribute('aria-label', 'Просмотрено');
      container.appendChild(dot);
    }
    if (total > 20) {
      container.style.gap = isNarrow ? '2px' : '3px';
    } else if (total > 12) {
      container.style.gap = isNarrow ? '3px' : '4px';
    } else {
      container.style.gap = '';
    }
  }

  // ─── FRAME END CHECK ───
  function resetEndFlags() {
    audioEndedForFrame = false;
    typewriterEndedForFrame = false;
  }

  function checkFrameEnd() {
    if (audioEndedForFrame && typewriterEndedForFrame) {
      const frameData = frames[currentFrameIdx];
      BottomSheet.showNextButton(frameData?.transitionText || 'Далее');
    }
  }

  function onAudioEnd() {
    audioEndedForFrame = true;
    checkFrameEnd();
  }

  function onTypewriterEnd() {
    typewriterEndedForFrame = true;
    checkFrameEnd();
  }

  // ─── SUBTITLE SYNC ───
  function syncSubtitles(audio) {
    if (!audio) return;
    const frameData = AudioController.frameData;
    if (!frameData?.audioSrc || !audio.src.includes(frameData.audioSrc)) return;

    if (subtitleSyncCleanup) { subtitleSyncCleanup(); subtitleSyncCleanup = null; }
    SubtitleOverlay.clear();

    const narrationText = frameData.narration || '';
    if (!narrationText) return;

    const lines = splitLines(narrationText, 70);
    const lineCount = lines.length;
    let currentLineIdx = -1;

    const updateLine = (lineIdx) => {
      if (lineIdx === currentLineIdx) return;
      currentLineIdx = lineIdx;
      SubtitleOverlay.setText(lines[lineIdx]);
    };

    const fallbackTypewriter = () => {
      let idx = 0;
      const delay = Math.max(300, Math.min(800, 1000 / 2.2));
      typeWriterInterval = setInterval(() => {
        if (idx < lineCount) {
          updateLine(idx);
          idx++;
        } else {
          stopTypeWriter();
          onTypewriterEnd();
        }
      }, delay);
    };

    const startSync = () => {
      const duration = audio.duration;
      if (!duration || !isFinite(duration)) {
        fallbackTypewriter();
        return;
      }

      const onTimeUpdate = () => {
        const progress = audio.currentTime / duration;
        const lineIdx = Math.min(lineCount - 1, Math.floor(progress * lineCount));
        updateLine(lineIdx);
      };

      const onEnded = () => {
        if (subtitleSyncCleanup) { subtitleSyncCleanup(); subtitleSyncCleanup = null; }
        updateLine(lineCount - 1);
        onTypewriterEnd();
      };

      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('ended', onEnded);
      subtitleSyncCleanup = () => {
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('ended', onEnded);
      };

      onTimeUpdate();
    };

    if (audio.readyState >= 1) {
      startSync();
    } else {
      const onMeta = () => {
        audio.removeEventListener('loadedmetadata', onMeta);
        audio.removeEventListener('error', onErr);
        startSync();
      };
      const onErr = () => {
        audio.removeEventListener('loadedmetadata', onMeta);
        audio.removeEventListener('error', onErr);
        fallbackTypewriter();
      };
      audio.addEventListener('loadedmetadata', onMeta);
      audio.addEventListener('error', onErr);
      subtitleSyncCleanup = () => {
        audio.removeEventListener('loadedmetadata', onMeta);
        audio.removeEventListener('error', onErr);
      };
    }
  }

  function fallbackTypewriter() {
    const frameData = AudioController.frameData;
    const narrationText = frameData?.narration || '';
    if (!narrationText) {
      typewriterEndedForFrame = true;
      return;
    }
    const lines = splitLines(narrationText, 70);
    const lineCount = lines.length;
    let currentLineIdx = -1;

    const updateLine = (lineIdx) => {
      if (lineIdx === currentLineIdx) return;
      currentLineIdx = lineIdx;
      SubtitleOverlay.setText(lines[lineIdx]);
    };

    let idx = 0;
    const delay = Math.max(300, Math.min(800, 1000 / 2.2));
    typeWriterInterval = setInterval(() => {
      if (idx < lineCount) {
        updateLine(idx);
        idx++;
      } else {
        stopTypeWriter();
        onTypewriterEnd();
      }
    }, delay);
  }

  // ─── SHOW FRAME ───
  function showFrame(idx, direction) {
    gameAdvancePending = false;
    const allFrames = document.querySelectorAll('.frame');
    AudioController.stop();
    stopTypeWriter();
    if (subtitleSyncCleanup) { subtitleSyncCleanup(); subtitleSyncCleanup = null; }
    resetEndFlags();
    BottomSheet.hideNextButton();

    if (!direction) allFrames.forEach(f => f.style.transition = 'none');

    allFrames.forEach((f, i) => {
      const v = f.querySelector('video');
      const preview = f.querySelector('.frame-preview');
      const previewInfo = f.querySelector('.frame-preview-info');
      const playBtn = f.querySelector('.video-play-btn');
      if (v) {
        v.pause();
        v.currentTime = 0;
        v.classList.remove('visible');
      }
      if (preview) preview.classList.remove('hidden');
      if (previewInfo) previewInfo.classList.remove('hidden');
      if (playBtn) playBtn.style.display = 'flex';
      f.classList.remove('active', 'above', 'below');
      if (i === idx) f.classList.add('active');
      else if (i < idx) f.classList.add('above');
      else f.classList.add('below');
    });

    if (!direction) {
      requestAnimationFrame(() => allFrames.forEach(f => f.style.transition = ''));
    }

    currentFrameIdx = idx;
    const frameData = frames[idx];

    // Autosave progress
    if (currentEpisode && typeof PlayerProfile !== 'undefined' && PlayerProfile.markFrameSeen) {
      const epId = Object.keys(episodesCache).find(function(key) { return episodesCache[key] === currentEpisode; });
      if (epId) PlayerProfile.markFrameSeen(epId, idx);
    }

    updateProgressDots(idx, frames.length);
    SubtitleOverlay.clear();
    BottomSheet.setNarratorFull(frameData?.narration || '');
    BottomSheet.renderGameDock(frameData?.availableGames || []);
    BottomSheet.renderGamePanel(frameData?.availableGames || []);

    if (frameData?.game) {
      BottomSheet.showGameIsland(frameData.game);
    } else {
      BottomSheet.hideGameIsland();
    }

    AudioController.setFrameData(frameData);
    AudioController.play();

    const narrationText = frameData?.narration || '';
    if (narrationText) {
      const narrationAudio = AudioController.currentAudio;
      if (narrationAudio && frameData?.audioSrc && narrationAudio.src.includes(frameData.audioSrc)) {
        syncSubtitles(narrationAudio);
      } else {
        fallbackTypewriter();
      }
    } else {
      typewriterEndedForFrame = true;
    }

    if (typeof PlayerProfile !== 'undefined' && PlayerProfile.renderBadge) {
      PlayerProfile.renderBadge();
    }

    // Ensure UI is visible on frame change
    clearTimeout(uiHideTimeout);
    episodeViewer.classList.remove('ui-hidden');

    updateNavArrows();
  }

  function updateNavArrows() {
    const up = document.getElementById('navArrowUp');
    const down = document.getElementById('navArrowDown');
    if (up) up.classList.toggle('hidden', currentFrameIdx <= 0);
    if (down) down.classList.toggle('hidden', currentFrameIdx >= frames.length - 1);
  }

  function animateTo(idx, direction) {
    if (idx < 0 || idx >= frames.length) return;
    showFrame(idx, direction);
  }

  function nextFrame() {
    const frameData = frames[currentFrameIdx];
    if (frameData && frameData.game && !gameAdvancePending) {
      gameAdvancePending = true;
      BottomSheet.showGameIsland(frameData.game);
      return;
    }
    if (currentFrameIdx < frames.length - 1) {
      animateTo(currentFrameIdx + 1, 'next');
    } else {
      showEndScreen();
    }
  }

  function advanceFromGame() {
    if (gameAdvancePending) {
      gameAdvancePending = false;
      if (currentFrameIdx < frames.length - 1) {
        animateTo(currentFrameIdx + 1, 'next');
      } else {
        showEndScreen();
      }
    }
  }

  function prevFrame() {
    if (currentFrameIdx > 0) animateTo(currentFrameIdx - 1, 'prev');
  }

  // ─── GAME INTEGRATION ───
  function startGame(gameType) {
    AudioController.stop();
    document.querySelectorAll('.frame.active video').forEach(v => {
      v.pause();
      v.currentTime = 0;
      v.classList.remove('visible');
    });
    if (gameType === 'runner') {
      showGameTransition('🏃 Мини-игра!', 'Помоги Суперглазке догнать Пикселька!', () => {
        if (typeof startRunnerGame === 'function') startRunnerGame();
      });
    } else if (gameType === 'gym') {
      showGameTransition('⚔️ Ваня против Ленивуса!', 'Используй три супер-атаки: Лазер, Прицел и Слёзы.', () => {
        if (typeof startGymGame === 'function') startGymGame();
      });
    } else if (gameType === 'blink') {
      showGameTransition('👁️ Моргайка!', 'Тренируем глазные мышцы: моргай, жмурься и распахивай глаза!', () => {
        if (typeof startBlinkGame === 'function') startBlinkGame();
      });
    } else if (gameType === 'tracker') {
      showGameTransition('🔮 Следи за шариком!', 'Следи глазами за светящимся шариком — тренируем внимание!', () => {
        if (typeof startTrackerGame === 'function') startTrackerGame();
      });
    }
  }

  function launchGame(gameType) {
    AudioController.stop();
    document.querySelectorAll('.frame.active video').forEach(v => {
      v.pause();
      v.currentTime = 0;
      v.classList.remove('visible');
    });
    if (gameType === 'runner') {
      if (typeof startRunnerGame === 'function') startRunnerGame();
    } else if (gameType === 'gym') {
      if (typeof startGymGame === 'function') startGymGame();
    } else if (gameType === 'blink') {
      if (typeof startBlinkGame === 'function') startBlinkGame();
    } else if (gameType === 'tracker') {
      if (typeof startTrackerGame === 'function') startTrackerGame();
    }
  }

  function showGameTransition(title, subtitle, onStart) {
    const overlay = document.getElementById('game-transition-overlay');
    if (!overlay) { if (onStart) onStart(); return; }
    const tTitle = overlay.querySelector('.gt-title');
    const tSub = overlay.querySelector('.gt-sub');
    if (tTitle) tTitle.textContent = title;
    if (tSub) tSub.textContent = subtitle;
    overlay.classList.add('visible');
    const btn = overlay.querySelector('.gt-btn');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      const start = () => { overlay.classList.remove('visible'); if (onStart) setTimeout(onStart, 300); };
      newBtn.addEventListener('click', start);
      newBtn.addEventListener('touchstart', (e) => { e.preventDefault(); start(); }, {passive: false});
    }
  }

  // ─── TRANSITIONS & END ───
  function showTransition(onComplete) {
    const overlay = document.getElementById('transition-overlay');
    if (!overlay) { if (onComplete) onComplete(); return; }
    overlay.classList.add('visible');
    setTimeout(() => {
      overlay.classList.remove('visible');
      if (onComplete) onComplete();
    }, 800);
  }

  function showEndScreen() {
    const text = document.querySelector('#transition-overlay .transition-text');
    if (text) text.textContent = 'Глава завершена! Скоро продолжение...';
    const overlay = document.getElementById('transition-overlay');
    if (overlay) overlay.classList.add('visible');
    // Mark episode as completed
    if (currentEpisode && typeof PlayerProfile !== 'undefined' && PlayerProfile.completeEpisode) {
      const epId = Object.keys(episodesCache).find(function(key) { return episodesCache[key] === currentEpisode; });
      if (epId) PlayerProfile.completeEpisode(epId);
    }
    setTimeout(() => {
      if (overlay) overlay.classList.remove('visible');
      backToMenu();
    }, 3000);
  }

  // ─── MENU ───
  async function startEpisode(episodeId, startFrame) {
    startFrame = typeof startFrame === 'number' ? startFrame : 0;
    var epData = episodesCache[episodeId];
    if (!epData) {
      epData = await fetchEpisode(episodeId);
    }
    if (!epData) return;
    currentEpisode = epData;
    frames = epData.frames;
    if (frameContainer) {
      frameContainer.textContent = '';
      frames.forEach(function(f, i) {
        frameContainer.appendChild(createFrameElement(f, i, frames.length));
      });
    }
    if (mainMenu) mainMenu.classList.add('hidden');
    if (episodeViewer) episodeViewer.classList.add('active');
    BottomSheet.recalcSnapPoints();
    BottomSheet.collapse();
    if (typeof PlayerProfile !== 'undefined') PlayerProfile.renderBadge();
    bindFrameEvents();
    showFrame(startFrame, null);
  }

  function backToMenu() {
    AudioController.stop();
    if (typeof BackgroundMusic !== 'undefined') BackgroundMusic.stop();
    if (episodeViewer) episodeViewer.classList.remove('active');
    if (mainMenu) mainMenu.classList.remove('hidden');
    if (frameContainer) frameContainer.textContent = '';
    currentEpisode = null;
    frames = [];
    currentFrameIdx = 0;
    renderContinueButton();
  }

  async function renderContinueButton() {
    var block = document.getElementById('continueBlock');
    var btn = document.getElementById('continueBtn');
    var info = document.getElementById('continueInfo');
    var previewImg = document.getElementById('continuePreview');
    if (!block || !btn) return;
    if (typeof PlayerProfile === 'undefined' || !PlayerProfile.getLastPosition) {
      block.style.display = 'none';
      if (previewImg) previewImg.style.display = 'none';
      return;
    }
    var pos = PlayerProfile.getLastPosition();
    if (pos && pos.frameIdx >= 0) {
      var cached = episodesCache[pos.episodeId];
      var epName = cached && cached.title ? cached.title : 'Глава ' + pos.episodeId;
      if (info) info.textContent = 'Глава ' + pos.episodeId + ' — ' + epName;
      if (previewImg) {
        var episode = episodesCache[pos.episodeId];
        if (!episode) {
          episode = await fetchEpisode(pos.episodeId);
        }
        if (episode && episode.frames[pos.frameIdx] && episode.frames[pos.frameIdx].bgImage) {
          previewImg.src = episode.frames[pos.frameIdx].bgImage;
          previewImg.style.display = 'block';
        } else {
          previewImg.style.display = 'none';
        }
      }
      btn.textContent = '▶ Продолжить';
      btn.onclick = function() { startEpisode(pos.episodeId, pos.frameIdx); };
      block.style.display = 'flex';
    } else {
      block.style.display = 'none';
      if (previewImg) previewImg.style.display = 'none';
    }
  }

  // ─── MAIN MENU v2 ───
  const BOOKS = [
    {
      num: 1,
      title: 'Книга 1: Рождение героини',
      episodes: [
        { id: 1, title: 'Рождение героини', locked: false },
        { id: 2, title: 'Кто я?', locked: false },
        { id: 3, title: 'Великая битва', locked: true },
        { id: 4, title: 'Тайна хрусталика', locked: true },
        { id: 5, title: 'Первое испытание', locked: true },
        { id: 6, title: 'Тренировка зрения', locked: true },
        { id: 7, title: 'Встреча с тьмой', locked: true },
        { id: 8, title: 'Пикселек бунтует', locked: true },
        { id: 9, title: 'Секретная база', locked: true },
        { id: 10, title: 'Новый союзник', locked: true }
      ]
    },
    {
      num: 2,
      title: 'Книга 2: Тёмные силы',
      episodes: [
        { id: 11, title: 'Возвращение тьмы', locked: true },
        { id: 12, title: 'Ловушка для глаз', locked: true },
        { id: 13, title: 'Подземный мир', locked: true },
        { id: 14, title: 'Кристалл силы', locked: true },
        { id: 15, title: 'Битва за мост', locked: true },
        { id: 16, title: 'Пленники экрана', locked: true },
        { id: 17, title: 'Побег из тьмы', locked: true },
        { id: 18, title: 'Свет надежды', locked: true },
        { id: 19, title: 'Финальная тренировка', locked: true },
        { id: 20, title: 'Перед боем', locked: true }
      ]
    },
    {
      num: 3,
      title: 'Книга 3: Финал',
      episodes: [
        { id: 21, title: 'Великая битва', locked: true },
        { id: 22, title: 'Сила команды', locked: true },
        { id: 23, title: 'Последний рубеж', locked: true },
        { id: 24, title: 'Тьма vs Свет', locked: true },
        { id: 25, title: 'Решающий момент', locked: true },
        { id: 26, title: 'Жертва ради мира', locked: true },
        { id: 27, title: 'Возрождение Видеали', locked: true },
        { id: 28, title: 'Новая эра', locked: true },
        { id: 29, title: 'Прощание с героем', locked: true },
        { id: 30, title: 'Начало легенды', locked: true }
      ]
    }
  ];

  function getEpisodeStatus(epId) {
    if (typeof PlayerProfile === 'undefined' || !PlayerProfile.getProgress) return { completed: false, seen: false };
    var prog = PlayerProfile.getProgress(epId);
    return { completed: prog.completed, seen: prog.maxFrame >= 0 };
  }

  function getEpisodeProgress(epId) {
    var ep = episodesCache[epId];
    var total = ep && ep.frames ? ep.frames.length : 10;
    var current = 0;
    if (typeof PlayerProfile !== 'undefined' && PlayerProfile.getProgress) {
      var p = PlayerProfile.getProgress(epId);
      current = Math.max(0, p.maxFrame + 1);
    }
    return {
      current: current,
      total: total,
      percent: total > 0 ? Math.min(100, Math.round(current / total * 100)) : 0
    };
  }

  var APP_BOOKS = [];

  function isEpisodeLocked(episodes, idx) {
    if (idx === 0) return false;
    var prevId = episodes[idx - 1].id;
    if (typeof PlayerProfile !== 'undefined' && PlayerProfile.getProgress) {
      return !PlayerProfile.getProgress(prevId).completed;
    }
    return true;
  }

  async function loadBooks() {
    try {
      const res = await fetch('/api/episodes');
      const data = await res.json();
      if (!data || !data.episodes) {
        APP_BOOKS = BOOKS;
        return;
      }
      var booksMap = {};
      data.episodes.forEach(function(ep) {
        var bookNum = ep.book_num || 1;
        if (!booksMap[bookNum]) {
          booksMap[bookNum] = { num: bookNum, title: 'Книга ' + bookNum, episodes: [] };
        }
        booksMap[bookNum].episodes.push({
          id: ep.id,
          title: ep.title,
          cover_image: ep.cover_image,
          locked: false
        });
      });
      APP_BOOKS = Object.keys(booksMap).sort(function(a, b) { return a - b; }).map(function(k) {
        return booksMap[k];
      });
      if (!APP_BOOKS.length) APP_BOOKS = BOOKS;
    } catch (e) {
      console.warn('Failed to load books from API, using defaults:', e);
      APP_BOOKS = BOOKS;
    }
  }

  function renderBooks() {
    const tabsContainer = document.getElementById('booksTabs');
    const contentContainer = document.getElementById('booksContent');
    if (!tabsContainer || !contentContainer) return;

    tabsContainer.textContent = '';
    contentContainer.textContent = '';

    if (!APP_BOOKS.length) {
      contentContainer.innerHTML = '<div class="empty-state" style="padding:40px;text-align:center;color:rgba(255,255,255,0.5);">Загрузка глав...</div>';
      return;
    }

    APP_BOOKS.forEach(function(book, bookIdx) {
      var tab = document.createElement('button');
      tab.className = 'book-tab' + (bookIdx === 0 ? ' active' : '');
      tab.textContent = 'Книга ' + book.num;
      tab.addEventListener('click', function() {
        tabsContainer.querySelectorAll('.book-tab').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        contentContainer.querySelectorAll('.book-grid').forEach(function(g) { g.classList.add('hidden'); });
        var target = document.getElementById('bookGrid' + book.num);
        if (target) target.classList.remove('hidden');
      });
      tabsContainer.appendChild(tab);

      var grid = document.createElement('div');
      grid.className = 'book-grid' + (bookIdx === 0 ? '' : ' hidden');
      grid.id = 'bookGrid' + book.num;

      book.episodes.forEach(function(ep, epIdx) {
        var locked = isEpisodeLocked(book.episodes, epIdx);
        var status = getEpisodeStatus(ep.id);
        var progress = getEpisodeProgress(ep.id);
        var mini = document.createElement('div');
        mini.className = 'episode-mini' + (locked ? ' locked' : '');
        mini.dataset.episode = ep.id;

        var cached = episodesCache[ep.id];
        var coverImg = document.createElement('img');
        coverImg.className = 'episode-mini-cover';
        coverImg.alt = '';
        coverImg.src = cached && cached.cover_image
          ? cached.cover_image
          : 'assets/episodes/episode-' + String(ep.id).padStart(2, '0') + '/cover.png';
        coverImg.onerror = function() { coverImg.style.display = 'none'; };

        var numEl = document.createElement('div');
        numEl.className = 'episode-mini-num';
        numEl.textContent = 'Эп. ' + ep.id;

        var titleEl = document.createElement('div');
        titleEl.className = 'episode-mini-title';
        titleEl.textContent = cached && cached.title ? cached.title : ep.title;

        var statusEl = document.createElement('div');
        statusEl.className = 'episode-mini-status';
        if (locked) {
          statusEl.textContent = '\uD83D\uDD12';
        } else if (status.completed) {
          statusEl.textContent = '\u2705';
        } else if (status.seen) {
          statusEl.textContent = '\u25B6';
        } else {
          statusEl.textContent = '\u26AA';
        }

        var progressTrack = document.createElement('div');
        progressTrack.className = 'progress-track';
        var progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.width = progress.percent + '%';
        progressTrack.appendChild(progressFill);

        mini.appendChild(coverImg);
        mini.appendChild(numEl);
        mini.appendChild(titleEl);
        mini.appendChild(statusEl);
        mini.appendChild(progressTrack);

        if (!locked) {
          mini.addEventListener('click', function() {
            startEpisode(ep.id);
          });
        }

        grid.appendChild(mini);
      });

      contentContainer.appendChild(grid);
    });
  }

  function renderOverallProgress() {
    var container = document.getElementById('overallProgress');
    if (!container) return;
    var totalSeen = 0, totalFrames = 0;
    APP_BOOKS.forEach(function(book) {
      book.episodes.forEach(function(ep) {
        var prog = getEpisodeProgress(ep.id);
        totalSeen += prog.current;
        totalFrames += prog.total;
      });
    });
    var pct = totalFrames > 0 ? Math.round(totalSeen / totalFrames * 100) : 0;
    container.textContent = '';

    var text = document.createElement('div');
    text.className = 'overall-progress-text';
    text.textContent = 'Общий прогресс: ' + totalSeen + ' из ' + totalFrames + ' кадров';

    var barTrack = document.createElement('div');
    barTrack.className = 'progress-track overall-track';
    var barFill = document.createElement('div');
    barFill.className = 'progress-fill';
    barFill.style.width = pct + '%';
    barTrack.appendChild(barFill);

    container.appendChild(text);
    container.appendChild(barTrack);
  }

  function startCountdown(targetISO) {
    var els = {
      days: document.getElementById('cdDays'),
      hours: document.getElementById('cdHours'),
      minutes: document.getElementById('cdMinutes'),
      seconds: document.getElementById('cdSeconds')
    };
    if (!els.days || !els.hours || !els.minutes || !els.seconds) return;

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function tick() {
      var diff = new Date(targetISO) - Date.now();
      if (diff <= 0) {
        els.days.textContent = '00';
        els.hours.textContent = '00';
        els.minutes.textContent = '00';
        els.seconds.textContent = '00';
        return;
      }
      var days = Math.floor(diff / (1000 * 60 * 60 * 24));
      var hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      var minutes = Math.floor((diff / (1000 * 60)) % 60);
      var seconds = Math.floor((diff / 1000) % 60);
      els.days.textContent = pad(days);
      els.hours.textContent = pad(hours);
      els.minutes.textContent = pad(minutes);
      els.seconds.textContent = pad(seconds);
    }

    tick();
    setInterval(tick, 1000);
  }

  // ─── EVENT BINDING ───
  function bindFrameEvents() {
    // Video play & toggle (delegated)
    frameContainer.addEventListener('click', (e) => {
      const playBtn = e.target.closest('.video-play-btn');
      if (playBtn) {
        const layer = playBtn.closest('.video-layer');
        const preview = layer?.querySelector('.frame-preview');
        const previewInfo = layer?.querySelector('.frame-preview-info');
        const video = layer?.querySelector('video');
        if (preview) preview.classList.add('hidden');
        if (previewInfo) previewInfo.classList.add('hidden');
        if (video) {
          video.classList.add('visible');
          video.muted = true;
          video.volume = 0;
          video.play().catch(() => {});
        }
        playBtn.style.display = 'none';
        return;
      }
      const video = e.target.closest('.video-layer video');
      if (video) {
        if (video.paused) video.play().catch(() => {});
        else video.pause();
        return;
      }
    });

    // Video ended — direct binding (ended event does not bubble reliably)
    document.querySelectorAll('.video-layer video').forEach(video => {
      video.addEventListener('ended', () => {
        const layer = video.closest('.video-layer');
        const preview = layer?.querySelector('.frame-preview');
        const previewInfo = layer?.querySelector('.frame-preview-info');
        const playBtn = layer?.querySelector('.video-play-btn');
        video.classList.remove('visible');
        if (preview) preview.classList.remove('hidden');
        if (previewInfo) previewInfo.classList.remove('hidden');
        if (playBtn) playBtn.style.display = 'flex';
      });
    });
  }

  // ─── SWIPE ───
  function initSwipe() {
    if (!frameContainer) return;
    let startY = 0, startX = 0, isDragging = false;
    const SWIPE_THRESHOLD = 80;

    function onStart(y, x) { startY = y; startX = x; isDragging = true; }
    function onEnd(y, x) {
      if (!isDragging) return;
      isDragging = false;
      const deltaY = y - startY;
      const deltaX = x - startX;
      if (Math.abs(deltaX) > Math.abs(deltaY)) return;
      if (deltaY < -SWIPE_THRESHOLD) nextFrame();
      else if (deltaY > SWIPE_THRESHOLD) prevFrame();
    }

    frameContainer.addEventListener('touchstart', e => {
      if (e.target.closest('.video-play-btn, .bottom-sheet, .frame-top-bar')) return;
      onStart(e.touches[0].clientY, e.touches[0].clientX);
    }, {passive: true});
    frameContainer.addEventListener('touchend', e => {
      if (!isDragging) return;
      onEnd(e.changedTouches[0].clientY, e.changedTouches[0].clientX);
    }, {passive: true});

    frameContainer.addEventListener('mousedown', e => {
      if (e.target.closest('.video-play-btn, .bottom-sheet, .frame-top-bar')) return;
      onStart(e.clientY, e.clientX);
    });
    frameContainer.addEventListener('mouseup', e => {
      if (!isDragging) return;
      onEnd(e.clientY, e.clientX);
    });
    frameContainer.addEventListener('mouseleave', () => { isDragging = false; });
  }

  // ─── AUTH MODAL ───
  function initAuthModal() {
    var modal = document.getElementById('auth-modal');
    if (!modal) return;

    var tabs = modal.querySelectorAll('.auth-tab');
    var panels = modal.querySelectorAll('.auth-panel');

    function showPanel(id) {
      panels.forEach(function(p) { p.classList.remove('active'); });
      tabs.forEach(function(t) { t.classList.remove('active'); });
      var target = modal.querySelector('#authPanel' + id);
      if (target) target.classList.add('active');
      var tab = modal.querySelector('.auth-tab[data-tab="' + id.toLowerCase() + '"]');
      if (tab) tab.classList.add('active');
    }

    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        showPanel(tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1));
      });
    });

    var authClose = document.getElementById('authClose');
    if (authClose) {
      authClose.addEventListener('click', function() { modal.classList.remove('visible'); });
    }

    var authGuestBtn = document.getElementById('authGuestBtn');
    if (authGuestBtn) {
      authGuestBtn.addEventListener('click', async function() {
        var nick = document.getElementById('authGuestNickname').value.trim();
        if (!nick) { alert('\u0412\u0432\u0435\u0434\u0438 \u043d\u0438\u043a\u043d\u0435\u0439\u043c!'); return; }
        try {
          await Auth.guestLogin(nick);
          modal.classList.remove('visible');
          window.location.reload();
        } catch (e) {
          alert('\u041e\u0448\u0438\u0431\u043a\u0430: ' + (e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u043e\u0439\u0442\u0438'));
        }
      });
    }

    var authRegBtn = document.getElementById('authRegBtn');
    if (authRegBtn) {
      authRegBtn.addEventListener('click', async function() {
        var nick = document.getElementById('authRegNickname').value.trim();
        var email = document.getElementById('authRegEmail').value.trim();
        var phone = document.getElementById('authRegPhone').value.trim();
        var password = document.getElementById('authRegPassword').value;
        if (!nick || !email || !password) { alert('\u0417\u0430\u043f\u043e\u043b\u043d\u0438 \u0432\u0441\u0435 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u043f\u043e\u043b\u044f!'); return; }
        try {
          await Auth.register(email, phone, password, nick);
          modal.classList.remove('visible');
          window.location.reload();
        } catch (e) {
          alert('\u041e\u0448\u0438\u0431\u043a\u0430: ' + (e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c\u0441\u044f'));
        }
      });
    }

    var authLoginBtn = document.getElementById('authLoginBtn');
    if (authLoginBtn) {
      authLoginBtn.addEventListener('click', async function() {
        var email = document.getElementById('authLoginEmail').value.trim();
        var password = document.getElementById('authLoginPassword').value;
        if (!email || !password) { alert('\u0412\u0432\u0435\u0434\u0438 email \u0438 \u043f\u0430\u0440\u043e\u043b\u044c!'); return; }
        try {
          await Auth.login(email, password);
          modal.classList.remove('visible');
          window.location.reload();
        } catch (e) {
          alert('\u041e\u0448\u0438\u0431\u043a\u0430: ' + (e.message || '\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 email \u0438\u043b\u0438 \u043f\u0430\u0440\u043e\u043b\u044c'));
        }
      });
    }

    var authShowLogin = document.getElementById('authShowLogin');
    if (authShowLogin) {
      authShowLogin.addEventListener('click', function(e) {
        e.preventDefault();
        showPanel('Login');
      });
    }

    var authShowRegister = document.getElementById('authShowRegister');
    if (authShowRegister) {
      authShowRegister.addEventListener('click', function(e) {
        e.preventDefault();
        showPanel('Register');
      });
    }

    // Profile subscription
    var profileSubBtn = document.getElementById('profileSubBtn');
    if (profileSubBtn) {
      profileSubBtn.addEventListener('click', async function() {
        var emailInput = document.getElementById('profileSubEmail');
        var email = emailInput ? emailInput.value.trim() : '';
        if (!email) { alert('\u0412\u0432\u0435\u0434\u0438 email!'); return; }
        try {
          await Auth.subscribeEmail(email);
          alert('\u2705 \u041f\u043e\u0434\u043f\u0438\u0441\u043a\u0430 \u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u0430!');
          if (emailInput) emailInput.value = '';
        } catch (e) {
          alert('\u041e\u0448\u0438\u0431\u043a\u0430: ' + (e.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0434\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f'));
        }
      });
    }

    // Profile account buttons (delegation — created dynamically in player.js)
    var profileModal = document.getElementById('profile-modal');
    if (profileModal) {
      profileModal.addEventListener('click', function(e) {
        if (e.target.id === 'profileRegBtn') {
          e.stopPropagation();
          profileModal.classList.remove('visible');
          showPanel('Register');
          showAuthModal();
        } else if (e.target.id === 'profileLoginBtn') {
          e.stopPropagation();
          profileModal.classList.remove('visible');
          showPanel('Login');
          showAuthModal();
        } else if (e.target.id === 'profileLogoutBtn') {
          e.stopPropagation();
          Auth.logout();
        }
      });
    }
  }

  function showAuthModal() {
    var modal = document.getElementById('auth-modal');
    if (modal) modal.classList.add('visible');
  }

  // ─── INIT ───
  function init() {
    var settingsDropdown = null;
    var faqDropdown = null;
    ThemeManager.init();
    Auth.init();
    initAuthModal();
    if (!Auth.isLoggedIn()) {
      showAuthModal();
    }
    DeviceDetector.detect();
    DeviceDetector.onResize();
    AppSettings.load();
    AppSettings.apply();
    initSwipe();
    BottomSheet.init();
    renderContinueButton();
    startCountdown('2026-05-25T12:00:00');
    AudioController.onAudioStart((audio) => syncSubtitles(audio));

    const navArrowUp = document.getElementById('navArrowUp');
    const navArrowDown = document.getElementById('navArrowDown');
    if (navArrowUp) navArrowUp.addEventListener('click', () => prevFrame());
    if (navArrowDown) navArrowDown.addEventListener('click', () => nextFrame());

    const subOverlay = document.getElementById('subtitleOverlay');
    if (subOverlay) {
      subOverlay.addEventListener('click', (e) => e.stopPropagation());
      subOverlay.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    }

    const cinemaToggleBtn = document.getElementById('cinemaToggleBtn');
    if (cinemaToggleBtn) {
      cinemaToggleBtn.addEventListener('click', () => {
        episodeViewer.classList.toggle('ui-hidden');
      });
    }

    var settingsMenuBtnEl = document.getElementById('settingsMenuBtn');
    settingsDropdown = document.getElementById('settingsDropdown');
    if (settingsMenuBtnEl && settingsDropdown) {
      settingsMenuBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsDropdown.classList.toggle('visible');
        if (faqDropdown) faqDropdown.classList.remove('visible');
      });
      document.addEventListener('click', (e) => {
        if (!settingsDropdown.contains(e.target) && e.target !== settingsMenuBtnEl) {
          settingsDropdown.classList.remove('visible');
        }
      });
    }

    var faqBtnEl = document.getElementById('faqBtn');
    faqDropdown = document.getElementById('faqDropdown');
    const faqClose = document.getElementById('faqClose');
    if (faqBtnEl && faqDropdown) {
      faqBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        faqDropdown.classList.toggle('visible');
        if (settingsDropdown) settingsDropdown.classList.remove('visible');
      });
      if (faqClose) {
        faqClose.addEventListener('click', (e) => {
          e.stopPropagation();
          faqDropdown.classList.remove('visible');
        });
      }
      document.addEventListener('click', (e) => {
        if (!faqDropdown.contains(e.target) && e.target !== faqBtnEl) {
          faqDropdown.classList.remove('visible');
        }
      });
    }

    // Main menu v2 bindings
    // Load books from API, cache episodes, then render menu
    loadBooks().then(function() {
      renderBooks();
      renderOverallProgress();
      return fetch('/api/episodes');
    }).then(function(r) { return r.json(); })
      .then(async function(list) {
        if (list && list.episodes) {
          await Promise.all(list.episodes.map(function(ep) {
            return fetchEpisode(ep.id);
          }));
          renderBooks();
          renderOverallProgress();
          renderContinueButton();
        }
      })
      .catch(function(e) { console.warn('Failed to preload episodes', e); });

    // Handle ?episode=X and ?game=X in URL
    var urlParams = new URLSearchParams(window.location.search);
    var directEpisode = urlParams.get('episode');
    if (directEpisode) {
      startEpisode(parseInt(directEpisode, 10), 0);
    }
    var directGame = urlParams.get('game');
    if (directGame && ['runner', 'gym', 'blink', 'tracker'].indexOf(directGame) !== -1) {
      launchGame(directGame);
    }

    var appNavToggle = document.getElementById('appNavToggle');
    var appNavMobile = document.getElementById('appNavMobile');
    var appNavClose = document.getElementById('appNavClose');
    if (appNavToggle && appNavMobile) {
      appNavToggle.addEventListener('click', function() { appNavMobile.classList.add('open'); });
    }
    if (appNavClose && appNavMobile) {
      appNavClose.addEventListener('click', function() { appNavMobile.classList.remove('open'); });
    }

    var menuSettingsBtn = document.getElementById('menuSettingsBtn');
    if (menuSettingsBtn && settingsDropdown) {
      menuSettingsBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        settingsDropdown.classList.toggle('visible');
        if (faqDropdown) faqDropdown.classList.remove('visible');
      });
    }
    var menuSettingsBtnMobile = document.getElementById('menuSettingsBtnMobile');
    if (menuSettingsBtnMobile && settingsDropdown && appNavMobile) {
      menuSettingsBtnMobile.addEventListener('click', function(e) {
        e.stopPropagation();
        appNavMobile.classList.remove('open');
        settingsDropdown.classList.toggle('visible');
        if (faqDropdown) faqDropdown.classList.remove('visible');
      });
    }
    var menuProfileBtnMobile = document.getElementById('menuProfileBtnMobile');
    if (menuProfileBtnMobile && appNavMobile) {
      menuProfileBtnMobile.addEventListener('click', function() { appNavMobile.classList.remove('open'); });
    }

    document.querySelectorAll('#viewerBackBtn, .back-btn').forEach(btn => {
      btn.addEventListener('click', () => backToMenu());
    });

    document.addEventListener('keydown', (e) => {
      if (!episodeViewer || !episodeViewer.classList.contains('active')) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        const frameData = frames[currentFrameIdx];
        if (frameData && frameData.game) BottomSheet.showGameIsland(frameData.game);
        else nextFrame();
      }
      if (e.key === 'ArrowLeft') prevFrame();
      if (e.key === 'Escape') backToMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { startEpisode, backToMenu, nextFrame, prevFrame, advanceFromGame, startGame, launchGame, onAudioEnd };
})();

/* ═══════════════════════════════════════════════════════════
   LEGACY GAME COMPATIBILITY SHIMS
   ═══════════════════════════════════════════════════════════ */

window.closeRunner = function(skip) {
  document.getElementById('game-overlay-runner').classList.remove('visible');
  if (skip) setTimeout(() => { if (typeof App !== 'undefined') App.advanceFromGame(); }, 300);
};

window.showRunnerRegistration = function() {
  document.getElementById('runner-stats-overlay').classList.remove('visible');
  document.getElementById('runner-registration-overlay').classList.add('visible');
};

window.skipRunnerRegistration = function() {
  document.getElementById('runner-registration-overlay').classList.remove('visible');
  if (typeof App !== 'undefined') App.advanceFromGame();
};

window.finishRunnerRegistration = function() {
  document.getElementById('runner-registration-overlay').classList.remove('visible');
  if (typeof App !== 'undefined') App.advanceFromGame();
};

window.closeGym = function(skip) {
  document.getElementById('game-overlay-gym').classList.remove('visible');
  if (skip) setTimeout(() => { if (typeof App !== 'undefined') App.advanceFromGame(); }, 300);
};

window.showRegistration = function() {
  document.getElementById('stats-overlay').classList.remove('visible');
  document.getElementById('registration-overlay').classList.add('visible');
};

window.skipRegistration = function() {
  document.getElementById('registration-overlay').classList.remove('visible');
  if (typeof App !== 'undefined') App.advanceFromGame();
};

window.finishRegistration = function() {
  document.getElementById('registration-overlay').classList.remove('visible');
  if (typeof App !== 'undefined') App.advanceFromGame();
};

window.closeWinContinue = function() {
  document.getElementById('win-overlay').classList.remove('visible');
  setTimeout(() => { if (typeof App !== 'undefined') App.advanceFromGame(); }, 300);
};

window.hideOverlay = function(id) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.classList.remove('visible');
};
