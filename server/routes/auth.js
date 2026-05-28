const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const https = require('https');
const { run, get } = require('../db');
const { JWT_SECRET, generateTokens, revokeRefreshToken, refreshAccessToken } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://vidial-media.ru';

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
  password: z.string().min(1),
  rememberMe: z.boolean().optional()
});

const oauthStates = new Map();

function randomState() {
  const state = uuidv4().replace(/-/g, '').slice(0, 16);
  oauthStates.set(state, Date.now() + 10 * 60 * 1000); // 10 min expiry
  // cleanup old states occasionally
  if (oauthStates.size > 1000) {
    const now = Date.now();
    for (const [k, v] of oauthStates) { if (v < now) oauthStates.delete(k); }
  }
  return state;
}

function validateState(state) {
  if (!state || !oauthStates.has(state)) return false;
  const expiry = oauthStates.get(state);
  oauthStates.delete(state);
  return expiry > Date.now();
}

function httpsPostJson(url, postData) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const req = https.request({
      hostname: opts.hostname,
      path: opts.pathname + opts.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

function oauthPopupResponse(res, status, data) {
  const payload = JSON.stringify({ type: 'oauth', status, ...data });
  const fallback = status === 'success'
    ? FRONTEND_URL + '/app.html?oauth=success&token=' + encodeURIComponent(data.token || '') + '&refresh=' + encodeURIComponent(data.refreshToken || '')
    : FRONTEND_URL + '/app.html?oauth=error&message=' + encodeURIComponent(data.message || '');
  const html = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><title>OAuth</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage(${payload}, ${JSON.stringify(FRONTEND_URL)});
    window.close();
  } else {
    window.location.href = ${JSON.stringify(fallback)};
  }
<\/script>
</body>
</html>`;
  res.set('Content-Type', 'text/html');
  res.send(html);
}

// ─── GUEST ───
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

// ─── REGISTER ───
router.post('/register', async (req, res) => {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await get('SELECT id FROM users WHERE email = ?', [data.email]);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(data.password, 10);
    const verifyToken = uuidv4();
    const result = await run(
      'INSERT INTO users (email, phone, password_hash, nickname, email_verified, verification_token, verification_sent_at) VALUES (?, ?, ?, ?, 0, ?, datetime("now"))',
      [data.email, data.phone || null, passwordHash, data.nickname, verifyToken]
    );

    try {
      await sendVerificationEmail(data.email, verifyToken);
    } catch (emailErr) {
      console.warn('Failed to send verification email:', emailErr.message);
    }

    res.json({ message: 'Registration successful. Please check your email to verify your account.', userId: result.lastID });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── VERIFY EMAIL ───
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const user = await get('SELECT * FROM users WHERE verification_token = ?', [token]);
    if (!user) return res.status(400).json({ error: 'Invalid or expired verification token' });

    await run('UPDATE users SET email_verified = 1, verification_token = NULL, verification_sent_at = NULL WHERE id = ?', [user.id]);
    res.redirect(FRONTEND_URL + '/?verified=1');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── RESEND VERIFICATION ───
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await get('SELECT * FROM users WHERE email = ? AND email_verified = 0', [email]);
    if (!user) return res.status(400).json({ error: 'User not found or already verified' });

    const verifyToken = uuidv4();
    await run('UPDATE users SET verification_token = ?, verification_sent_at = datetime("now") WHERE id = ?', [verifyToken, user.id]);
    await sendVerificationEmail(email, verifyToken);
    res.json({ message: 'Verification email sent' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── LOGIN ───
router.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = loginSchema.parse(req.body);
    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Email not verified. Please check your inbox.', code: 'EMAIL_NOT_VERIFIED' });
    }

    const tokens = await generateTokens(user.id, rememberMe);
    res.json({
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      type: 'user',
      user: { id: user.id, email: user.email, nickname: user.nickname }
    });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── REFRESH ───
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const { accessToken, userId } = await refreshAccessToken(refreshToken);
    const user = await get('SELECT id, email, nickname FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ token: accessToken, user: { id: user.id, email: user.email, nickname: user.nickname } });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// ─── LOGOUT ───
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string().optional() }).parse(req.body);
    if (refreshToken) await revokeRefreshToken(refreshToken);
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── FORGOT PASSWORD ───
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.json({ message: 'If this email exists, a reset link has been sent.' }); // don't leak existence

    const resetToken = uuidv4();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    await run('UPDATE users SET reset_token = ?, reset_expires_at = ? WHERE id = ?', [resetToken, expires, user.id]);
    await sendPasswordResetEmail(email, resetToken);
    res.json({ message: 'If this email exists, a reset link has been sent.' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── RESET PASSWORD ───
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = z.object({ token: z.string(), newPassword: z.string().min(6).max(100) }).parse(req.body);
    const user = await get('SELECT * FROM users WHERE reset_token = ? AND reset_expires_at > datetime("now")', [token]);
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });

    const hash = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL WHERE id = ?', [hash, user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ME ───
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await get('SELECT id, email, nickname, email_verified FROM users WHERE id = ?', [decoded.userId]);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ id: user.id, email: user.email, nickname: user.nickname, emailVerified: !!user.email_verified });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

// ─── GOOGLE OAUTH ───
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

router.get('/oauth/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(500).json({ error: 'Google OAuth not configured' });
  const state = randomState();
  const redirectUri = FRONTEND_URL + '/api/auth/oauth/google/callback';
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?'
    + 'client_id=' + encodeURIComponent(GOOGLE_CLIENT_ID)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&response_type=code'
    + '&scope=' + encodeURIComponent('openid email profile')
    + '&state=' + state;
  res.redirect(url);
});

router.get('/oauth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return oauthPopupResponse(res, 'error', { message: 'no_code' });
    if (!validateState(state)) return oauthPopupResponse(res, 'error', { message: 'invalid_state' });

    const redirectUri = FRONTEND_URL + '/api/auth/oauth/google/callback';
    const postData = 'code=' + encodeURIComponent(code)
      + '&client_id=' + encodeURIComponent(GOOGLE_CLIENT_ID)
      + '&client_secret=' + encodeURIComponent(GOOGLE_CLIENT_SECRET)
      + '&redirect_uri=' + encodeURIComponent(redirectUri)
      + '&grant_type=authorization_code';

    const tokenResp = await httpsPostJson('https://oauth2.googleapis.com/token', postData);
    if (!tokenResp.access_token) {
      console.error('Google token error:', tokenResp);
      return oauthPopupResponse(res, 'error', { message: 'token_exchange_failed' });
    }

    const profile = await httpsGetJson('https://www.googleapis.com/oauth2/v2/userinfo?access_token=' + encodeURIComponent(tokenResp.access_token));
    if (!profile.id) {
      console.error('Google profile error:', profile);
      return oauthPopupResponse(res, 'error', { message: 'profile_fetch_failed' });
    }

    let user = await get('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?', ['google', String(profile.id)]);
    if (!user) {
      const existingEmail = await get('SELECT id FROM users WHERE email = ?', [profile.email]);
      if (existingEmail) {
        await run('UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?', ['google', String(profile.id), existingEmail.id]);
        user = await get('SELECT * FROM users WHERE id = ?', [existingEmail.id]);
      } else {
        const result = await run(
          'INSERT INTO users (email, password_hash, nickname, email_verified, oauth_provider, oauth_id) VALUES (?, ?, ?, 1, ?, ?)',
          [profile.email, await bcrypt.hash(uuidv4(), 10), profile.name || profile.email.split('@')[0], 'google', String(profile.id)]
        );
        user = await get('SELECT * FROM users WHERE id = ?', [result.lastID]);
      }
    }

    const tokens = await generateTokens(user.id, true);
    oauthPopupResponse(res, 'success', { token: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    console.error('Google OAuth error:', err);
    oauthPopupResponse(res, 'error', { message: 'server_error' });
  }
});

// ─── VK OAUTH ───
const VK_CLIENT_ID = process.env.VK_CLIENT_ID;
const VK_CLIENT_SECRET = process.env.VK_CLIENT_SECRET;

router.get('/oauth/vk', (req, res) => {
  if (!VK_CLIENT_ID) return res.status(500).json({ error: 'VK OAuth not configured' });
  const state = randomState();
  const redirectUri = FRONTEND_URL + '/api/auth/oauth/vk/callback';
  const url = 'https://oauth.vk.com/authorize?'
    + 'client_id=' + encodeURIComponent(VK_CLIENT_ID)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&response_type=code'
    + '&scope=' + encodeURIComponent('email')
    + '&state=' + state;
  res.redirect(url);
});

router.get('/oauth/vk/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return oauthPopupResponse(res, 'error', { message: 'no_code' });
    if (!validateState(state)) return oauthPopupResponse(res, 'error', { message: 'invalid_state' });

    const redirectUri = FRONTEND_URL + '/api/auth/oauth/vk/callback';
    const tokenUrl = 'https://oauth.vk.com/access_token?'
      + 'client_id=' + encodeURIComponent(VK_CLIENT_ID)
      + '&client_secret=' + encodeURIComponent(VK_CLIENT_SECRET)
      + '&redirect_uri=' + encodeURIComponent(redirectUri)
      + '&code=' + encodeURIComponent(code);

    const tokenResp = await httpsGetJson(tokenUrl);
    if (!tokenResp.access_token) {
      console.error('VK token error:', tokenResp);
      return oauthPopupResponse(res, 'error', { message: 'token_exchange_failed' });
    }

    const vkUserId = String(tokenResp.user_id);
    const email = tokenResp.email;

    const profileUrl = 'https://api.vk.com/method/users.get?user_ids=' + encodeURIComponent(vkUserId)
      + '&fields=photo_200,first_name,last_name& v=5.199&access_token=' + encodeURIComponent(tokenResp.access_token);
    const profileResp = await httpsGetJson(profileUrl);
    const profile = profileResp.response && profileResp.response[0] ? profileResp.response[0] : null;
    const nickname = profile ? (profile.first_name + ' ' + profile.last_name).trim() : ('vk_user_' + vkUserId);

    let user = await get('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?', ['vk', vkUserId]);
    if (!user) {
      const existingEmail = email ? await get('SELECT id FROM users WHERE email = ?', [email]) : null;
      if (existingEmail) {
        await run('UPDATE users SET oauth_provider = ?, oauth_id = ? WHERE id = ?', ['vk', vkUserId, existingEmail.id]);
        user = await get('SELECT * FROM users WHERE id = ?', [existingEmail.id]);
      } else {
        const result = await run(
          'INSERT INTO users (email, password_hash, nickname, email_verified, oauth_provider, oauth_id) VALUES (?, ?, ?, 1, ?, ?)',
          [email || (vkUserId + '@vk.temp'), await bcrypt.hash(uuidv4(), 10), nickname, 'vk', vkUserId]
        );
        user = await get('SELECT * FROM users WHERE id = ?', [result.lastID]);
      }
    }

    const tokens = await generateTokens(user.id, true);
    oauthPopupResponse(res, 'success', { token: tokens.accessToken, refreshToken: tokens.refreshToken });
  } catch (err) {
    console.error('VK OAuth error:', err);
    oauthPopupResponse(res, 'error', { message: 'server_error' });
  }
});

module.exports = router;
