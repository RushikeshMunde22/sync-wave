import { getDb } from '../db/database.js';
import { randomUUID } from 'crypto';

export function logAudit(
  actorId: string | null,
  action: string,
  target: string | null,
  metadata: any,
  ipHash: string | null = null
): void {
  const db = getDb();
  const id = randomUUID();
  
  db.prepare(`
    INSERT INTO audit_log (id, actor_id, action, target, metadata, ip_hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, actorId, action, target, metadata ? JSON.stringify(metadata) : null, ipHash);
}
