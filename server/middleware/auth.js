const jwt = require('jsonwebtoken');
const { get } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

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
      const user = await get('SELECT id, email, nickname FROM users WHERE id = ?', [decoded.userId]);
      if (user) {
        req.auth = { type: 'user', id: user.id, token, nickname: user.nickname, email: user.email };
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
      get('SELECT id, email, nickname FROM users WHERE id = ?', [decoded.userId]).then(user => {
        if (user) {
          req.auth = { type: 'user', id: user.id, token, nickname: user.nickname, email: user.email };
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

module.exports = { authenticate, optionalAuth, requireUser, JWT_SECRET };
