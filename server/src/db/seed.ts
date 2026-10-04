import { getDb } from './database.js';
import { config } from '../config.js';
import { v4 as uuidv4 } from 'uuid';
import argon2 from 'argon2';
import crypto from 'crypto';

export async function runSeeder(): Promise<void> {
  const db = getDb();
  
  const superadminCountResult = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('superadmin') as { count: number };
  
  if (superadminCountResult.count === 0 && config.ADMIN_EMAIL && config.ADMIN_INITIAL_PASSWORD) {
    console.log('[Seed] No superadmin found. Creating initial superadmin...');
    
    try {
      const passwordHash = await argon2.hash(config.ADMIN_INITIAL_PASSWORD);
      const recoveryCode = crypto.randomBytes(16).toString('hex');
      const recoveryCodeHash = await argon2.hash(recoveryCode);
      const adminId = uuidv4();
      
      const insertUser = db.prepare(`
        INSERT INTO users (
          id, email, password_hash, display_name, role,
          force_password_change, recovery_code_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertUser.run(
        adminId,
        config.ADMIN_EMAIL,
        passwordHash,
        'Admin',
        'superadmin',
        1,
        recoveryCodeHash
      );
      
      console.log('[Seed] Superadmin created successfully.');
      console.log(`[Seed] Superadmin Recovery Code: ${recoveryCode} (Save this!)`);
    } catch (error) {
      console.error('[Seed] Failed to create superadmin:', error);
    }
  } else {
    console.log('[Seed] Superadmin already exists or credentials not provided in config.');
  }

  if (config.ENV === 'development' || process.env.NODE_ENV === 'development') {
    const demoUserResult = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@example.com') as { id: string } | undefined;
    if (!demoUserResult) {
      console.log('[Seed] Creating demo user and group...');
      try {
        const demoUserId = uuidv4();
        const demoPassword = await argon2.hash('demo123');
        
        db.prepare(`
          INSERT INTO users (id, email, password_hash, display_name)
          VALUES (?, ?, ?, ?)
        `).run(demoUserId, 'demo@example.com', demoPassword, 'Demo User');

        const demoGroupId = uuidv4();
        const inviteCode = crypto.randomBytes(6).toString('hex');
        
        db.prepare(`
          INSERT INTO groups (id, name, owner_id, invite_code)
          VALUES (?, ?, ?, ?)
        `).run(demoGroupId, 'Demo Group', demoUserId, inviteCode);
        
        db.prepare(`
          INSERT INTO group_members (group_id, user_id, role)
          VALUES (?, ?, ?)
        `).run(demoGroupId, demoUserId, 'owner');
        
        console.log('[Seed] Demo data created.');
      } catch (err) {
        console.error('[Seed] Failed to create demo data:', err);
      }
    }
  }
}
