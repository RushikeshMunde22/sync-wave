import fs from 'fs';
import path from 'path';
import { getDb } from './database.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations(): void {
  const db = getDb();
  
  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const appliedMigrations = new Set(
    db.prepare('SELECT filename FROM _migrations').all().map((row: any) => row.filename)
  );

  const candidateDirs = [
    path.join(__dirname, 'migrations'),
    path.join(__dirname, '../src/db/migrations'),
    path.join(__dirname, '../../server/src/db/migrations'),
    path.join(process.cwd(), 'server/src/db/migrations'),
    path.join(process.cwd(), 'src/db/migrations'),
    path.join(process.cwd(), 'dist/migrations'),
  ];

  let migrationsDir: string | null = null;
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      migrationsDir = dir;
      break;
    }
  }

  if (!migrationsDir) {
    console.error('[DB] No migrations directory found in candidates:', candidateDirs);
    throw new Error('Migrations directory not found');
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (!appliedMigrations.has(file)) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      console.log(`[DB] Applying migration: ${file}`);
      
      const transaction = db.transaction(() => {
        db.exec(sql);
        const insertStmt = db.prepare('INSERT INTO _migrations (filename) VALUES (?)');
        insertStmt.run(file);
      });
      
      try {
        transaction();
        console.log(`[DB] Successfully applied migration: ${file}`);
      } catch (error) {
        console.error(`[DB] Failed to apply migration: ${file}`, error);
        throw error;
      }
    }
  }
  console.log('[DB] All migrations applied.');
}
