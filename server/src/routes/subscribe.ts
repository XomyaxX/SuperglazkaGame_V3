const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const { run, get } = require('../db');
const { sendConfirmationEmail } = require('../services/email');

const router = express.Router();

const emailSchema = z.object({
  email: z.string().email()
});

// POST /api/subscribe
router.post('/', async (req, res) => {
  try {
    const { email } = emailSchema.parse(req.body);
    const existing = await get('SELECT id, confirmed FROM subscriptions WHERE email = ?', [email]);
    if (existing) {
      if (existing.confirmed === 1) {
        return res.json({ success: true, message: 'Already subscribed' });
      }
      // Resend confirmation if not confirmed yet
      const token = await get('SELECT confirm_token FROM subscriptions WHERE email = ?', [email]);
      if (token && token.confirm_token) {
        await sendConfirmationEmail(email, token.confirm_token);
      }
      return res.json({ success: true, message: 'Confirmation email resent' });
    }

    const confirmToken = crypto.randomBytes(32).toString('hex');
    await run('INSERT INTO subscriptions (email, confirmed, confirm_token) VALUES (?, 0, ?)', [email, confirmToken]);
    await sendConfirmationEmail(email, confirmToken);

    res.json({ success: true, message: 'Please check your email to confirm subscription' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/subscribe/confirm/:token
router.get('/confirm/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const sub = await get('SELECT id, email FROM subscriptions WHERE confirm_token = ?', [token]);
    if (!sub) {
      return res.status(400).json({ error: 'Invalid or expired confirmation link' });
    }
    await run('UPDATE subscriptions SET confirmed = 1, confirm_token = NULL WHERE id = ?', [sub.id]);
    res.json({ success: true, message: 'Subscription confirmed', email: sub.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
