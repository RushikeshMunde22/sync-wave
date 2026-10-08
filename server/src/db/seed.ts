import { getDb } from './database.js';
import { config } from '../config.js';
import { v4 as uuidv4 } from 'uuid';
import argon2 from 'argon2';
import crypto from 'crypto';

export async function seedSuperadmin(): Promise<void> {
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
        0,
        recoveryCodeHash
      );
      
      console.log('[Seed] Superadmin created successfully.');
      console.log(`[Seed] Superadmin Recovery Code: ${recoveryCode} (Save this!)`);
    } catch (error) {
      console.error('[Seed] Failed to create superadmin:', error);
    }
  } else {
    // Ensure existing superadmin has force_password_change = 0
    try {
      db.prepare('UPDATE users SET force_password_change = 0 WHERE role = ?').run('superadmin');
    } catch {}
    console.log('[Seed] Superadmin already exists or credentials not provided in config.');
  }

  if (config.NODE_ENV === 'development' || process.env.NODE_ENV === 'development') {
    const demoUserResult = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@example.com') as { id: string } | undefined;
    if (!demoUserResult) {
      console.log('[Seed] Creating demo user and group...');
      try {
        const demoUserId = uuidv4();
        const demoPassword = await argon2.hash('demo123456');
        
        db.prepare(`
          INSERT INTO users (id, email, password_hash, display_name)
          VALUES (?, ?, ?, ?)
        `).run(demoUserId, 'demo@example.com', demoPassword, 'Demo User');

        const demoGroupId = uuidv4();
        const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const inviteCode = Array.from(crypto.randomBytes(10)).map(b => ALPHABET[b % ALPHABET.length]).join('');
        
        db.prepare(`
          INSERT INTO groups (id, name, owner_id, invite_code)
          VALUES (?, ?, ?, ?)
        `).run(demoGroupId, 'Demo Group', demoUserId, inviteCode);
        
        db.prepare(`
          INSERT INTO group_members (group_id, user_id, role)
          VALUES (?, ?, ?)
        `).run(demoGroupId, demoUserId, 'owner');

        db.prepare(`
          INSERT INTO playback_state (group_id, is_playing, position_ms, updated_at_server_ms, version)
          VALUES (?, 0, 0, ?, 0)
        `).run(demoGroupId, Date.now());
        
        console.log('[Seed] Demo data created.');
      } catch (err) {
        console.error('[Seed] Failed to create demo data:', err);
      }
    }
  }

  // Ensure munderushikesh66@gmail.com and config.EMAIL_USER have active superadmin accounts
  const superadminEmails = Array.from(new Set(['munderushikesh66@gmail.com', config.EMAIL_USER].filter(Boolean) as string[]));
  for (const adminMail of superadminEmails) {
    const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(adminMail) as { id: string; role: string } | undefined;
    if (!existing) {
      console.log(`[Seed] Creating superadmin account for ${adminMail}...`);
      try {
        const id = uuidv4();
        const pwdHash = await argon2.hash('Password123!');
        const recoveryCode = crypto.randomBytes(16).toString('hex');
        const recoveryCodeHash = await argon2.hash(recoveryCode);
        db.prepare(`
          INSERT INTO users (id, email, password_hash, display_name, role, force_password_change, recovery_code_hash)
          VALUES (?, ?, ?, ?, 'superadmin', 0, ?)
        `).run(id, adminMail, pwdHash, 'Rushikesh (Superadmin)', recoveryCodeHash);
        console.log(`[Seed] Account created for ${adminMail} with password: Password123!`);
      } catch (err) {
        console.error(`[Seed] Failed to create ${adminMail} account:`, err);
      }
    } else if (existing.role !== 'superadmin') {
      db.prepare('UPDATE users SET role = "superadmin", force_password_change = 0 WHERE id = ?').run(existing.id);
      console.log(`[Seed] Promoted existing account ${adminMail} to superadmin.`);
    } else {
      db.prepare('UPDATE users SET force_password_change = 0 WHERE id = ?').run(existing.id);
    }
  }
}

export const runSeeder = seedSuperadmin;
