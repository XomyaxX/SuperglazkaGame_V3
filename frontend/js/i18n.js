/**
 * i18n — lightweight internationalization for Superglazka
 * Supports: ru (default), en, kz, zh
 */
(function() {
  'use strict';

  var STORAGE_KEY = 'superglazka_lang';
  var currentLang = 'ru';
  var dictionary = {};
  var loaded = false;
  var onReadyCallbacks = [];

  function detectLang() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved && /^[a-z]{2}$/.test(saved)) return saved;
    var nav = navigator.language || navigator.userLanguage || 'ru';
    var code = nav.slice(0, 2).toLowerCase();
    if (code === 'en') return 'en';
    if (code === 'kk' || code === 'kz') return 'kz';
    if (code === 'zh') return 'zh';
    return 'ru';
  }

  function get(obj, path) {
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (obj == null) return undefined;
      obj = obj[parts[i]];
    }
    return obj;
  }

  function t(key, vars) {
    var str = get(dictionary[currentLang], key);
    if (str === undefined) {
      str = get(dictionary.ru, key);
    }
    if (str === undefined) return key;
    if (vars) {
      str = str.replace(/\{\{(\w+)\}\}/g, function(_, name) {
        return vars[name] !== undefined ? vars[name] : '{{' + name + '}}';
      });
    }
    return str;
  }

  function setLang(lang) {
    if (!dictionary[lang]) {
      loadLocale(lang, function() {
        applyLang(lang);
      });
      return;
    }
    applyLang(lang);
  }

  function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    applyToDOM();
    document.documentElement.lang = lang === 'kz' ? 'kk' : lang;
    // Update all lang switcher menus
    document.querySelectorAll('.lang-switcher').forEach(function(sw) {
      sw.querySelectorAll('.lang-option').forEach(function(opt) {
        opt.classList.toggle('active', opt.dataset.lang === lang);
      });
    });
  }

  function applyToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      var text = t(key);
      if (text === key) return;
      // Preserve child HTML if translation contains tags, otherwise use safe textContent
      if (/<[a-z][\s\S]*>/i.test(text)) {
        el.innerHTML = text;
      } else {
        el.textContent = text;
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-placeholder');
      var text = t(key);
      if (text !== key) el.placeholder = text;
    });
    document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
      var key = el.getAttribute('data-i18n-title');
      var text = t(key);
      if (text !== key) el.title = text;
    });
  }

  function loadLocale(lang, cb) {
    if (dictionary[lang]) { if (cb) cb(); return; }
    fetch('/locales/' + lang + '.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        dictionary[lang] = data;
        if (cb) cb();
      })
      .catch(function() {
        // Fallback: if ru loaded, use it; otherwise nothing
        if (cb) cb();
      });
  }

  function init() {
    var lang = detectLang();
    var loadedCount = 0;
    var targetCount = 2; // ru + detected lang

    function checkReady() {
      loadedCount++;
      if (loadedCount >= targetCount) {
        loaded = true;
        currentLang = dictionary[lang] ? lang : 'ru';
        applyToDOM();
        document.documentElement.lang = currentLang === 'kz' ? 'kk' : currentLang;
        onReadyCallbacks.forEach(function(fn) { fn(); });
        onReadyCallbacks = [];
        document.dispatchEvent(new Event('i18n:ready'));
      }
    }

    loadLocale('ru', checkReady);
    if (lang !== 'ru') {
      loadLocale(lang, checkReady);
    } else {
      targetCount = 1;
      checkReady();
    }
  }

  function onReady(fn) {
    if (loaded) fn();
    else onReadyCallbacks.push(fn);
  }

  function getLang() { return currentLang; }
  function isLoaded() { return loaded; }

  var LANG_NAMES = { ru: 'Русский', en: 'English', kz: 'Қазақша', zh: '中文' };

  function renderSwitcher(container) {
    if (!container) return;
    var id = 'langMenu_' + Math.random().toString(36).slice(2, 8);
    container.innerHTML =
      '<button class="lang-switcher-trigger" aria-haspopup="true" aria-expanded="false" title="🌐 Language">🌐</button>' +
      '<div class="lang-switcher-menu" id="' + id + '" role="menu">' +
        '<button class="lang-option' + (currentLang === 'ru' ? ' active' : '') + '" data-lang="ru" role="menuitem">🇷🇺 Русский</button>' +
        '<button class="lang-option' + (currentLang === 'en' ? ' active' : '') + '" data-lang="en" role="menuitem">🇬🇧 English</button>' +
        '<button class="lang-option' + (currentLang === 'kz' ? ' active' : '') + '" data-lang="kz" role="menuitem">🇰🇿 Қазақша</button>' +
        '<button class="lang-option' + (currentLang === 'zh' ? ' active' : '') + '" data-lang="zh" role="menuitem">🇨🇳 中文</button>' +
      '</div>';

    var trigger = container.querySelector('.lang-switcher-trigger');
    var menu = container.querySelector('.lang-switcher-menu');

    function toggleMenu(show) {
      var isOpen = show !== undefined ? show : !menu.classList.contains('open');
      menu.classList.toggle('open', isOpen);
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleMenu();
    });

    container.querySelectorAll('.lang-option').forEach(function(opt) {
      opt.addEventListener('click', function(e) {
        e.stopPropagation();
        setLang(opt.dataset.lang);
        toggleMenu(false);
      });
    });

    // Close on outside click
    function outsideClick(e) {
      if (!container.contains(e.target)) toggleMenu(false);
    }
    document.addEventListener('click', outsideClick);
    // Store cleanup on container for potential reuse
    container._langCleanup = function() { document.removeEventListener('click', outsideClick); };
  }

  window.I18n = { init, t, setLang, getLang, applyToDOM, isLoaded, onReady, renderSwitcher };
})();
