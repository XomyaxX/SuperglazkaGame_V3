const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { run, get } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const guestSchema = z.object({
  nickname: z.string().min(1).max(30)
});

const registerSchema = z.object({
  email: z.string().email().max(100),
  phone: z.string().max(20).optional().or(z.literal('')),
  password: z.string().min(6).max(100),
  nickname: z.string().min(1).max(30)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// POST /api/auth/guest
router.post('/guest', async (req, res) => {
  try {
    const { nickname } = guestSchema.parse(req.body);
    const token = uuidv4();
    await run('INSERT INTO guests (token, nickname) VALUES (?, ?)', [token, nickname]);
    res.json({ token, nickname, type: 'guest' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await get('SELECT id FROM users WHERE email = ?', [data.email]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(data.password, 10);
    const result = await run(
      'INSERT INTO users (email, phone, password_hash, nickname) VALUES (?, ?, ?, ?)',
      [data.email, data.phone || null, passwordHash, data.nickname]
    );

    const token = jwt.sign({ userId: result.lastID }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, type: 'user', user: { id: result.lastID, email: data.email, nickname: data.nickname } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, type: 'user', user: { id: user.id, email: user.email, nickname: user.nickname } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
