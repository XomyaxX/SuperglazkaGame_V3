/* ═══════════════════════════════════════════════════════════
   LANDING PAGE MAIN SCRIPTS — optimized for mobile Core Web Vitals
   ═══════════════════════════════════════════════════════════ */

/* ─── PARTICLES ─── */
(function() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];
  let w, h;
  let rafId = null;
  let isVisible = false;

  // Detect mobile / low-power
  const isMobile = window.matchMedia('(pointer: coarse)').matches;
  const isLowPower = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const MAX_PARTICLES = isMobile ? 15 : (isLowPower ? 25 : 50);
  const ENABLE_CONNECTIONS = !isMobile;

  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }

  function createParticles() {
    particles = [];
    const count = Math.min(Math.floor(w * h / 25000), MAX_PARTICLES);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.5,
        dx: (Math.random() - 0.5) * 0.25,
        dy: (Math.random() - 0.5) * 0.25,
        alpha: Math.random() * 0.4 + 0.15,
        color: Math.random() > 0.5 ? '168, 85, 247' : '6, 182, 212'
      });
    }
  }

  function draw() {
    if (!isVisible) return;
    ctx.clearRect(0, 0, w, h);

    // Draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + p.color + ',' + p.alpha + ')';
      ctx.fill();
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0 || p.x > w) p.dx *= -1;
      if (p.y < 0 || p.y > h) p.dy *= -1;
    }

    // Draw connections (desktop only, simplified)
    if (ENABLE_CONNECTIONS) {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 14400) { // 120^2, avoid sqrt
            const dist = Math.sqrt(distSq);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = 'rgba(168, 85, 247,' + (0.06 * (1 - dist / 120)) + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    rafId = requestAnimationFrame(draw);
  }

  function start() {
    if (rafId) return;
    resize();
    createParticles();
    isVisible = true;
    draw();
  }

  function stop() {
    isVisible = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  window.addEventListener('resize', function() {
    resize();
    createParticles();
  });

  // IntersectionObserver to pause when not visible
  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        start();
      } else {
        stop();
      }
    });
  }, { threshold: 0 });

  observer.observe(canvas);
})();

/* ─── NAV SCROLL EFFECT ─── */
(function() {
  var nav = document.getElementById('landNav');
  if (!nav) return;
  var ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      window.requestAnimationFrame(function() {
        nav.classList.toggle('scrolled', window.scrollY > 50);
        ticking = false;
      });
      ticking = true;
    }
  });
})();

/* ─── MOBILE NAV ─── */
(function() {
  var navToggle = document.getElementById('navToggle');
  var navClose = document.getElementById('navClose');
  var navMobile = document.getElementById('navMobile');
  if (!navToggle || !navClose || !navMobile) return;

  navToggle.addEventListener('click', function() { navMobile.classList.add('open'); });
  navClose.addEventListener('click', function() { navMobile.classList.remove('open'); });

  document.querySelectorAll('.nav-mobile-link').forEach(function(link) {
    link.addEventListener('click', function() { navMobile.classList.remove('open'); });
  });
})();

/* ─── LANGUAGE SWITCHER ─── */
(function() {
  function initLangSwitcher() {
    if (typeof I18n === 'undefined' || !I18n.isLoaded || !I18n.isLoaded()) {
      return;
    }
    if (I18n.renderSwitcher) {
      I18n.renderSwitcher(document.getElementById('langSwitcherNav'));
      I18n.renderSwitcher(document.getElementById('langSwitcherMobile'));
    }
  }

  // Listen for i18n ready event or DOMContentLoaded
  document.addEventListener('i18n:ready', initLangSwitcher);
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initLangSwitcher, 50);
  });
})();

/* ─── SCROLL REVEAL ─── */
(function() {
  var revealObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(function(el) {
    revealObserver.observe(el);
  });
})();

