import { getDb } from './database.js';
import { config } from '../config.js';
import path from 'path';
import fs from 'fs';
import { CronJob } from 'cron';

export function runBackup(): void {
  const db = getDb();
  const dataDir = config.DATA_DIR || path.join(process.cwd(), 'data');
  const backupDir = path.join(dataDir, 'backups');
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `syncwave-backup-${timestamp}.db`);

  console.log(`[Backup] Starting backup to ${backupPath}`);
  try {
    db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
    console.log(`[Backup] Backup completed successfully.`);
    
    // Clean up old backups (keep last 7)
    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('syncwave-backup-') && f.endsWith('.db'))
      .sort(); // Sorting by timestamp since ISO strings sort alphabetically

    if (backups.length > 7) {
      const toDelete = backups.slice(0, backups.length - 7);
      for (const oldBackup of toDelete) {
        const oldBackupPath = path.join(backupDir, oldBackup);
        fs.unlinkSync(oldBackupPath);
        console.log(`[Backup] Deleted old backup: ${oldBackup}`);
      }
    }
  } catch (error) {
    console.error('[Backup] Backup failed:', error);
    throw error;
  }
}

export function scheduleBackups(): void {
  console.log('[Backup] Scheduling nightly backups (cron 0 2 * * *)');
  const job = new CronJob('0 2 * * *', () => {
    try {
      runBackup();
    } catch (err) {
      console.error('[Backup] Scheduled backup encountered an error.', err);
    }
  });
  job.start();
}
