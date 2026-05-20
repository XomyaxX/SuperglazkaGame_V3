const express = require('express');
const { z } = require('zod');
const { run, get } = require('../db');

const router = express.Router();

const emailSchema = z.object({
  email: z.string().email()
});

// POST /api/subscribe
router.post('/', async (req, res) => {
  try {
    const { email } = emailSchema.parse(req.body);
    const existing = await get('SELECT id FROM subscriptions WHERE email = ?', [email]);
    if (existing) {
      return res.json({ success: true, message: 'Already subscribed' });
    }
    await run('INSERT INTO subscriptions (email, confirmed) VALUES (?, 1)', [email]);
    res.json({ success: true, message: 'Subscribed successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
