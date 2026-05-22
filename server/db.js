const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.resolve(__dirname, 'data', 'superglazka.db').replace(/\\/g, '/');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function init() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      nickname TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      nickname TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      guest_token TEXT,
      episode_id TEXT NOT NULL,
      max_frame INTEGER DEFAULT -1,
      completed INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS coins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      guest_token TEXT,
      amount INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      confirmed INTEGER DEFAULT 0,
      confirm_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      cover_image TEXT,
      "order" INTEGER DEFAULT 0,
      is_published INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS frames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      episode_id INTEGER NOT NULL,
      "order" INTEGER DEFAULT 0,
      title TEXT,
      narration TEXT,
      dialogue_json TEXT,
      background_image TEXT,
      background_video TEXT,
      mood TEXT,
      game_type TEXT,
      choices_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    )
  `);

  // Migration: add confirm_token to existing subscriptions table
  try {
    const subColumns = await all("PRAGMA table_info(subscriptions)");
    const hasToken = subColumns.some(c => c.name === 'confirm_token');
    if (!hasToken) {
      await run(`ALTER TABLE subscriptions ADD COLUMN confirm_token TEXT`);
      console.log('Migration applied: added confirm_token to subscriptions');
    }
  } catch (migErr) {
    console.warn('Migration check skipped:', migErr.message);
  }

  // Migration: add missing columns to frames table
  try {
    const frameColumns = await all("PRAGMA table_info(frames)");
    const colNames = frameColumns.map(c => c.name);
    if (!colNames.includes('audio_src')) {
      await run(`ALTER TABLE frames ADD COLUMN audio_src TEXT`);
      console.log('Migration applied: added audio_src to frames');
    }
    if (!colNames.includes('transition_text')) {
      await run(`ALTER TABLE frames ADD COLUMN transition_text TEXT`);
      console.log('Migration applied: added transition_text to frames');
    }
    if (!colNames.includes('dialogue_audio_json')) {
      await run(`ALTER TABLE frames ADD COLUMN dialogue_audio_json TEXT`);
      console.log('Migration applied: added dialogue_audio_json to frames');
    }
    if (!colNames.includes('video_prompt')) {
      await run(`ALTER TABLE frames ADD COLUMN video_prompt TEXT`);
      console.log('Migration applied: added video_prompt to frames');
    }
    if (!colNames.includes('available_games_json')) {
      await run(`ALTER TABLE frames ADD COLUMN available_games_json TEXT`);
      console.log('Migration applied: added available_games_json to frames');
    }
    if (!colNames.includes('bg_gradient')) {
      await run(`ALTER TABLE frames ADD COLUMN bg_gradient TEXT`);
      console.log('Migration applied: added bg_gradient to frames');
    }
  } catch (migErr) {
    console.warn('Frames migration check skipped:', migErr.message);
  }

  // Migration: add book_num to episodes table
  try {
    const epColumns = await all("PRAGMA table_info(episodes)");
    const epColNames = epColumns.map(c => c.name);
    if (!epColNames.includes('book_num')) {
      await run(`ALTER TABLE episodes ADD COLUMN book_num INTEGER DEFAULT 1`);
      console.log('Migration applied: added book_num to episodes');
    }
  } catch (migErr) {
    console.warn('Episodes migration check skipped:', migErr.message);
  }

  await run(`
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT,
      mime_type TEXT,
      size INTEGER,
      path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_progress_guest ON progress(guest_token)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_coins_user ON coins(user_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_coins_guest ON coins(guest_token)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_frames_episode ON frames(episode_id)`);

  console.log('Database initialized.');
}

module.exports = { db, run, get, all, init };
