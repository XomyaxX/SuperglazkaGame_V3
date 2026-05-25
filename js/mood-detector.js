/**
 * Mood Detector — автоматическое определение настроения кадра
 * по ключевым словам (narration, title, dialogues) и цвету фона.
 * @namespace MoodDetector
 */
const MoodDetector = (function() {
  'use strict';

  const KEYWORDS = {
    cosmic: [
      'космос', 'планета', 'звезд', 'вселенн', 'пространств', 'галактик',
      'небо', 'небес', 'звёзд', 'светил', 'млечн', 'орбит', 'телескоп',
      'космическ', 'астро', 'неонов', 'сияние', 'свет', 'пространство'
    ],
    joyful: [
      'радост', 'улыбк', 'сме', 'весел', 'дружелюб', 'уют', 'счаст',
      'ликован', 'торжеств', 'праздн', 'хихик', 'смех', 'рад', 'веселье',
      'добр', 'ласков', 'нежн', 'ласк', 'обним', 'подбрасыва', 'прыг',
      'бег', 'весело', 'смешно'
    ],
    tension: [
      'тьм', 'угроз', 'страх', 'тревог', 'зл', 'мрак', 'темн', 'опасност',
      'бед', 'ужас', 'ужасн', 'пуга', 'гроз', 'страшн', 'зловещ', 'напряжен',
      'тревожн', 'паник', 'ужаса', 'кошмар', 'мрачн', 'гнетущ', 'тяжел',
      'крик', 'вой', 'рыдан', 'слез', 'плач'
    ],
    peaceful: [
      'покой', 'гармон', 'природ', 'водопад', 'священ', 'тишин', 'спокой',
      'умиротвор', 'релакс', 'лес', 'озер', 'речк', 'гор', 'трав', 'цвет',
      'птич', 'пение', 'журчан', 'шелест', 'ветер', 'солнц', 'светл', 'ясн',
      'чист', 'прозрачн', 'зелен', 'свеж', 'воздух'
    ],
    magical: [
      'ритуал', 'маг', 'заклинан', 'чуд', 'туман', 'волшеб', 'фокус',
      'колдов', 'чародей', 'волшебник', 'заклят', 'призыв', 'зелье',
      'пузыр', 'сверка', 'мерца', 'сия', 'светит', 'искр', 'вспых',
      'кристалл', 'камен', 'алмаз', 'рубин', 'сапфир', 'изумруд'
    ],
    triumphant: [
      'побед', 'трансформац', 'геро', 'ликован', 'торжеств', 'спасен',
      'слав', 'велич', 'триумф', 'преображ', 'превратил', 'сверш',
      'достиг', 'победил', 'одолел', 'восстал', 'воскрес', 'светл',
      'блестящ', 'золот', 'корон', 'трон', 'цар', 'корол'
    ],
    warm: [
      'тепл', 'дом', 'надежд', 'уют', 'вечер', 'камин', 'кроват',
      'плед', 'подушк', 'окн', 'луна', 'звездн', 'ноч', 'семь',
      'мам', 'пап', 'родител', 'детск', 'дружн', 'друз', 'обним',
      'ласк', 'нежн', 'тих', 'спокойн', 'мягк', 'уютн'
    ],
    mystery: [
      'тайн', 'неизвестност', 'вопрос', 'поиск', 'искать', 'находить',
      'теря', 'потеря', 'загадк', 'загадочн', 'мистер', 'тайный',
      'скрыт', 'потаен', 'секрет', 'загадка', 'головоломк', 'интриг',
      'сомнен', 'сомнева', 'неуверен', 'думать', 'размышл', 'гадать'
    ],
    epic: [
      'масштаб', 'величие', 'судьб', 'легенд', 'древн', 'велик',
      'гром', 'небес', 'бог', 'божеств', 'бессмертн', 'вечн',
      'вселенск', 'грандиозн', 'величествен', 'королевск', 'трон', 'замок',
      'цитадел', 'храм', 'священ', 'высш', 'превосход', 'величайш'
    ],
    sad: [
      'слез', 'прощай', 'потеря', 'печал', 'тоск', 'одиночеств',
      'прощани', 'груст', 'плач', 'рыдан', 'вой', 'скорб',
      'угас', 'умира', 'смерт', 'кончин', 'погиб', 'трагеди',
      'слезлив', 'жалк', 'безнадежн', 'отчаяни', 'горе', 'слезы'
    ],
    action: [
      'битв', 'удар', 'прыжок', 'погоня', 'скорост', 'мощ',
      'взрыв', 'атак', 'защит', 'сражен', 'драк', 'бой',
      'столкновен', 'побег', 'преследован', 'нападен', 'выстрел',
      'резк', 'быстр', 'стремительн', 'агрессивн', 'ярост'
    ]
  };

  const COLOR_HINTS = {
    tension:  ['#0f172a', '#1e293b', '#334155', '#020617', '#111827'],
    cosmic:   ['#1e1b4b', '#0f0a1e', '#312e81', '#1d4ed8', '#0a0618'],
    peaceful: ['#14532d', '#166534', '#0f766e', '#134e4a', '#22c55e'],
    magical:  ['#7c3aed', '#a855f7', '#ec4899', '#f59e0b', '#c084fc'],
    warm:     ['#b45309', '#7c2d12', '#f59e0b', '#fbbf24', '#f97316'],
    joyful:   ['#4c1d95', '#a855f7', '#f472b6', '#fb7185'],
    mystery:  ['#1e3a5f', '#334155', '#0f172a', '#1e1b4b'],
    triumphant: ['#ec4899', '#f59e0b', '#fbbf24', '#a855f7'],
    epic:     ['#1a1a2e', '#16213e', '#0f3460', '#1e3a8a', '#312e81'],
    sad:      ['#2d2d44', '#3d3d5c', '#1e1e3f', '#374151', '#4b5563'],
    action:   ['#7f1d1d', '#991b1b', '#450a0a', '#b91c1c', '#dc2626']
  };

  function normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/[^а-яёa-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function keywordScore(text, keywords) {
    const norm = normalizeText(text);
    let score = 0;
    for (const kw of keywords) {
      const re = new RegExp(kw, 'g');
      const matches = norm.match(re);
      if (matches) score += matches.length;
    }
    return score;
  }

  function extractGradientColors(gradient) {
    if (!gradient) return [];
    const hexMatches = gradient.match(/#[0-9a-fA-F]{6}/g) || [];
    const rgbMatches = gradient.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/g) || [];
    const colors = [...hexMatches];
    for (const rgb of rgbMatches) {
      const m = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (m) {
        const hex = '#' + [m[1], m[2], m[3]].map(x => {
          const h = parseInt(x).toString(16);
          return h.length === 1 ? '0' + h : h;
        }).join('');
        colors.push(hex);
      }
    }
    return colors;
  }

  function hexDistance(a, b) {
    const ra = parseInt(a.slice(1, 3), 16);
    const ga = parseInt(a.slice(3, 5), 16);
    const ba = parseInt(a.slice(5, 7), 16);
    const rb = parseInt(b.slice(1, 3), 16);
    const gb = parseInt(b.slice(3, 5), 16);
    const bb = parseInt(b.slice(5, 7), 16);
    return Math.sqrt((ra - rb) ** 2 + (ga - gb) ** 2 + (ba - bb) ** 2);
  }

  function colorScore(gradient) {
    const frameColors = extractGradientColors(gradient);
    if (frameColors.length === 0) return {};
    const scores = {};
    for (const [mood, palette] of Object.entries(COLOR_HINTS)) {
      let total = 0;
      for (const fc of frameColors) {
        let minDist = Infinity;
        for (const pc of palette) {
          const d = hexDistance(fc.toLowerCase(), pc.toLowerCase());
          if (d < minDist) minDist = d;
        }
        // Closer color = higher score (inverse distance, capped)
        total += Math.max(0, 1 - minDist / 255);
      }
      scores[mood] = total / frameColors.length;
    }
    return scores;
  }

  /**
   * Detect mood from frame data.
   * @param {Object} frameData
   * @returns {string} mood name
   */
  function detectMood(frameData) {
    if (!frameData) return 'peaceful';

    const textParts = [
      frameData.title || '',
      frameData.narration || '',
      frameData.transitionText || '',
      frameData.videoPrompt || ''
    ];

    // Add dialogues text
    if (Array.isArray(frameData.dialogues)) {
      for (const d of frameData.dialogues) {
        if (d.text) textParts.push(d.text);
      }
    }

    const fullText = textParts.join(' ');
    const scores = {};

    // Keyword scores
    for (const [mood, keywords] of Object.entries(KEYWORDS)) {
      scores[mood] = keywordScore(fullText, keywords);
    }

    // Color scores (weighted)
    const cScores = colorScore(frameData.bgGradient);
    for (const [mood, val] of Object.entries(cScores)) {
      scores[mood] = (scores[mood] || 0) + val * 3; // color weight = 3x
    }

    // Boost for specific games
    if (frameData.game === 'gym') {
      scores.triumphant = (scores.triumphant || 0) + 2;
      scores.tension = (scores.tension || 0) + 2;
    }
    if (frameData.game === 'runner') {
      scores.tension = (scores.tension || 0) + 2;
      scores.joyful = (scores.joyful || 0) + 1;
    }

    let best = 'peaceful';
    let bestScore = -1;
    for (const [mood, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        best = mood;
      }
    }
    return best;
  }

  /**
   * Run self-tests in console.
   * @returns {Array<Object>} test results
   */
  function test() {
    const cases = [
      { title: 'Планета Видеаль', narration: 'В бескрайнем космосе', expected: 'cosmic' },
      { title: 'Угроза Тьмы', narration: 'Великое Зло грозит поглотить', expected: 'tension' },
      { title: 'Каменная площадь', narration: 'Водопад, покой и гармония', expected: 'peaceful' },
      { title: 'Ритуал Призыва', narration: 'Заклинание, магический туман', expected: 'magical' },
      { title: 'Трансформация', narration: 'Победа! Ликование!', expected: 'triumphant' },
      { title: 'Легенда о богах', narration: 'Великое величие древних легенд', expected: 'epic' },
      { title: 'Прощание', narration: 'Слёзы и тоска, потеря близкого', expected: 'sad' },
      { title: 'Битва за планету', narration: 'Стремительная атака и бой', expected: 'action' }
    ];
    const results = [];
    for (const c of cases) {
      const detected = detectMood(c);
      results.push({
        input: c.title,
        expected: c.expected,
        detected: detected,
        pass: detected === c.expected
      });
    }
    return results;
  }

  return { detectMood, test };
})();
