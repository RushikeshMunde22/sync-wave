import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';

let transporter: Transporter | null = null;
let transporterVerified = false;

function getTransporter(): Transporter | null {
  if (!transporter) {
    const host = config.SMTP_HOST;
    const port = config.SMTP_PORT;
    const user = config.SMTP_USER || config.EMAIL_USER;
    const rawPass = config.SMTP_PASS || config.EMAIL_PASS;
    // Strip all whitespace from passwords (crucial for Gmail App Passwords copied with spaces)
    const pass = rawPass ? rawPass.replace(/\s+/g, '') : '';
    const secure = config.SMTP_SECURE !== undefined ? config.SMTP_SECURE : (port === 465 || !port);

    if (host && user && pass) {
      // 1. Custom SMTP provider (Brevo, SendGrid, Mailgun, Resend, etc.)
      transporter = nodemailer.createTransport({
        host,
        port: port || (secure ? 465 : 587),
        secure,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 15000,
        tls: { rejectUnauthorized: false },
      });
      console.log(`[Mail] Configured custom SMTP (${host}:${port || (secure ? 465 : 587)}) for:`, user);
    } else if (user && pass) {
      // 2. Direct Gmail SSL over port 465 (most reliable on cloud containers like Render)
      transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 15000,
        tls: { rejectUnauthorized: false },
      });
      console.log('[Mail] Configured direct Gmail SSL (smtp.gmail.com:465) for:', user);
    } else {
      console.warn('[Mail] EMAIL_USER / EMAIL_PASS or SMTP credentials not set. Emails will be logged to console only.');
      return null;
    }

    // Verify connection in background (non-blocking)
    if (!transporterVerified && transporter) {
      transporter.verify().then(() => {
        transporterVerified = true;
        console.log('[Mail] ✅ SMTP connection verified successfully.');
      }).catch((err: any) => {
        console.error('[Mail] ❌ SMTP verification FAILED:', err.message || err);
        console.error('[Mail] Important: For Gmail, an App Password is required (16 characters). Regular Google account passwords will be rejected.');
        console.error('[Mail] Generate one at: https://myaccount.google.com/apppasswords');
        transporter = null;
      });
    }
  }
  return transporter;
}

export async function testSmtpConnection(): Promise<{ success: boolean; message: string; details?: any }> {
  const mailer = getTransporter();
  if (!mailer) {
    return {
      success: false,
      message: 'Email credentials not configured. Please set EMAIL_USER & EMAIL_PASS (or SMTP_HOST/SMTP_USER/SMTP_PASS) in .env or Render.',
    };
  }
  try {
    await mailer.verify();
    return {
      success: true,
      message: 'SMTP connection verified successfully! Emails are ready to deliver.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `SMTP verification failed: ${err.message || 'Unknown error'}. Note: Gmail accounts require a 16-character App Password (https://myaccount.google.com/apppasswords).`,
      details: err.code || err.response || err.message,
    };
  }
}

function getFromAddress(): string {
  if (config.EMAIL_FROM) return config.EMAIL_FROM;
  const user = config.SMTP_USER || config.EMAIL_USER;
  if (user) return `"SyncWave" <${user}>`;
  return '"SyncWave" <noreply@syncwave.work.gd>';
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
      from: getFromAddress(),
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
      from: getFromAddress(),
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

export async function sendFeedbackEmailToOwner({
  userEmail,
  userName,
  content,
}: {
  userEmail: string;
  userName?: string;
  content: string;
}): Promise<boolean> {
  const mailer = getTransporter();
  const ownerEmail = 'munderushikesh66@gmail.com';
  const subject = `[SyncWave User Feedback] from ${userName || userEmail}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #09090b; color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #27272a;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #6366f1; margin: 0; font-size: 26px;">💬 New User Feedback Received</h1>
        <p style="color: #a1a1aa; font-size: 14px; margin-top: 4px;">SyncWave Real-Time Feedback System</p>
      </div>

      <div style="background-color: #18181b; padding: 24px; border-radius: 12px; border: 1px solid #27272a;">
        <div style="margin-bottom: 16px; border-bottom: 1px solid #27272a; padding-bottom: 12px;">
          <p style="margin: 0; color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Submitted By</p>
          <p style="margin: 4px 0 0 0; color: #f4f4f5; font-size: 16px; font-weight: 600;">${userName || 'SyncWave User'} &lt;${userEmail}&gt;</p>
        </div>

        <div>
          <p style="margin: 0 0 8px 0; color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Feedback Message</p>
          <div style="background-color: #09090b; padding: 16px; border-radius: 8px; color: #e4e4e7; font-size: 15px; line-height: 1.6; white-space: pre-wrap; border-left: 4px solid #6366f1;">
${content}
          </div>
        </div>
      </div>

      <div style="text-align: center; margin-top: 24px; color: #71717a; font-size: 12px;">
        <p>Received at ${new Date().toLocaleString()} • SyncWave Production Engine</p>
      </div>
    </div>
  `;

  if (!mailer) {
    console.log(`[Mail Mock] Feedback email to: ${ownerEmail} from: ${userEmail}`);
    return true;
  }

  try {
    await mailer.sendMail({
      from: `"SyncWave Feedback" <${config.EMAIL_USER || 'noreply@syncwave.work.gd'}>`,
      to: ownerEmail,
      replyTo: userEmail,
      subject,
      html,
      text: `SyncWave Feedback from ${userName || userEmail} (${userEmail}):\n\n${content}`,
    });
    console.log('[Mail] Feedback email successfully sent to owner:', ownerEmail);
    return true;
  } catch (err) {
    console.error('[Mail] Failed to send feedback email to owner:', err);
    return false;
  }
}

