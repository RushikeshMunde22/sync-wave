import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';

let transporter: Transporter | null = null;
let transporterVerified = false;

function getTransporter(): Transporter | null {
  if (!transporter) {
    const user = config.EMAIL_USER;
    const rawPass = config.EMAIL_PASS;
    // Gmail App Passwords have spaces (e.g. "qstw eemt rqxd ltsj") — strip them
    const pass = rawPass ? rawPass.replace(/\s+/g, '') : '';

    if (user && pass) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      });
      console.log('[Mail] Nodemailer configured with Gmail SMTP for:', user);

      // Verify connection in background (non-blocking)
      if (!transporterVerified) {
        transporter.verify().then(() => {
          transporterVerified = true;
          console.log('[Mail] SMTP connection verified successfully.');
        }).catch((err: any) => {
          console.error('[Mail] SMTP verification FAILED:', err.message || err);
          console.error('[Mail] Emails will NOT be delivered. Check EMAIL_USER/EMAIL_PASS in .env');
          // Reset so we retry on next send
          transporter = null;
        });
      }
    } else {
      console.warn('[Mail] EMAIL_USER or EMAIL_PASS not set. Emails will be logged to console only.');
    }
  }
  return transporter;
}

export async function sendPasswordRecoveryEmail(
  toEmail: string,
  newPasswordOrCode: string,
  isTemporaryPassword = true
): Promise<boolean> {
  const mailer = getTransporter();
  const domain = config.BASE_URL || 'https://syncwave.work.gd';
  const loginUrl = `${domain}/login`;

  const subject = 'Your SyncWave Password Recovery';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #09090b; color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #27272a;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #6366f1; margin: 0; font-size: 28px; letter-spacing: -0.5px;">🌊 SyncWave</h1>
        <p style="color: #a1a1aa; font-size: 14px; margin-top: 4px;">Listen Together, In Sync</p>
      </div>

      <div style="background-color: #18181b; padding: 24px; border-radius: 12px; border: 1px solid #27272a;">
        <h2 style="font-size: 18px; color: #f4f4f5; margin-top: 0;">Password Recovery Request</h2>
        <p style="color: #d4d4d8; font-size: 15px; line-height: 1.6;">
          ${
            isTemporaryPassword
              ? 'We received a request to recover your SyncWave account password. Your new temporary password is:'
              : 'Your account recovery authorization code is:'
          }
        </p>

        <div style="background-color: #27272a; padding: 16px; border-radius: 8px; text-align: center; font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #a5b4fc; margin: 20px 0; font-family: monospace;">
          ${newPasswordOrCode}
        </div>

        <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6;">
          You can now log in at <a href="${loginUrl}" style="color: #818cf8; text-decoration: underline;">${loginUrl}</a>. We recommend updating your password in your profile settings right after logging in.
        </p>

        <div style="margin-top: 24px; text-align: center;">
          <a href="${loginUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 14px;">Log In to SyncWave</a>
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px; color: #71717a; font-size: 12px;">
        <p>If you did not request this recovery, please verify your account security immediately.</p>
        <p>© ${new Date().getFullYear()} SyncWave • <a href="${domain}" style="color: #71717a;">${domain}</a></p>
      </div>
    </div>
  `;

  const text = `SyncWave Password Recovery\n\nYour new temporary password is: ${newPasswordOrCode}\n\nLog in at: ${loginUrl}\n\nIf you did not request this, please change your password immediately.`;

  if (!mailer) {
    console.log(`[Mail Mock] To: ${toEmail} | Subject: ${subject} | Code: ${newPasswordOrCode}`);
    return true;
  }

  try {
    const info = await mailer.sendMail({
      from: `"SyncWave" <${config.EMAIL_USER}>`,
      to: toEmail,
      subject,
      text,
      html,
    });
    console.log('[Mail] Password recovery email sent:', info.messageId, 'to:', toEmail);
    return true;
  } catch (error) {
    console.error('[Mail] Failed to send password recovery email:', error);
    return false;
  }
}

export async function sendWelcomeEmail(toEmail: string, displayName: string): Promise<boolean> {
  const mailer = getTransporter();
  const domain = config.BASE_URL || 'https://syncwave.work.gd';

  const subject = 'Welcome to SyncWave - Real-Time Listening Rooms 🎵';
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #09090b; color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #27272a;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #6366f1; margin: 0; font-size: 28px;">🌊 SyncWave</h1>
        <p style="color: #a1a1aa; font-size: 14px; margin-top: 4px;">Listen Together, In Sync</p>
      </div>

      <div style="background-color: #18181b; padding: 24px; border-radius: 12px; border: 1px solid #27272a;">
        <h2 style="font-size: 20px; color: #f4f4f5; margin-top: 0;">Welcome, ${displayName}!</h2>
        <p style="color: #d4d4d8; font-size: 15px; line-height: 1.6;">
          Your SyncWave account is ready. You can now create synchronized listening rooms, invite friends with a single link, and discover millions of tracks streaming live.
        </p>

        <div style="margin-top: 24px; text-align: center;">
          <a href="${domain}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 14px;">Open SyncWave Dashboard</a>
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px; color: #71717a; font-size: 12px;">
        <p>© ${new Date().getFullYear()} SyncWave • <a href="${domain}" style="color: #71717a;">${domain}</a></p>
      </div>
    </div>
  `;

  if (!mailer) {
    console.log(`[Mail Mock] Welcome email to: ${toEmail}`);
    return true;
  }

  try {
    await mailer.sendMail({
      from: `"SyncWave" <${config.EMAIL_USER}>`,
      to: toEmail,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error('[Mail] Failed to send welcome email:', err);
    return false;
  }
}
