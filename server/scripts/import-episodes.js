/**
 * Import episodes from hardcoded JS files into the database.
 * Usage: node server/scripts/import-episodes.js [--reset]
 * --reset drops existing episodes/frames/media before import.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { run, get, all, init } = require('../db');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');

function episodeAsset(episodeNum, frameDir, fileName) {
  const num = String(episodeNum).padStart(2, '0');
  return 'assets/episodes/episode-' + num + '/frames/' + frameDir + '/' + fileName;
}

function resolveProjectPath(relativePath) {
  return path.join(PROJECT_ROOT, relativePath.replace(/\//g, path.sep));
}

function resolveUploadsPath(relativePath) {
  return path.join(UPLOADS_ROOT, relativePath.replace(/\//g, path.sep));
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
  };
  return map[ext] || 'application/octet-stream';
}

async function copyAndRecordMedia(srcRelative, destRelative) {
  const src = resolveProjectPath(srcRelative);
  const dest = resolveUploadsPath(destRelative);
  
  if (!fs.existsSync(src)) {
    console.warn('  ⚠ Source file not found:', srcRelative);
    return null;
  }
  
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  
  const stat = fs.statSync(src);
  const filename = path.basename(dest);
  
  const result = await run(
    `INSERT INTO media (filename, original_name, mime_type, size, path) VALUES (?, ?, ?, ?, ?)`,
    [filename, filename, getMimeType(filename), stat.size, destRelative]
  );
  
  console.log('  📎 Copied', srcRelative, '->', destRelative);
  return { mediaId: result.lastID, path: destRelative };
}

function loadEpisode(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const wrapped = `
    var episodeAsset = arguments[0];
    ${code}
    return typeof EPISODE_01 !== 'undefined' ? EPISODE_01 :
           typeof EPISODE_02 !== 'undefined' ? EPISODE_02 :
           typeof EPISODE_03 !== 'undefined' ? EPISODE_03 : undefined;
  `;
  const fn = new Function(wrapped);
  const result = fn(episodeAsset);
  if (!result) {
    throw new Error('No EPISODE_XX variable found in ' + filePath);
  }
  return result;
}

async function importEpisode(episodeNum, episodeData) {
  console.log(`\n📖 Importing Episode ${episodeNum}: "${episodeData.title}"`);
  
  // Check for existing episode by title
  const existing = await get(`SELECT id FROM episodes WHERE title = ?`, [episodeData.title]);
  if (existing) {
    console.log(`  ℹ Episode already exists (id=${existing.id}), skipping.`);
    return existing.id;
  }
  
  const coverPath = `assets/episodes/episode-${String(episodeNum).padStart(2, '0')}/cover.png`;
  const coverExists = fs.existsSync(resolveProjectPath(coverPath));
  
  const epResult = await run(
    `INSERT INTO episodes (title, description, cover_image, "order", is_published) VALUES (?, ?, ?, ?, ?)`,
    [episodeData.title, '', coverExists ? coverPath : null, episodeNum, 1]
  );
  const episodeId = epResult.lastID;
  console.log(`  ✅ Created episode id=${episodeId}`);
  
  // Copy cover image if exists
  if (coverExists) {
    const coverDest = `episodes/${episodeId}/cover.png`;
    await copyAndRecordMedia(coverPath, coverDest);
  }
  
  const frames = episodeData.frames || [];
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const order = i + 1;
    const frameDir = `episodes/${episodeId}/frames/${order}`;
    
    console.log(`  🖼 Frame ${order}: "${frame.title}"`);
    
    // Copy media files
    let bgImagePath = null;
    let audioSrcPath = null;
    let videoSrcPath = null;
    let dialogueAudioPaths = [];
    
    if (frame.bgImage) {
      const src = frame.bgImage;
      const dest = `${frameDir}/image.png`;
      const media = await copyAndRecordMedia(src, dest);
      if (media) bgImagePath = dest.replace(/\\/g, '/');
    }
    
    if (frame.audioSrc) {
      const src = frame.audioSrc;
      const dest = `${frameDir}/narration.mp3`;
      const media = await copyAndRecordMedia(src, dest);
      if (media) audioSrcPath = dest.replace(/\\/g, '/');
    }
    
    if (frame.videoSrc) {
      const src = frame.videoSrc;
      const dest = `${frameDir}/video.mp4`;
      const media = await copyAndRecordMedia(src, dest);
      if (media) videoSrcPath = dest.replace(/\\/g, '/');
    }
    
    if (Array.isArray(frame.dialogueAudio)) {
      for (let d = 0; d < frame.dialogueAudio.length; d++) {
        const src = frame.dialogueAudio[d];
        const ext = path.extname(src);
        const dest = `${frameDir}/dialogue-${d + 1}${ext}`;
        const media = await copyAndRecordMedia(src, dest);
        if (media) dialogueAudioPaths.push(dest.replace(/\\/g, '/'));
      }
    }
    
    await run(
      `INSERT INTO frames (
        episode_id, "order", title, narration, dialogue_json, dialogue_audio_json,
        background_image, background_video, audio_src, mood, game_type, choices_json,
        transition_text, video_prompt, available_games_json, bg_gradient
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        episodeId,
        order,
        frame.title || '',
        frame.narration || '',
        frame.dialogues ? JSON.stringify(frame.dialogues) : '[]',
        dialogueAudioPaths.length > 0 ? JSON.stringify(dialogueAudioPaths) : null,
        bgImagePath,
        videoSrcPath,
        audioSrcPath,
        frame.mood || null,
        frame.game || null,
        frame.choices ? JSON.stringify(frame.choices) : '[]',
        frame.transitionText || null,
        frame.videoPrompt || null,
        frame.availableGames ? JSON.stringify(frame.availableGames) : '[]',
        frame.bgGradient || null,
      ]
    );
  }
  
  console.log(`  ✅ Imported ${frames.length} frames`);
  return episodeId;
}

async function main() {
  await init();
  
  const args = process.argv.slice(2);
  const shouldReset = args.includes('--reset');
  
  if (shouldReset) {
    console.log('⚠️  Reset mode: clearing episodes, frames, media tables...');
    await run(`DELETE FROM frames`);
    await run(`DELETE FROM episodes`);
    await run(`DELETE FROM media`);
    await run(`DELETE FROM sqlite_sequence WHERE name='episodes'`);
    await run(`DELETE FROM sqlite_sequence WHERE name='frames'`);
    await run(`DELETE FROM sqlite_sequence WHERE name='media'`);
    
    // Clear uploads/episodes directory
    const episodesUploadDir = path.join(UPLOADS_ROOT, 'episodes');
    if (fs.existsSync(episodesUploadDir)) {
      fs.rmSync(episodesUploadDir, { recursive: true });
      console.log('  🗑 Cleared uploads/episodes');
    }
  }
  
  const episodeFiles = [
    { num: 1, file: 'js/episodes/episode-01.js' },
    { num: 2, file: 'js/episodes/episode-02.js' },
  ];
  
  for (const { num, file } of episodeFiles) {
    const filePath = path.join(PROJECT_ROOT, file);
    if (!fs.existsSync(filePath)) {
      console.warn('File not found:', filePath);
      continue;
    }
    const data = loadEpisode(filePath);
    await importEpisode(num, data);
  }
  
  console.log('\n🎉 Import complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
