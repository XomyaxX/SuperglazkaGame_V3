const express = require('express');
const { get, all, run } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/achievements — list all achievements with unlocked status
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.auth.type === 'user' ? req.auth.id : null;
    const guestToken = req.auth.type === 'guest' ? req.auth.token : null;
    const achievements = await all('SELECT * FROM achievements ORDER BY id ASC');
    let unlocked = [];
    if (userId) {
      unlocked = await all('SELECT achievement_id FROM user_achievements WHERE user_id = ?', [userId]);
    } else if (guestToken) {
      unlocked = await all('SELECT achievement_id FROM user_achievements WHERE guest_token = ?', [guestToken]);
    }
    const unlockedIds = new Set(unlocked.map(u => u.achievement_id));
    res.json({
      success: true,
      achievements: achievements.map(a => ({ ...a, unlocked: unlockedIds.has(a.id) }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/achievements/check — check and unlock achievements
router.post('/check', authenticate, async (req, res) => {
  try {
    const userId = req.auth.type === 'user' ? req.auth.id : null;
    const guestToken = req.auth.type === 'guest' ? req.auth.token : null;
    const { type, value, count } = req.body;

    if (!userId && !guestToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const achievements = await all('SELECT * FROM achievements WHERE condition_type = ?', [type]);
    const unlocked = [];

    for (const ach of achievements) {
      let shouldUnlock = false;
      if (type === 'game' && ach.condition_value === value) shouldUnlock = true;
      else if (type === 'game_count') {
        const [gameName, needed] = ach.condition_value.split(':');
        if (gameName === value && count >= parseInt(needed, 10)) shouldUnlock = true;
      }
      else if (type === 'episode' && count >= parseInt(ach.condition_value || '1', 10)) shouldUnlock = true;
      else if (type === 'episode_all') shouldUnlock = true;
      else if (type === 'frame' && count >= parseInt(ach.condition_value || '1', 10)) shouldUnlock = true;
      else if (type === 'coins' && count >= parseInt(ach.condition_value || '0', 10)) shouldUnlock = true;

      if (!shouldUnlock) continue;

      // Check if already unlocked
      const exists = await get(
        'SELECT id FROM user_achievements WHERE achievement_id = ? AND (user_id = ? OR guest_token = ?)',
        [ach.id, userId || 0, guestToken || '']
      );
      if (!exists) {
        await run(
          'INSERT INTO user_achievements (user_id, guest_token, achievement_id) VALUES (?, ?, ?)',
          [userId, guestToken, ach.id]
        );
        unlocked.push(ach);
      }
    }

    res.json({ success: true, unlocked });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
