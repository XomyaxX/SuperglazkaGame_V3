/* ─── GAMES MODAL ─── */
(function() {
  var backdrop = document.getElementById('gamesModalBackdrop');
  var listView = document.getElementById('gamesModalList');
  var iframeWrap = document.getElementById('gamesModalIframeWrap');
  var iframe = document.getElementById('gamesModalIframe');
  var closeBtn = document.getElementById('gamesModalClose');
  var backBtn = document.getElementById('gamesModalBack');

  if (!backdrop) return;

  function openModal() {
    backdrop.classList.add('visible');
    listView.style.display = '';
    iframeWrap.style.display = 'none';
    iframe.src = '';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    backdrop.classList.remove('visible');
    iframe.src = '';
    document.body.style.overflow = '';
  }

  function openGame(game) {
    backdrop.classList.add('visible');
    document.body.style.overflow = 'hidden';
    listView.style.display = 'none';
    iframeWrap.style.display = '';
    iframe.src = 'app.html?game=' + encodeURIComponent(game) + '&embed=1';
  }

  function backToList() {
    listView.style.display = '';
    iframeWrap.style.display = 'none';
    iframe.src = '';
  }

  document.querySelectorAll('.land-game-card[data-game]').forEach(function(card) {
    card.addEventListener('click', function() { openGame(card.dataset.game); });
  });

  document.querySelectorAll('.js-open-games-modal').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      openModal();
      var mobileMenu = document.getElementById('navMobile');
      if (mobileMenu) mobileMenu.classList.remove('open');
    });
  });

  document.querySelectorAll('.games-modal-item[data-game]').forEach(function(item) {
    item.addEventListener('click', function() { openGame(item.dataset.game); });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backBtn) backBtn.addEventListener('click', backToList);
  backdrop.addEventListener('click', function(e) {
    if (e.target === backdrop) closeModal();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && backdrop.classList.contains('visible')) closeModal();
  });
})();
