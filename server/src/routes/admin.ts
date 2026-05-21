const express = require('express');
const { z } = require('zod');
const { all } = require('../db');
const { sendBulkNewEpisode } = require('../services/email');

const router = express.Router();

const notifySchema = z.object({
  episodeId: z.string().min(1),
  episodeTitle: z.string().min(1),
  episodeUrl: z.string().url().optional()
});

// POST /api/admin/notify
router.post('/notify', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== process.env.ADMIN_API_KEY) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const data = notifySchema.parse(req.body);
    const subscribers = await all('SELECT email FROM subscriptions WHERE confirmed = 1');
    if (subscribers.length === 0) {
      return res.json({ success: true, sent: 0, message: 'No confirmed subscribers' });
    }

    const results = await sendBulkNewEpisode(
      subscribers,
      data.episodeTitle,
      data.episodeId,
      data.episodeUrl || process.env.FRONTEND_URL + '/app.html'
    );

    const sent = results.filter(r => r.status === 'sent').length;
    res.json({ success: true, sent, total: subscribers.length, details: results });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
