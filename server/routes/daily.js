const express = require('express');
const { get, run } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/daily/status — get current streak and claim status
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = req.auth.type === 'user' ? req.auth.id : null;
    const guestToken = req.auth.type === 'guest' ? req.auth.token : null;

    if (!userId && !guestToken) {
      return res.json({ success: true, streak: 0, canClaim: true, reward: 10 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const lastClaim = await get(
      'SELECT * FROM daily_rewards WHERE (user_id = ? OR guest_token = ?) ORDER BY date DESC LIMIT 1',
      [userId || 0, guestToken || '']
    );

    let streak = 0;
    let canClaim = true;
    let reward = 10;

    if (lastClaim) {
      streak = lastClaim.streak;
      if (lastClaim.date === today) {
        canClaim = false;
      } else {
        const lastDate = new Date(lastClaim.date);
        const now = new Date(today);
        const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          streak += 1;
        } else if (diffDays > 1) {
          streak = 1;
        }
      }
    }

    // Reward table
    const rewards = [10, 15, 20, 25, 30, 50, 50];
    reward = rewards[Math.min(streak - 1, rewards.length - 1)] || 10;

    res.json({ success: true, streak, canClaim, reward, today });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/daily/claim — claim daily reward
router.post('/claim', authenticate, async (req, res) => {
  try {
    const userId = req.auth.type === 'user' ? req.auth.id : null;
    const guestToken = req.auth.type === 'guest' ? req.auth.token : null;

    if (!userId && !guestToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Check if already claimed
    const existing = await get(
      'SELECT id FROM daily_rewards WHERE (user_id = ? OR guest_token = ?) AND date = ?',
      [userId || 0, guestToken || '', today]
    );
    if (existing) {
      return res.status(400).json({ error: 'Already claimed today' });
    }

    // Get last claim for streak
    const lastClaim = await get(
      'SELECT * FROM daily_rewards WHERE (user_id = ? OR guest_token = ?) ORDER BY date DESC LIMIT 1',
      [userId || 0, guestToken || '']
    );

    let streak = 1;
    if (lastClaim) {
      const lastDate = new Date(lastClaim.date);
      const now = new Date(today);
      const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) streak = lastClaim.streak + 1;
      else if (diffDays > 1) streak = 1;
    }

    await run(
      'INSERT INTO daily_rewards (user_id, guest_token, date, streak, claimed) VALUES (?, ?, ?, ?, 1)',
      [userId, guestToken, today, streak]
    );

    const rewards = [10, 15, 20, 25, 30, 50, 50];
    const reward = rewards[Math.min(streak - 1, rewards.length - 1)] || 10;

    res.json({ success: true, streak, reward });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
