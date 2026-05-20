const express = require('express');
const { z } = require('zod');
const { run, get } = require('../db');
const { authenticate, requireUser } = require('../middleware/auth');

const router = express.Router();

const amountSchema = z.object({
  amount: z.number().int().min(1)
});

async function getCoinsRow(auth) {
  if (auth.type === 'user') {
    return get('SELECT * FROM coins WHERE user_id = ?', [auth.id]);
  }
  return get('SELECT * FROM coins WHERE guest_token = ?', [auth.token]);
}

async function ensureCoinsRow(auth) {
  const existing = await getCoinsRow(auth);
  if (existing) return existing;
  if (auth.type === 'user') {
    await run('INSERT INTO coins (user_id, amount) VALUES (?, 0)', [auth.id]);
  } else {
    await run('INSERT INTO coins (guest_token, amount) VALUES (?, 0)', [auth.token]);
  }
  return getCoinsRow(auth);
}

// GET /api/coins
router.get('/', authenticate, async (req, res) => {
  try {
    const row = await getCoinsRow(req.auth);
    res.json({ amount: row ? row.amount : 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/coins/add
router.post('/add', authenticate, async (req, res) => {
  try {
    const { amount } = amountSchema.parse(req.body);
    const row = await ensureCoinsRow(req.auth);
    const newAmount = (row ? row.amount : 0) + amount;
    if (req.auth.type === 'user') {
      await run('UPDATE coins SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [newAmount, req.auth.id]);
    } else {
      await run('UPDATE coins SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE guest_token = ?', [newAmount, req.auth.token]);
    }
    res.json({ amount: newAmount });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/coins/spend — only for full users
router.post('/spend', authenticate, requireUser, async (req, res) => {
  try {
    const { amount } = amountSchema.parse(req.body);
    const row = await getCoinsRow(req.auth);
    if (!row || row.amount < amount) {
      return res.status(400).json({ error: 'Not enough coins' });
    }
    const newAmount = row.amount - amount;
    await run('UPDATE coins SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?', [newAmount, req.auth.id]);
    res.json({ amount: newAmount });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
