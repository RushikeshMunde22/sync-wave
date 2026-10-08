import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { 
  signupSchema, 
  loginSchema, 
  forgotPasswordSchema, 
  resetPasswordSchema, 
  updateProfileSchema 
} from './auth.schemas.js';
import { 
  createUser, 
  verifyLogin, 
  createSession, 
  destroySession, 
  findUserByEmail, 
  resetPasswordWithRecovery, 
  resetPasswordByEmail,
  deleteUser, 
  updateProfile,
  checkPasswordStrength,
  rotateSession
} from './auth.service.js';
import { requireAuth } from './auth.middleware.js';
import { sendPasswordRecoveryEmail, sendWelcomeEmail } from '../mail/mail.service.js';
import { config } from '../config.js';

const router = Router();

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: 'Too many signup attempts, please try again later.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: 'Too many login attempts, please try again later.' }
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  validate: { trustProxy: false, xForwardedForHeader: false },
  message: { error: 'Too many password reset attempts, please try again later.' }
});

const cookieOptions = {
  httpOnly: true,
  secure: config.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  signed: true,
  path: '/',
};

function formatErrorMessage(err: any, fallback: string): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (Array.isArray(err)) {
    return err.map((e: any) => (typeof e === 'string' ? e : e?.message || JSON.stringify(e))).join(', ');
  }
  if (err.errors && Array.isArray(err.errors)) {
    return err.errors.map((e: any) => e.message || 'Invalid input').join(', ');
  }
  if (err.issues && Array.isArray(err.issues)) {
    return err.issues.map((e: any) => e.message || 'Invalid input').join(', ');
  }
  if (err.message && typeof err.message === 'string' && err.message !== '[object Object]') {
    return err.message;
  }
  return fallback;
}

router.post(['/signup', '/register'], signupLimiter, async (req, res) => {
  try {
    if (config.SIGNUPS_DISABLED) {
      return res.status(403).json({ error: 'Signups are currently disabled' });
    }

    const data = signupSchema.parse(req.body);

    const existingUser = findUserByEmail(data.email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const strength = checkPasswordStrength(data.password);
    if (!strength.ok) {
      return res.status(400).json({ error: strength.reason });
    }

    const { user, recoveryCode } = await createUser({
      email: data.email,
      password: data.password,
      displayName: data.displayName,
      avatarEmoji: data.avatarEmoji,
      avatarColor: data.avatarColor,
    });

    const userAgent = req.headers['user-agent'] || 'unknown';
    const sessionId = createSession(user.id, userAgent);
    
    res.cookie('syncwave_session', sessionId, cookieOptions);

    // Non-blocking welcome email dispatch
    sendWelcomeEmail(user.email, user.displayName).catch((e) => console.error('[Mail] Welcome error:', e));

    res.status(201).json({ user, recoveryCode });
  } catch (err: any) {
    res.status(400).json({ error: formatErrorMessage(err, 'Signup failed') });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    
    const user = await verifyLogin(data.email, data.password);
    if (user.isBanned) {
      return res.status(403).json({ error: 'Account is banned' });
    }

    const userAgent = req.headers['user-agent'] || 'unknown';
    const oldSessionId = req.signedCookies['syncwave_session'];
    let sessionId: string;
    
    if (oldSessionId) {
      try {
        sessionId = rotateSession(oldSessionId, userAgent);
      } catch (err) {
        sessionId = createSession(user.id, userAgent);
      }
    } else {
      sessionId = createSession(user.id, userAgent);
    }
    
    res.cookie('syncwave_session', sessionId, cookieOptions);
    res.json({ user });
  } catch (err: any) {
    res.status(401).json({ error: formatErrorMessage(err, 'Invalid email or password') });
  }
});

router.post('/logout', (req, res) => {
  const sessionId = req.signedCookies['syncwave_session'];
  if (sessionId) {
    destroySession(sessionId);
  }
  res.clearCookie('syncwave_session', { path: '/' });
  res.json({ success: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.put('/me', requireAuth, (req, res) => {
  try {
    const data = updateProfileSchema.parse(req.body);
    updateProfile(req.user!.id, data);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: formatErrorMessage(err, 'Update failed') });
  }
});

router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);
    console.log('[Auth] Forgot password requested for:', data.email);
    const resetResult = await resetPasswordByEmail(data.email);
    if (resetResult) {
      console.log('[Auth] Resetting password and dispatching email to:', resetResult.user.email);
      await sendPasswordRecoveryEmail(resetResult.user.email, resetResult.tempPassword, true);
    } else {
      console.log('[Auth] No registered user found for email:', data.email, '- Email dispatch skipped.');
    }
    
    res.json({
      success: true,
      message: 'If an account exists with this email, a temporary password has been sent to your registered email address.'
    });
  } catch (err: any) {
    res.status(400).json({ error: formatErrorMessage(err, 'Invalid request or email format') });
  }
});

