#!/usr/bin/env node
/**
 * Скрипт миграции hardcoded эпизодов из js/episodes/ в CMS БД.
 * Запуск: node server/scripts/migrate-episodes.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const db = require('../db');

// ─── Helpers ───────────────────────────────────────────────────────────────

function episodeAsset(epNum, frameDir, filename) {
  const ep = epNum.toString().padStart(2, '0');
  return `assets/episodes/episode-${ep}/frames/${frameDir}/${filename}`;
}

function loadEpisodeJS(filePath, varName) {
  const fullPath = path.resolve(__dirname, '..', '..', filePath);
  let code = fs.readFileSync(fullPath, 'utf8');
  // Заменяем const на var, чтобы переменная была доступна для return
  code = code.replace(new RegExp(`const\\s+${varName}\\s*=?`), `var ${varName} =`);
  const fn = new Function('episodeAsset', code + `\nreturn ${varName};`);
  return fn(episodeAsset);
}

async function ensureColumn() {
  try {
    await db.run(`ALTER TABLE frames ADD COLUMN dialogue_audio_json TEXT`);
    console.log('✅ Добавлена колонка dialogue_audio_json');
  } catch (e) {
    if (!e.message.includes('duplicate column')) throw e;
    console.log('ℹ️ Колонка dialogue_audio_json уже существует');
  }
}

async function copyAsset(src, destDir) {
  const srcPath = path.resolve(__dirname, '..', '..', src);
  if (!fs.existsSync(srcPath)) {
    console.warn(`  ⚠️ Файл не найден: ${src}`);
    return null;
  }
  const basename = path.basename(src);
  const destPath = path.join(destDir, basename);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  return destPath;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  await db.init();
  await ensureColumn();

  const uploadsBase = path.resolve(__dirname, '..', 'uploads', 'episodes');

  // Загружаем данные эпизодов
  const ep1Ctx = loadEpisodeJS('js/episodes/episode-01.js', 'EPISODE_01');
  const ep2Ctx = loadEpisodeJS('js/episodes/episode-02.js', 'EPISODE_02');

  const episodes = [
    { num: 1, data: ep1Ctx },
    { num: 2, data: ep2Ctx }
  ];

  for (const { num, data } of episodes) {
    const coverPath = `assets/episodes/episode-${String(num).padStart(2, '0')}/cover.png`;
    let coverDest = null;
    const coverSrc = path.resolve(__dirname, '..', '..', coverPath);
    if (fs.existsSync(coverSrc)) {
      const destDir = path.join(uploadsBase, String(num));
      fs.mkdirSync(destDir, { recursive: true });
      coverDest = path.join(destDir, 'cover.png');
      fs.copyFileSync(coverSrc, coverDest);
    }

    // Создаём/обновляем эпизод
    const existing = await db.get(
      'SELECT id FROM episodes WHERE "order" = ?',
      [num]
    );

    let episodeId;
    if (existing) {
      await db.run(
        `UPDATE episodes SET title = ?, description = ?, cover_image = ?, is_published = 1 WHERE id = ?`,
        [data.title, '', coverDest ? `/uploads/episodes/${num}/cover.png` : '', existing.id]
      );
      episodeId = existing.id;
      // Удаляем старые кадры
      await db.run('DELETE FROM frames WHERE episode_id = ?', [episodeId]);
      console.log(`🔄 Обновлён эпизод #${num} (id=${episodeId})`);
    } else {
      const result = await db.run(
        `INSERT INTO episodes (title, description, cover_image, "order", is_published)
         VALUES (?, ?, ?, ?, 1)`,
        [data.title, '', coverDest ? `/uploads/episodes/${num}/cover.png` : '', num]
      );
      episodeId = result.lastID;
      console.log(`✅ Создан эпизод #${num} (id=${episodeId})`);
    }

    // Кадры
    for (let i = 0; i < data.frames.length; i++) {
      const frame = data.frames[i];
      const frameDir = path.join(uploadsBase, String(num), 'frames', String(frame.id));

      const bgImage = frame.bgImage
        ? await copyAsset(frame.bgImage, frameDir) || frame.bgImage
        : null;
      const bgVideo = frame.videoSrc
        ? await copyAsset(frame.videoSrc, frameDir) || frame.videoSrc
        : null;
      const audioSrc = frame.audioSrc
        ? await copyAsset(frame.audioSrc, frameDir) || frame.audioSrc
        : null;

      // dialogueAudio — массив путей
      let dialogueAudioJson = null;
      if (frame.dialogueAudio && frame.dialogueAudio.length > 0) {
        const copied = [];
        for (const da of frame.dialogueAudio) {
          const dest = await copyAsset(da, frameDir);
          copied.push(dest || da);
        }
        dialogueAudioJson = JSON.stringify(copied);
      }

      // Преобразуем пути в абсолютные URL-пути
      const toUrl = (p) => {
        if (!p) return null;
        if (p.startsWith('assets/')) return '/' + p;
        if (p.startsWith('/')) return p;
        const rel = path.relative(path.resolve(__dirname, '..', 'uploads'), p);
        return '/uploads/' + rel.replace(/\\/g, '/');
      };

      await db.run(
        `INSERT INTO frames
         (episode_id, "order", title, narration, dialogue_json,
          background_image, background_video, audio_src,
          dialogue_audio_json, mood, game_type, choices_json, transition_text)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          episodeId,
          i + 1,
          frame.title,
          frame.narration || '',
          JSON.stringify(frame.dialogues || []),
          toUrl(bgImage),
          toUrl(bgVideo),
          toUrl(audioSrc),
          dialogueAudioJson ? JSON.stringify(JSON.parse(dialogueAudioJson).map(toUrl)) : null,
          frame.bgGradient || null,
          frame.game || null,
          '[]',
          frame.transitionText || null
        ]
      );

      console.log(`  📸 Кадр ${frame.id}: ${frame.title}`);
    }
  }

  console.log('\n🎉 Миграция завершена!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Ошибка миграции:', err);
  process.exit(1);
});
