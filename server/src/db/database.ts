import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

let db: DatabaseType | null = null;

export function initializeDatabase(): void {
  getDb();
}

export function getDb(): DatabaseType {
  if (!db) {
    const dataDir = config.DATA_DIR;
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'syncwave.db');
    console.log(`[DB] Connecting to database at ${dbPath}`);

    db = new Database(dbPath, {
      timeout: 5000,
    });

    // Performance and safety pragmas
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('cache_size = -64000');
    db.pragma('temp_store = MEMORY');

    console.log('[DB] Database connected and configured (WAL mode, FK ON).');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    console.log('[DB] Closing database connection.');
    db.close();
    db = null;
  }
}
