/**
 * Error Reporter — lightweight self-hosted error tracking.
 * Captures window.onerror and unhandledrejection, stores up to 50 entries
 * in localStorage for later inspection.
 * @namespace ErrorReporter
 */
const ErrorReporter = (function() {
  'use strict';

  const STORAGE_KEY = 'superglazka_errors';
  const MAX_LOGS = 50;

  function now() { return new Date().toISOString(); }

  function getLogs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLogs(logs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {}
  }

  function push(entry) {
    const logs = getLogs();
    logs.push(entry);
    if (logs.length > MAX_LOGS) logs.shift();
    saveLogs(logs);
  }

  function captureError(message, source, line, col, stack) {
    push({
      id: Math.random().toString(36).slice(2, 10),
      time: now(),
      message: message || 'Unknown error',
      source: source || location.href,
      line: line || 0,
      col: col || 0,
      stack: stack || '',
      url: location.href,
      ua: navigator.userAgent
    });
  }

  // Global error handler
  window.onerror = function(message, source, line, col, err) {
    captureError(message, source, line, col, err && err.stack ? err.stack : '');
    // Also log to console for debugging
    if (typeof console !== 'undefined' && console.error) {
      console.error('[ErrorReporter]', message, source + ':' + line + ':' + col);
    }
  };

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', function(e) {
    const reason = e.reason;
    const stack = reason && typeof reason.stack === 'string' ? reason.stack : String(reason);
    captureError('Unhandled Promise Rejection: ' + String(reason), location.href, 0, 0, stack);
    if (typeof console !== 'undefined' && console.error) {
      console.error('[ErrorReporter] Unhandled rejection:', reason);
    }
  });

  return {
    /** @returns {Array<Object>} Recent error logs (max 50) */
    getLogs() {
      return getLogs();
    },

    /** Clear stored error logs. */
    clear() {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    },

    /** Pretty-print all logs to the browser console. */
    sendToConsole() {
      const logs = getLogs();
      console.log('%c[ErrorReporter] ' + logs.length + ' logged error(s)', 'color:#ef4444;font-weight:700');
      logs.forEach((log, i) => {
        console.log(
          '%c#' + (i + 1) + ' ' + log.time + ' — ' + log.message,
          'color:#f472b6;font-weight:600'
        );
        console.log('  Source: ' + log.source + ':' + log.line + ':' + log.col);
        if (log.stack) console.log('  Stack:\n' + log.stack);
      });
    },

    /** @returns {string} JSON string of all logs for downloading. */
    exportToJson() {
      return JSON.stringify(getLogs(), null, 2);
    },

    /**
     * Manually log an error (useful for catch blocks).
     * @param {Error|string} err
     * @param {string} [context]
     */
    log(err, context) {
      const message = (context ? context + ': ' : '') + (err && err.message ? err.message : String(err));
      const stack = err && typeof err.stack === 'string' ? err.stack : '';
      captureError(message, location.href, 0, 0, stack);
    }
  };
})();
