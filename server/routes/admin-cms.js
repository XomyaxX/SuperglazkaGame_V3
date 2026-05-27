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
    episode.frames = frames.map(f => ({
      ...f,
      dialogue: f.dialogue_json ? JSON.parse(f.dialogue_json) : [],
      dialogueAudio: f.dialogue_audio_json ? JSON.parse(f.dialogue_audio_json) : [],
      choices: f.choices_json ? JSON.parse(f.choices_json) : [],
      availableGames: f.available_games_json ? JSON.parse(f.available_games_json) : []
    }));
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
    const { book_num } = req.body;
    const result = await run(
      'INSERT INTO episodes (title, description, cover_image, "order", book_num) VALUES (?, ?, ?, ?, ?)',
      [title || '', description || '', cover_image || '', order || 0, book_num ?? 1]
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
    const { book_num } = req.body;
    await run(
      'UPDATE episodes SET title = ?, description = ?, cover_image = ?, "order" = ?, is_published = ?, book_num = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title || '', description || '', cover_image || '', order ?? 0, is_published ?? 0, book_num ?? 1, req.params.id]
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
    const frames = await all('SELECT background_image, background_video, audio_src, dialogue_audio_json FROM frames WHERE episode_id = ?', [req.params.id]);
    for (const f of frames) {
      for (const field of ['background_image', 'background_video', 'audio_src']) {
        if (f[field]) {
          const p = path.join(UPLOAD_DIR, f[field]);
          if (fs.existsSync(p)) fs.unlinkSync(p);
        }
      }
      if (f.dialogue_audio_json) {
        try {
          const audios = JSON.parse(f.dialogue_audio_json);
          for (const a of audios) {
            const p = path.join(UPLOAD_DIR, a);
            if (fs.existsSync(p)) fs.unlinkSync(p);
          }
        } catch (e) {}
      }
    }
    // Delete episode directory
    const epDir = path.join(UPLOAD_DIR, 'episodes', req.params.id);
    if (fs.existsSync(epDir)) fs.rmSync(epDir, { recursive: true });
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
    const { order, title, narration, dialogue, dialogue_audio, background_image, background_video, audio_src, mood, game_type, choices, transition_text, video_prompt, available_games, bg_gradient } = req.body;
    const result = await run(
      'INSERT INTO frames (episode_id, "order", title, narration, dialogue_json, dialogue_audio_json, background_image, background_video, audio_src, mood, game_type, choices_json, transition_text, video_prompt, available_games_json, bg_gradient) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        req.params.id, order ?? 0, title || '', narration || '',
        dialogue ? JSON.stringify(dialogue) : '[]',
        dialogue_audio ? JSON.stringify(dialogue_audio) : '[]',
        background_image || '', background_video || '', audio_src || '', mood || '', game_type || '',
        choices ? JSON.stringify(choices) : '[]',
        transition_text || '', video_prompt || '',
        available_games ? JSON.stringify(available_games) : '[]',
        bg_gradient || ''
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
    const { order, title, narration, dialogue, dialogue_audio, background_image, background_video, audio_src, mood, game_type, choices, transition_text, video_prompt, available_games, bg_gradient } = req.body;
    await run(
      'UPDATE frames SET "order" = ?, title = ?, narration = ?, dialogue_json = ?, dialogue_audio_json = ?, background_image = ?, background_video = ?, audio_src = ?, mood = ?, game_type = ?, choices_json = ?, transition_text = ?, video_prompt = ?, available_games_json = ?, bg_gradient = ? WHERE id = ?',
      [
        order ?? 0, title || '', narration || '',
        dialogue ? JSON.stringify(dialogue) : '[]',
        dialogue_audio ? JSON.stringify(dialogue_audio) : '[]',
        background_image || '', background_video || '', audio_src || '', mood || '', game_type || '',
        choices ? JSON.stringify(choices) : '[]',
        transition_text || '', video_prompt || '',
        available_games ? JSON.stringify(available_games) : '[]',
        bg_gradient || '',
        req.params.id
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
    const frame = await get('SELECT background_image, background_video, audio_src, dialogue_audio_json FROM frames WHERE id = ?', [req.params.id]);
    if (frame) {
      for (const field of ['background_image', 'background_video', 'audio_src']) {
        if (frame[field]) {
          const p = path.join(UPLOAD_DIR, frame[field]);
          if (fs.existsSync(p)) fs.unlinkSync(p);
        }
      }
      if (frame.dialogue_audio_json) {
        try {
          const audios = JSON.parse(frame.dialogue_audio_json);
          for (const a of audios) {
            const p = path.join(UPLOAD_DIR, a);
            if (fs.existsSync(p)) fs.unlinkSync(p);
          }
        } catch (e) {}
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

// ─── BLOG POSTS ───

// GET /api/admin/blog
router.get('/blog', async (req, res) => {
  try {
    const posts = await all('SELECT id, title, slug, excerpt, category, published, created_at FROM blog_posts ORDER BY created_at DESC');
    res.json({ success: true, posts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/blog/:id
router.get('/blog/:id', async (req, res) => {
  try {
    const post = await get('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ success: true, post });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/blog
router.post('/blog', async (req, res) => {
  try {
    const { title, slug, excerpt, content, category, image, published } = req.body;
    const result = await run(
      'INSERT INTO blog_posts (title, slug, excerpt, content, category, image, published) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title || '', slug || '', excerpt || '', content || '', category || '', image || '', published ? 1 : 0]
    );
    res.json({ success: true, id: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/blog/:id
router.put('/blog/:id', async (req, res) => {
  try {
    const { title, slug, excerpt, content, category, image, published } = req.body;
    await run(
      'UPDATE blog_posts SET title = ?, slug = ?, excerpt = ?, content = ?, category = ?, image = ?, published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title || '', slug || '', excerpt || '', content || '', category || '', image || '', published ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/blog/:id
router.delete('/blog/:id', async (req, res) => {
  try {
    await run('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── USERS ───

// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT id, email, phone, nickname, created_at FROM users';
    let params = [];
    if (search) {
      sql += ' WHERE email LIKE ? OR nickname LIKE ?';
      params.push('%' + search + '%', '%' + search + '%');
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const users = await all(sql, params);
    const countRow = await get('SELECT COUNT(*) as count FROM users' + (search ? ' WHERE email LIKE ? OR nickname LIKE ?' : ''), search ? ['%' + search + '%', '%' + search + '%'] : []);
    res.json({ success: true, users, total: countRow.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/users/:id
router.get('/users/:id', async (req, res) => {
  try {
    const user = await get('SELECT id, email, phone, nickname, created_at FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const progress = await all('SELECT episode_id, frame_index, completed, updated_at FROM progress WHERE user_id = ?', [req.params.id]);
    const coins = await get('SELECT amount, updated_at FROM coins WHERE user_id = ?', [req.params.id]);
    const achievements = await all('SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?', [req.params.id]);
    res.json({ success: true, user: { ...user, progress, coins, achievements } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', async (req, res) => {
  try {
    const { nickname, email, phone } = req.body;
    if (!nickname || !email) return res.status(400).json({ error: 'Nickname and email are required' });
    if (nickname.length > 30) return res.status(400).json({ error: 'Nickname too long' });
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email' });
    const existing = await get('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.params.id]);
    if (existing) return res.status(409).json({ error: 'Email already taken' });
    await run(
      'UPDATE users SET nickname = ?, email = ?, phone = ? WHERE id = ?',
      [nickname, email, phone || '', req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  try {
    await run('DELETE FROM progress WHERE user_id = ?', [req.params.id]);
    await run('DELETE FROM coins WHERE user_id = ?', [req.params.id]);
    await run('DELETE FROM user_achievements WHERE user_id = ?', [req.params.id]);
    await run('DELETE FROM daily_rewards WHERE user_id = ?', [req.params.id]);
    await run('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GUESTS ───

// GET /api/admin/guests
router.get('/guests', async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    let sql = 'SELECT id, token, nickname, created_at FROM guests';
    let params = [];
    if (search) {
      sql += ' WHERE nickname LIKE ? OR token LIKE ?';
      params.push('%' + search + '%', '%' + search + '%');
    }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    const guests = await all(sql, params);
    const countRow = await get('SELECT COUNT(*) as count FROM guests' + (search ? ' WHERE nickname LIKE ? OR token LIKE ?' : ''), search ? ['%' + search + '%', '%' + search + '%'] : []);
    res.json({ success: true, guests, total: countRow.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/guests/:id
router.get('/guests/:id', async (req, res) => {
  try {
    const guest = await get('SELECT id, token, nickname, created_at FROM guests WHERE id = ?', [req.params.id]);
    if (!guest) return res.status(404).json({ error: 'Guest not found' });
    const progress = await all('SELECT episode_id, frame_index, completed, updated_at FROM progress WHERE guest_token = ?', [guest.token]);
    const coins = await get('SELECT amount, updated_at FROM coins WHERE guest_token = ?', [guest.token]);
    res.json({ success: true, guest: { ...guest, progress, coins } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/guests/:id
router.delete('/guests/:id', async (req, res) => {
  try {
    const guest = await get('SELECT token FROM guests WHERE id = ?', [req.params.id]);
    if (guest) {
      await run('DELETE FROM progress WHERE guest_token = ?', [guest.token]);
      await run('DELETE FROM coins WHERE guest_token = ?', [guest.token]);
      await run('DELETE FROM user_achievements WHERE guest_token = ?', [guest.token]);
      await run('DELETE FROM daily_rewards WHERE guest_token = ?', [guest.token]);
    }
    await run('DELETE FROM guests WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
