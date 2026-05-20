const express = require('express');
const { z } = require('zod');
const { run, get, all } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const saveSchema = z.object({
  episodeId: z.string().min(1),
  maxFrame: z.number().int().min(-1),
  completed: z.boolean().optional()
});

// GET /api/progress
router.get('/', authenticate, async (req, res) => {
  try {
    let rows;
    if (req.auth.type === 'user') {
      rows = await all('SELECT episode_id, max_frame, completed FROM progress WHERE user_id = ?', [req.auth.id]);
    } else {
      rows = await all('SELECT episode_id, max_frame, completed FROM progress WHERE guest_token = ?', [req.auth.token]);
    }
    const progress = {};
    rows.forEach(r => {
      progress[r.episode_id] = { maxFrame: r.max_frame, completed: !!r.completed };
    });
    res.json({ progress });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/progress
router.post('/', authenticate, async (req, res) => {
  try {
    const data = saveSchema.parse(req.body);
    const { episodeId, maxFrame, completed } = data;

    if (req.auth.type === 'user') {
      const existing = await get('SELECT id FROM progress WHERE user_id = ? AND episode_id = ?', [req.auth.id, episodeId]);
      if (existing) {
        await run(
          'UPDATE progress SET max_frame = ?, completed = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND episode_id = ?',
          [maxFrame, completed ? 1 : 0, req.auth.id, episodeId]
        );
      } else {
        await run(
          'INSERT INTO progress (user_id, episode_id, max_frame, completed) VALUES (?, ?, ?, ?)',
          [req.auth.id, episodeId, maxFrame, completed ? 1 : 0]
        );
      }
    } else {
      const existing = await get('SELECT id FROM progress WHERE guest_token = ? AND episode_id = ?', [req.auth.token, episodeId]);
      if (existing) {
        await run(
          'UPDATE progress SET max_frame = ?, completed = ?, updated_at = CURRENT_TIMESTAMP WHERE guest_token = ? AND episode_id = ?',
          [maxFrame, completed ? 1 : 0, req.auth.token, episodeId]
        );
      } else {
        await run(
          'INSERT INTO progress (guest_token, episode_id, max_frame, completed) VALUES (?, ?, ?, ?)',
          [req.auth.token, episodeId, maxFrame, completed ? 1 : 0]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