/* ─── CHARACTER TABS & MODAL ─── */
(function() {
  var charData = {
    superglazka: {
      name: 'Суперглазка',
      role: 'Главная героиня',
      img: 'heros/magnific_img1-img2_wPhRt2i7EI.png',
      badges: ['⭐ Избранная', '👁️ Суперзрение', '❤️ Отважная'],
      desc: 'Девочка с огромными голубыми глазами и белоснежными косичками. Родилась из древнего ритуала Призыва на планете Видеаль. Носит красный костюм с белым плащом и серебряным поясом. Её миссия — защищать зрение детей на Земле и спасти планету Видеаль от Великой Тьмы. Обладает суперсилой зрения: видит сквозь иллюзии, замечает то, что не видят другие, и может испускать лазерный луч из глаз.',
      stats: [
        { label: 'Сила', value: 75 },
        { label: 'Скорость', value: 90 },
        { label: 'Зрение', value: 100 },
        { label: 'Харизма', value: 95 }
      ]
    },
    vanya: {
      name: 'Ваня',
      role: 'Верный друг',
      img: 'heros/magnific_img1-img2_Bm4QN7poQR.png',
      badges: ['🦸 Помощник', '🌍 С Земли', '💪 Храбрый'],
      desc: 'Земной мальчик, который первым поверил в Суперглазку и стал её верным другом и напарником. Носит красную маску и костюм, вдохновлённый супергероиней. Вместе с Суперглазкой проходит через все испытания, помогая ей в миссии спасти глаза детей. Его сила — в верности, находчивости и умении поддерживать друзей в трудную минуту.',
      stats: [
        { label: 'Сила', value: 60 },
        { label: 'Ловкость', value: 80 },
        { label: 'Верность', value: 100 },
        { label: 'Ум', value: 85 }
      ]
    },
    advisor: {
      name: 'Советник',
      role: 'Воин Видеаля',
      img: 'heros/magnific_img1-img2_8vNKufRIrU.png',
      badges: ['🛡️ Защитник', '⚔️ Воин', '📋 Стратег'],
      desc: 'Отважный воин планеты Видеаль, верный защитник правителя и наставник Суперглазки. Носит синий боевой костюм с эмблемой планеты. Мастер ближнего боя и тактики. Всегда готов встать на защиту слабых и дать совет в трудную минуту. Его девиз: «Глаза видят правду, а сердце — путь».',
      stats: [
        { label: 'Сила', value: 90 },
        { label: 'Защита', value: 95 },
        { label: 'Мудрость', value: 85 },
        { label: 'Скорость', value: 70 }
      ]
    },
    crystal: {
      name: 'Мудрый Хрусталик',
      role: 'Правитель Видеаля',
      img: 'heros/magnific_img1_kLDyuzb16B.png',
      badges: ['👑 Король', '🔮 Маг', '📖 Наставник'],
      desc: 'Мудрый и справедливый правитель планеты Видеаль. Провёл древний ритуал Призыва, который породил Суперглазку. Обладает могущественной магией хрусталя и света. Носит королевскую мантию с мехом и корону с драгоценным камнем. Его посох — источник древней мудрости и силы. Наставляет героев и хранит секреты планеты Видеаль.',
      stats: [
        { label: 'Магия', value: 100 },
        { label: 'Мудрость', value: 100 },
        { label: 'Власть', value: 95 },
        { label: 'Сила', value: 60 }
      ]
    },
    queen: {
      name: 'Королева София',
      role: 'Хранительница знаний',
      img: 'heros/magnific_img1_ubngYIRQLD.png',
      badges: ['👑 Королева', '📚 Мудрость', '🔑 Хранитель'],
      desc: 'Королева Видеаля и жена Мудрого Хрусталика. Хранительница древних знаний и тайн планеты. Носит великолепное фиолетово-синее платье с магическим ключом на груди. Её книга заклинаний содержит мудрость веков. Помогает Суперглазке постичь силу зрения и найти путь к победе над тьмой.',
      stats: [
        { label: 'Магия', value: 95 },
        { label: 'Знания', value: 100 },
        { label: 'Защита', value: 80 },
        { label: 'Харизма', value: 90 }
      ]
    },
    professor: {
      name: 'Профессор',
      role: 'Учёный и изобретатель',
      img: 'heros/magnific_img1_wPhGDV87EI.png',
      badges: ['🔬 Учёный', '💡 Изобретатель', '📖 Мудрец'],
      desc: 'Главный учёный и изобретатель планеты Видеаль. Создаёт удивительные приборы и артефакты, которые помогают героям в борьбе со злом. Носит потрёпанную мантию с красками и круглые очки. Его голографическая книга содержит все открытия Видеаля. Иногда кажется рассеянным, но в критический момент всегда находит гениальное решение.',
      stats: [
        { label: 'Интеллект', value: 100 },
        { label: 'Изобретательность', value: 95 },
        { label: 'Магия', value: 50 },
        { label: 'Сила', value: 40 }
      ]
    },
    'lenivus-human': {
      name: 'Ленивус',
      role: 'Владыка Тьмы',
      img: 'eviels/magnific_img1_jSX6atMLD0.png',
      badges: ['👿 Антагонист', '🖤 Тьма', '👁️ Повязка'],
      desc: 'Главный злодей комикса, владыка Великой Тьмы. В человекоподобном облике — величественный и жуткий правитель с чёрной короной и повязкой на глазу. Его броня пропитана тёмной магией, а посох с красным кристаллом поглощает свет. Ленивус угрожает поглотить планету Видеаль и лишить детей зрения. Его слабость — активные и здоровые глаза!',
      stats: [
        { label: 'Тьма', value: 100 },
        { label: 'Сила', value: 90 },
        { label: 'Хитрость', value: 95 },
        { label: 'Зрение', value: 10 }
      ]
    },
    'lenivus-true': {
      name: 'Ленивус',
      role: 'Истинный облик',
      img: 'eviels/Airbrush-IMAGE-ENHANCER-1779352038956-1779352038956.png',
      badges: ['👿 Монстр', '📱 Леность', '🦠 Слизь'],
      desc: 'Истинный облик Ленивуса — огромное фиолетово-зелёное существо, рождённое из лени и плохих привычек. Весь день сидит с планшетом, не отрываясь от экрана. Его кожа покрыта пятнами, а глаза полузакрыты от усталости. Питается чужой ленью и нежеланием заботиться о зрении. Именно поэтому гимнастика для глаз и активный отдых — его главные враги!',
      stats: [
        { label: 'Лень', value: 100 },
        { label: 'Тьма', value: 85 },
        { label: 'Здоровье', value: 30 },
        { label: 'Движение', value: 5 }
      ]
    },
    pixelko: {
      name: 'Пикселько',
      role: 'Паук-искуситель',
      img: 'eviels/magnific_img1_XtPbQfkBfo.png',
      badges: ['🕷️ Паук', '🌈 Иллюзия', '💎 Кристалл'],
      desc: 'Хитрый паук-искуситель из мира экранов и пикселей. Его тело состоит из радужных кристаллов, которые завлекают детей слишком долго смотреть в экраны. Пикселько плетёт иллюзии и заманивает в ловушку тех, кто забывает делать перерывы. Только правильный режим работы с гаджетами и гимнастика для глаз помогают развеять его чары!',
      stats: [
        { label: 'Иллюзия', value: 95 },
        { label: 'Скорость', value: 80 },
        { label: 'Ловкость', value: 90 },
        { label: 'Сила', value: 50 }
      ]
    },
    darkness: {
      name: 'Великая Тьма',
      role: 'Древнее зло',
      img: 'eviels/magnific_img1_swo22Kxl8e.png',
      badges: ['🌑 Тьма', '👻 Дух', '🌪️ Хаос'],
      desc: 'Древнее и могущественное зло, угрожающее поглотить всю планету Видеаль. Представляет собой гигантское облако тумана с горящими глазами, внутри которого видны искажённые миры. Великая Тьма питается слабым зрением, ленью и вредными привычками. Только объединённые силы всех героев и здоровые глаза детей могут её остановить!',
      stats: [
        { label: 'Тьма', value: 100 },
        { label: 'Разрушение', value: 100 },
        { label: 'Страх', value: 95 },
        { label: 'Уязвимость', value: 20 }
      ]
    }
  };

  // Tabs
  document.querySelectorAll('.char-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.char-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      var target = tab.dataset.tab;
      document.querySelectorAll('.char-panel').forEach(function(p) { p.classList.remove('active'); });
      document.getElementById(target + '-panel').classList.add('active');
    });
  });

  // Modal
  var backdrop = document.getElementById('charModalBackdrop');
  var closeBtn = document.getElementById('charModalClose');

  function openModal(key) {
    var data = charData[key];
    if (!data) return;
    document.getElementById('charModalImg').src = data.img;
    document.getElementById('charModalImg').alt = data.name;
    document.getElementById('charModalName').textContent = data.name;
    document.getElementById('charModalRole').textContent = data.role;
    document.getElementById('charModalDesc').textContent = data.desc;

    var badgesEl = document.getElementById('charModalBadges');
    badgesEl.innerHTML = data.badges.map(function(b) { return '<span class="char-modal-badge">' + b + '</span>'; }).join('');

    var statsEl = document.getElementById('charModalStats');
    statsEl.innerHTML = data.stats.map(function(s) {
      return '<div class="char-modal-stat"><div class="char-modal-stat-label">' + s.label + '</div>' +
        '<div class="char-modal-stat-bar-wrap"><div class="char-modal-stat-bar" style="--stat-width:' + s.value + '%;"></div></div>' +
        '<div class="char-modal-stat-value">' + s.value + '</div></div>';
    }).join('');

    backdrop.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    backdrop.classList.remove('visible');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.char-card').forEach(function(card) {
    card.addEventListener('click', function() { openModal(card.dataset.char); });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (backdrop) {
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) closeModal();
    });
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && backdrop && backdrop.classList.contains('visible')) closeModal();
  });
})();
