/* Haptic feedback module */
(function() {
  'use strict';

  function vibrateSuccess() {
    if (window.__reduceMotion) return;
    if (navigator.vibrate) {
      navigator.vibrate([50, 100, 50]);
    }
  }

  function vibratePattern(pattern) {
    if (window.__reduceMotion) return;
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  window.Haptic = { vibrateSuccess, vibratePattern };
})();
