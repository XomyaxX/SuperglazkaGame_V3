/* Tutorial overlay system for mini-games */
(function() {
  'use strict';

  var overlay = null;
  var highlight = null;
  var tooltip = null;
  var steps = [];
  var currentStep = 0;
  var currentGameId = '';

  function createElements() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none;';

    highlight = document.createElement('div');
    highlight.className = 'tutorial-highlight';
    highlight.style.cssText = 'position:absolute;border:3px solid #a855f7;border-radius:12px;box-shadow:0 0 0 9999px rgba(0,0,0,0.75),0 0 30px #a855f7;pointer-events:none;z-index:9999;transition:all 0.3s ease;';

    tooltip = document.createElement('div');
    tooltip.className = 'tutorial-tooltip';
    tooltip.style.cssText = 'position:absolute;z-index:10000;background:rgba(15,8,35,0.95);border:1px solid rgba(168,85,247,0.3);border-radius:12px;padding:16px 20px;max-width:280px;color:#fff;font-family:Nunito,sans-serif;font-size:14px;line-height:1.5;pointer-events:auto;box-shadow:0 20px 40px rgba(0,0,0,0.5);';

    document.body.appendChild(overlay);
    document.body.appendChild(highlight);
    document.body.appendChild(tooltip);
  }

  function destroyElements() {
    if (overlay) { overlay.remove(); overlay = null; }
    if (highlight) { highlight.remove(); highlight = null; }
    if (tooltip) { tooltip.remove(); tooltip = null; }
  }

  function positionHighlight(el) {
    var rect = el.getBoundingClientRect();
    var pad = 6;
    highlight.style.left = (rect.left - pad) + 'px';
    highlight.style.top = (rect.top - pad) + 'px';
    highlight.style.width = (rect.width + pad * 2) + 'px';
    highlight.style.height = (rect.height + pad * 2) + 'px';
  }

  function positionTooltip(el, position) {
    var rect = el.getBoundingClientRect();
    var tipRect = tooltip.getBoundingClientRect();
    var pad = 12;
    var left, top;

    if (position === 'top') {
      left = rect.left + rect.width / 2 - tipRect.width / 2;
      top = rect.top - tipRect.height - pad;
    } else if (position === 'left') {
      left = rect.left - tipRect.width - pad;
      top = rect.top + rect.height / 2 - tipRect.height / 2;
    } else if (position === 'right') {
      left = rect.right + pad;
      top = rect.top + rect.height / 2 - tipRect.height / 2;
    } else {
      // bottom default
      left = rect.left + rect.width / 2 - tipRect.width / 2;
      top = rect.bottom + pad;
    }

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tipRect.height - 8));

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function renderStep() {
    var step = steps[currentStep];
    var el = document.querySelector(step.target);
    if (!el) { skip(); return; }

    positionHighlight(el);

    var isLast = currentStep === steps.length - 1;
    var btnText = isLast
      ? (window.I18n ? I18n.t('tutorial.start') : 'Начать игру 🎮')
      : (window.I18n ? I18n.t('tutorial.next') : 'Далее →');
    var skipText = window.I18n ? I18n.t('tutorial.skip') : 'Пропустить обучение';

    tooltip.innerHTML = '<div style="margin-bottom:10px;">' + step.text + '</div>' +
      '<div style="display:flex;gap:8px;justify-content:space-between;align-items:center;">' +
      '<button class="tutorial-skip" style="background:none;border:none;color:rgba(255,255,255,0.5);font-size:12px;cursor:pointer;padding:0;">' + skipText + '</button>' +
      '<button class="tutorial-next" style="background:linear-gradient(135deg,#a855f7,#ec4899);border:none;border-radius:50px;padding:8px 18px;color:#fff;font-weight:700;font-size:13px;cursor:pointer;">' + btnText + '</button>' +
      '</div>' +
      '<div style="margin-top:8px;text-align:center;font-size:11px;color:rgba(255,255,255,0.3);">' + (currentStep + 1) + ' / ' + steps.length + '</div>';

    positionTooltip(el, step.position || 'bottom');

    tooltip.querySelector('.tutorial-next').onclick = function() {
      if (isLast) { finish(); }
      else { currentStep++; renderStep(); }
    };
    tooltip.querySelector('.tutorial-skip').onclick = skip;
  }

  function finish() {
    try { localStorage.setItem('superglazka_tutorial_' + currentGameId, '1'); } catch (e) {}
    destroyElements();
  }

  function skip() {
    try { localStorage.setItem('superglazka_tutorial_' + currentGameId, '1'); } catch (e) {}
    destroyElements();
  }

  function start(gameId, stepList) {
    if (!gameId || !stepList || !stepList.length) return;
    try {
      if (localStorage.getItem('superglazka_tutorial_' + gameId)) return;
    } catch (e) {}
    currentGameId = gameId;
    steps = stepList;
    currentStep = 0;
    createElements();
    renderStep();
  }

  function reset(gameId) {
    try { localStorage.removeItem('superglazka_tutorial_' + gameId); } catch (e) {}
  }

  window.Tutorial = { start, skip, reset };
})();
