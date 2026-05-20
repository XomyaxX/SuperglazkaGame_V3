import sqlite3 from 'sqlite3';
import path from 'path';

const DB_PATH = path.resolve(__dirname, '..', 'data', 'superglazka.db').replace(/\\/g, '/');

export const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

export function run(sql: string, params: unknown[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function get<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T);
    });
  });
}

export function all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export async function init() {
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

  // Migration: add confirm_token to existing subscriptions table
  try {
    const subColumns = await all<{ name: string }>("PRAGMA table_info(subscriptions)");
    const hasToken = subColumns.some(c => c.name === 'confirm_token');
    if (!hasToken) {
      await run(`ALTER TABLE subscriptions ADD COLUMN confirm_token TEXT`);
      console.log('Migration applied: added confirm_token to subscriptions');
    }
  } catch (migErr) {
    console.warn('Migration check skipped:', (migErr as Error).message);
  }

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
      dialogue_audio_json TEXT,
      background_image TEXT,
      background_video TEXT,
      audio_src TEXT,
      mood TEXT,
      game_type TEXT,
      choices_json TEXT,
      transition_text TEXT,
      video_prompt TEXT,
      available_games_json TEXT,
      bg_gradient TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
    )
  `);

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

  // Migrations for frames
  try {
    const frameColumns = await all<{ name: string }>("PRAGMA table_info(frames)");
    const colNames = frameColumns.map(c => c.name);
    const migrations = [
      { col: 'audio_src', sql: `ALTER TABLE frames ADD COLUMN audio_src TEXT` },
      { col: 'transition_text', sql: `ALTER TABLE frames ADD COLUMN transition_text TEXT` },
      { col: 'dialogue_audio_json', sql: `ALTER TABLE frames ADD COLUMN dialogue_audio_json TEXT` },
      { col: 'video_prompt', sql: `ALTER TABLE frames ADD COLUMN video_prompt TEXT` },
      { col: 'available_games_json', sql: `ALTER TABLE frames ADD COLUMN available_games_json TEXT` },
      { col: 'bg_gradient', sql: `ALTER TABLE frames ADD COLUMN bg_gradient TEXT` },
    ];
    for (const m of migrations) {
      if (!colNames.includes(m.col)) {
        await run(m.sql);
        console.log(`Migration applied: added ${m.col} to frames`);
      }
    }
  } catch (migErr) {
    console.warn('Frames migration check skipped:', (migErr as Error).message);
  }

  await run(`CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_progress_guest ON progress(guest_token)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_coins_user ON coins(user_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_coins_guest ON coins(guest_token)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_frames_episode ON frames(episode_id)`);

  console.log('Database initialized.');
}
