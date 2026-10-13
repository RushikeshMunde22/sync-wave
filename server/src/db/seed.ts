import { getDb } from './database.js';
import { config } from '../config.js';
import { v4 as uuidv4 } from 'uuid';
import argon2 from 'argon2';
import crypto from 'crypto';

export async function seedSuperadmin(): Promise<void> {
  const db = getDb();
  
  // List of designated superadmins guaranteed to have active superadmin access & designated credentials
  const superadmins = [
    {
      email: 'munderushikesh66@gmail.com',
      password: 'Password123!',
      displayName: 'Rushikesh (Superadmin)',
    },
    {
      email: 'admin@syncwave.local',
      password: 'supersecurepassword123',
      displayName: 'Superadmin',
    },
  ];

  if (config.ADMIN_EMAIL && !superadmins.some(s => s.email.toLowerCase() === config.ADMIN_EMAIL.toLowerCase())) {
    superadmins.push({
      email: config.ADMIN_EMAIL,
      password: config.ADMIN_INITIAL_PASSWORD || 'supersecurepassword123',
      displayName: 'Admin',
    });
  }

  if (config.EMAIL_USER && !superadmins.some(s => s.email.toLowerCase() === config.EMAIL_USER!.toLowerCase())) {
    superadmins.push({
      email: config.EMAIL_USER,
      password: 'Password123!',
      displayName: 'Rushikesh (Superadmin)',
    });
  }

  for (const admin of superadmins) {
    const normalizedEmail = admin.email.trim().toLowerCase();
    const existing = db.prepare('SELECT id, role, email FROM users WHERE LOWER(TRIM(email)) = ?').get(normalizedEmail) as { id: string; role: string; email: string } | undefined;
    const pwdHash = await argon2.hash(admin.password);
    const recoveryCode = crypto.randomBytes(16).toString('hex');
    const recoveryCodeHash = await argon2.hash(recoveryCode);

    if (!existing) {
      const id = uuidv4();
      db.prepare(`
        INSERT INTO users (
          id, email, password_hash, display_name, role,
          force_password_change, is_banned, recovery_code_hash
        ) VALUES (?, ?, ?, ?, 'superadmin', 0, 0, ?)
      `).run(id, normalizedEmail, pwdHash, admin.displayName, recoveryCodeHash);
      console.log(`[Seed] Created superadmin account: ${normalizedEmail}`);
    } else {
      // Unconditionally synchronize password_hash, role, and unban so designated login works 100%
      db.prepare(`
        UPDATE users 
        SET password_hash = ?, 
            role = 'superadmin', 
            force_password_change = 0, 
            is_banned = 0 
        WHERE id = ?
      `).run(pwdHash, existing.id);
      console.log(`[Seed] Synchronized superadmin credentials and role for existing account: ${normalizedEmail}`);
    }
  }

  // Ensure all superadmin accounts have force_password_change = 0 and is_banned = 0
  try {
    db.prepare('UPDATE users SET force_password_change = 0, is_banned = 0 WHERE role = ?').run('superadmin');
  } catch (err) {
    console.error('[Seed] Failed to update superadmin flags:', err);
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
}

export const runSeeder = seedSuperadmin;
