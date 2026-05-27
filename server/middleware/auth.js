const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { get, run } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set');
  process.exit(1);
}

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY = '7d';
const REFRESH_EXPIRY_REMEMBER = '30d';

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
}

function signRefreshToken(payload, rememberMe) {
  const expiresIn = rememberMe ? REFRESH_EXPIRY_REMEMBER : REFRESH_EXPIRY;
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

async function generateTokens(userId, rememberMe) {
  const accessToken = signAccessToken({ userId });
  const refreshToken = signRefreshToken({ userId, jti: uuidv4() }, rememberMe);
  const expiresDays = rememberMe ? 30 : 7;
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString();
  await run('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [userId, refreshToken, expiresAt]);
  return { accessToken, refreshToken };
}

async function revokeRefreshToken(token) {
  await run('DELETE FROM refresh_tokens WHERE token = ?', [token]);
}

async function rotateRefreshToken(oldToken, userId, rememberMe) {
  await revokeRefreshToken(oldToken);
  return generateTokens(userId, rememberMe);
}

async function refreshAccessToken(refreshToken) {
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    const row = await get('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime("now")', [refreshToken]);
    if (!row || row.user_id !== decoded.userId) {
      throw new Error('Invalid refresh token');
    }
    const accessToken = signAccessToken({ userId: decoded.userId });
    return { accessToken, userId: decoded.userId };
  } catch (err) {
    throw new Error('Invalid or expired refresh token');
  }
}

async function authenticate(req, res, next) {
  const guestToken = req.headers['x-guest-token'];
  const authHeader = req.headers['authorization'];

  req.auth = { type: null, id: null, token: null };

  if (guestToken) {
    const guest = await get('SELECT * FROM guests WHERE token = ?', [guestToken]);
    if (guest) {
      req.auth = { type: 'guest', id: guest.id, token: guestToken, nickname: guest.nickname };
      return next();
    }
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await get('SELECT id, email, nickname, email_verified FROM users WHERE id = ?', [decoded.userId]);
      if (user) {
        req.auth = { type: 'user', id: user.id, token, nickname: user.nickname, email: user.email, emailVerified: !!user.email_verified };
        return next();
      }
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
}

function optionalAuth(req, res, next) {
  const guestToken = req.headers['x-guest-token'];
  const authHeader = req.headers['authorization'];

  req.auth = { type: null, id: null, token: null };

  if (guestToken) {
    get('SELECT * FROM guests WHERE token = ?', [guestToken]).then(guest => {
      if (guest) {
        req.auth = { type: 'guest', id: guest.id, token: guestToken, nickname: guest.nickname };
      }
      next();
    }).catch(() => next());
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      get('SELECT id, email, nickname, email_verified FROM users WHERE id = ?', [decoded.userId]).then(user => {
        if (user) {
          req.auth = { type: 'user', id: user.id, token, nickname: user.nickname, email: user.email, emailVerified: !!user.email_verified };
        }
        next();
      }).catch(() => next());
    } catch (err) {
      next();
    }
  } else {
    next();
  }
}

function requireUser(req, res, next) {
  if (req.auth.type !== 'user') {
    return res.status(403).json({ error: 'Full account required' });
  }
  next();
}

module.exports = { authenticate, optionalAuth, requireUser, JWT_SECRET, generateTokens, revokeRefreshToken, refreshAccessToken, rotateRefreshToken };
