/* Navigation sound effects — lightweight Web Audio API "pop" */
(function() {
  'use strict';

  var ctx = null;
  var enabled = true;

  function getCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    return ctx;
  }

  function pop() {
    if (!enabled || window.__reduceMotion) return;
    var c = getCtx();
    if (!c) return;
    try {
      var osc = c.createOscillator();
      var gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.08);
      gain.gain.setValueAtTime(0.08, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + 0.1);
    } catch (e) {}
  }

  function setEnabled(v) { enabled = v; }

  window.NavSound = { pop, setEnabled };
})();
