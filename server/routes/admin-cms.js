const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { run, get, all } = require('../db');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();
router.use(requireAdmin);

// Ensure uploads directory exists
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, 'temp');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeName = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = /image|video|audio/;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image, video, and audio files are allowed'));
  }
});

// ─── EPISODES ───

// GET /api/admin/episodes
router.get('/episodes', async (req, res) => {
  try {
    const episodes = await all('SELECT * FROM episodes ORDER BY "order" ASC');
    res.json({ success: true, episodes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/episodes/:id
router.get('/episodes/:id', async (req, res) => {
  try {
    const episode = await get('SELECT * FROM episodes WHERE id = ?', [req.params.id]);
    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    const frames = await all('SELECT * FROM frames WHERE episode_id = ? ORDER BY "order" ASC', [req.params.id]);
    episode.frames = frames;
    res.json({ success: true, episode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/episodes
router.post('/episodes', async (req, res) => {
  try {
    const { title, description, cover_image, order } = req.body;
    const result = await run(
      'INSERT INTO episodes (title, description, cover_image, "order") VALUES (?, ?, ?, ?)',
      [title || '', description || '', cover_image || '', order || 0]
    );
    res.json({ success: true, id: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/episodes/:id
router.put('/episodes/:id', async (req, res) => {
  try {
    const { title, description, cover_image, order, is_published } = req.body;
    await run(
      'UPDATE episodes SET title = ?, description = ?, cover_image = ?, "order" = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title || '', description || '', cover_image || '', order ?? 0, is_published ?? 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/episodes/:id
router.delete('/episodes/:id', async (req, res) => {
  try {
    // Delete associated files
    const frames = await all('SELECT background_image, background_video FROM frames WHERE episode_id = ?', [req.params.id]);
    for (const f of frames) {
      if (f.background_image) {
        const p = path.join(UPLOAD_DIR, f.background_image);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      if (f.background_video) {
        const p = path.join(UPLOAD_DIR, f.background_video);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
    await run('DELETE FROM episodes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/episodes/:id/publish
router.post('/episodes/:id/publish', async (req, res) => {
  try {
    const { is_published } = req.body;
    await run('UPDATE episodes SET is_published = ? WHERE id = ?', [is_published ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── FRAMES ───

// POST /api/admin/episodes/:id/frames
router.post('/episodes/:id/frames', async (req, res) => {
  try {
    const { order, title, narration, dialogue, background_image, background_video, mood, game_type, choices } = req.body;
    const result = await run(
      'INSERT INTO frames (episode_id, "order", title, narration, dialogue_json, background_image, background_video, mood, game_type, choices_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        req.params.id, order ?? 0, title || '', narration || '',
        dialogue ? JSON.stringify(dialogue) : '[]',
        background_image || '', background_video || '', mood || '', game_type || '',
        choices ? JSON.stringify(choices) : '[]'
      ]
    );
    res.json({ success: true, id: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/frames/:id
router.put('/frames/:id', async (req, res) => {
  try {
    const { order, title, narration, dialogue, background_image, background_video, mood, game_type, choices } = req.body;
    await run(
      'UPDATE frames SET "order" = ?, title = ?, narration = ?, dialogue_json = ?, background_image = ?, background_video = ?, mood = ?, game_type = ?, choices_json = ? WHERE id = ?',
      [
        order ?? 0, title || '', narration || '',
        dialogue ? JSON.stringify(dialogue) : '[]',
        background_image || '', background_video || '', mood || '', game_type || '',
        choices ? JSON.stringify(choices) : '[]', req.params.id
      ]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/frames/:id
router.delete('/frames/:id', async (req, res) => {
  try {
    const frame = await get('SELECT background_image, background_video FROM frames WHERE id = ?', [req.params.id]);
    if (frame) {
      if (frame.background_image) {
        const p = path.join(UPLOAD_DIR, frame.background_image);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
      if (frame.background_video) {
        const p = path.join(UPLOAD_DIR, frame.background_video);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
    await run('DELETE FROM frames WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/episodes/:id/reorder
router.post('/episodes/:id/reorder', async (req, res) => {
  try {
    const { frameIds } = req.body; // array of frame IDs in new order
    if (!Array.isArray(frameIds)) return res.status(400).json({ error: 'frameIds must be an array' });
    for (let i = 0; i < frameIds.length; i++) {
      await run('UPDATE frames SET "order" = ? WHERE id = ?', [i, frameIds[i]]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── UPLOAD ───

// POST /api/admin/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const relativePath = 'temp/' + req.file.filename;
    await run(
      'INSERT INTO media (filename, original_name, mime_type, size, path) VALUES (?, ?, ?, ?, ?)',
      [req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, relativePath]
    );
    res.json({ success: true, filename: req.file.filename, path: relativePath, url: '/uploads/' + relativePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/media/:filename
router.delete('/media/:filename', async (req, res) => {
  try {
    const filePath = path.join(UPLOAD_DIR, 'temp', req.params.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await run('DELETE FROM media WHERE filename = ?', [req.params.filename]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