router.post('/reset-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    const { newRecoveryCode } = await resetPasswordWithRecovery(data.email, data.recoveryCode, data.newPassword);
    res.json({ recoveryCode: newRecoveryCode });
  } catch (err: any) {
    res.status(400).json({ error: formatErrorMessage(err, 'Reset failed') });
  }
});

router.delete('/me', requireAuth, (req, res) => {
  deleteUser(req.user!.id);
  res.clearCookie('syncwave_session', { path: '/' });
  res.json({ success: true });
});

router.get('/config', (_req, res) => {
  res.json({
    googleClientId: config.GOOGLE_CLIENT_ID || null,
    signupsDisabled: config.SIGNUPS_DISABLED,
  });
});

router.post('/google', loginLimiter, async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ error: 'Google credential token is required' });
    }

    // Verify Google ID token via Google's tokeninfo endpoint
    const googleVerifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const googleRes = await fetch(googleVerifyUrl);

    if (!googleRes.ok) {
      return res.status(401).json({ error: 'Invalid Google authentication credential' });
    }

    const payload: any = await googleRes.json();
    const email = payload.email?.toLowerCase();
    const emailVerified = payload.email_verified === 'true' || payload.email_verified === true;
    const name = payload.name || payload.given_name || email?.split('@')[0] || 'SyncWave User';

    if (!email || !emailVerified) {
      return res.status(401).json({ error: 'Google account email is not verified' });
    }

    // Validate audience if GOOGLE_CLIENT_ID is configured
    if (config.GOOGLE_CLIENT_ID && payload.aud !== config.GOOGLE_CLIENT_ID) {
      console.warn('[Auth] Google token audience mismatch:', payload.aud, 'expected:', config.GOOGLE_CLIENT_ID);
      return res.status(401).json({ error: 'Google client ID mismatch' });
    }

    // Find existing user or create a new user
    let user = findUserByEmail(email);
    let isNewUser = false;

    if (!user) {
      if (config.SIGNUPS_DISABLED) {
        return res.status(403).json({ error: 'New user registrations are currently disabled' });
      }

      const created = await createUser({
        email,
        displayName: name,
        avatarEmoji: '⚡',
        avatarColor: '#6366f1',
      });
      user = created.user;
      isNewUser = true;

      // Dispatch welcome email
      sendWelcomeEmail(user.email, user.displayName).catch((e) => console.error('[Mail] Welcome error:', e));
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'Account is banned' });
    }

    const userAgent = req.headers['user-agent'] || 'unknown';
    const oldSessionId = req.signedCookies['syncwave_session'];
    let sessionId: string;

    if (oldSessionId) {
      try {
        sessionId = rotateSession(oldSessionId, userAgent);
      } catch {
        sessionId = createSession(user.id, userAgent);
      }
    } else {
      sessionId = createSession(user.id, userAgent);
    }

    res.cookie('syncwave_session', sessionId, cookieOptions);
    res.json({ user, isNewUser });
  } catch (err: any) {
    console.error('[Auth] Google sign-in error:', err);
    res.status(500).json({ error: 'Failed to process Google sign-in' });
  }
});

router.get('/csrf-token', (_req, res) => {
  res.json({ message: 'Origin-based CSRF protection in use, no token required.' });
});

export { router as authRouter };
export default router;
