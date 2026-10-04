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
  deleteUser, 
  updateProfile,
  checkPasswordStrength,
  rotateSession
} from './auth.service.js';
import { requireAuth } from './auth.middleware.js';
import { config } from '../config.js';

const router = Router();

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many signup attempts, please try again later.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later.' }
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
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

    res.status(201).json({ user, recoveryCode });
  } catch (err: any) {
    res.status(400).json({ error: err.errors || err.message || 'Signup failed' });
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
    res.status(401).json({ error: err.errors || err.message || 'Invalid email or password' });
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
    res.status(400).json({ error: err.errors || err.message || 'Update failed' });
  }
});

router.post('/forgot-password', forgotPasswordLimiter, (req, res) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);
    findUserByEmail(data.email);
    
    // Generic response regardless of whether email exists
    res.json({ message: 'If the email exists, instructions would be sent (or use your existing recovery code to reset)' });
  } catch (err: any) {
    res.status(400).json({ error: err.errors || err.message || 'Invalid request' });
  }
});

router.post('/reset-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    const { newRecoveryCode } = await resetPasswordWithRecovery(data.email, data.recoveryCode, data.newPassword);
    res.json({ recoveryCode: newRecoveryCode });
  } catch (err: any) {
    res.status(400).json({ error: err.errors || err.message || 'Reset failed' });
  }
});

router.delete('/me', requireAuth, (req, res) => {
  deleteUser(req.user!.id);
  res.clearCookie('syncwave_session', { path: '/' });
  res.json({ success: true });
});

router.get('/csrf-token', (_req, res) => {
  res.json({ message: 'Origin-based CSRF protection in use, no token required.' });
});

export { router as authRouter };
export default router;
