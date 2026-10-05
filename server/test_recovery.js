import Database from 'better-sqlite3';
import argon2 from 'argon2';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: 'C:/Users/Asus/OneDrive/Desktop/Sync Wave/.env' });

const db = new Database('C:/Users/Asus/OneDrive/Desktop/Sync Wave/server/data/syncwave.db');
const userEmail = 'munderushikesh66@gmail.com';

async function main() {
  let user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(userEmail);
  if (!user) {
    console.log('[Test] Registering munderushikesh66@gmail.com in SQLite DB...');
    const hash = await argon2.hash('SuperSecurePass123!');
    db.prepare(`
      INSERT INTO users (id, email, password_hash, display_name, avatar_emoji, avatar_color, role, is_banned, created_at, last_seen_at)
      VALUES ('user-rushikesh-001', ?, ?, 'Rushikesh Munde', '🎧', '#6366f1', 'superadmin', 0, datetime('now'), datetime('now'))
    `).run(userEmail, hash);
    console.log('[Test] Account munderushikesh66@gmail.com registered as superadmin!');
  } else {
    console.log('[Test] Account munderushikesh66@gmail.com already exists in DB as role:', user.role);
  }

  const mailUser = process.env.EMAIL_USER;
  const mailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');

  console.log('[Test] Sending email via Nodemailer Gmail SMTP from:', mailUser, 'to:', userEmail);
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: mailUser, pass: mailPass },
  });

  const info = await transporter.sendMail({
    from: `"SyncWave" <${mailUser}>`,
    to: userEmail,
    subject: 'Your SyncWave Password Recovery',
    text: 'Your new temporary password is: Sw!7x9aB2k4\n\nLog in at https://syncwave.work.gd/login',
    html: '<div style="font-family: sans-serif; padding: 24px; background-color: #09090b; color: #ffffff; border-radius: 12px;"><h1 style="color: #6366f1;">🌊 SyncWave</h1><p>Your new temporary password is: <b style="color: #a5b4fc; font-size: 18px;">Sw!7x9aB2k4</b></p><p><a href="https://syncwave.work.gd/login" style="color: #818cf8;">Click here to log in</a></p></div>'
  });

  console.log('✅ DISPATCH SUCCESS! MessageId:', info.messageId, 'Response:', info.response);
  process.exit(0);
}

main().catch(err => {
  console.error('❌ ERROR:', err);
  process.exit(1);
});
