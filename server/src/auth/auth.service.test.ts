import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, closeDb } from '../db/database.js';
import { runMigrations } from '../db/migrator.js';
import {
  hashPassword,
  verifyPassword,
  checkPasswordStrength,
  createUser,
  findUserByEmail,
  verifyLogin,
  createSession,
  validateSession,
  destroySession,
  resetPasswordWithRecovery,
} from './auth.service.js';

describe('Auth Service', () => {
  beforeAll(() => {
    // Ensure migrations have run on the database
    getDb();
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  describe('Password Hashing & Strength', () => {
    it('hashes passwords securely using Argon2id and verifies correctly', async () => {
      const password = 'SuperSecretPassword2026!';
      const hash = await hashPassword(password);
      expect(hash).toContain('$argon2');

      const isValid = await verifyPassword(hash, password);
      expect(isValid).toBe(true);

      const isWrong = await verifyPassword(hash, 'wrongpassword123');
      expect(isWrong).toBe(false);
    });

    it('validates password strength rules', () => {
      expect(checkPasswordStrength('short').ok).toBe(false);
      expect(checkPasswordStrength('1234567890').ok).toBe(false);
      expect(checkPasswordStrength('aaaaaaaaaaaa').ok).toBe(false);
      expect(checkPasswordStrength('StrongP@ssw0rd99!').ok).toBe(true);
    });
  });

  describe('User Creation & Recovery Codes', () => {
    const testEmail = `test_${Date.now()}@syncwave.test`;

    it('creates a new user and generates a 12-char recovery code', async () => {
      const res = await createUser({
        email: testEmail,
        password: 'ValidPassword123!',
        displayName: 'Test Explorer',
        avatarEmoji: '🎧',
        avatarColor: '#4f46e5',
      });

      expect(res.user).toBeDefined();
      expect(res.user.email).toBe(testEmail.toLowerCase());
      expect(res.user.displayName).toBe('Test Explorer');
      expect(res.recoveryCode).toBeDefined();
      expect(res.recoveryCode?.length).toBe(12);

      const found = findUserByEmail(testEmail);
      expect(found).toBeDefined();
      expect(found?.id).toBe(res.user.id);
    });

    it('verifies login credentials successfully', async () => {
      const user = await verifyLogin(testEmail, 'ValidPassword123!');
      expect(user.email).toBe(testEmail.toLowerCase());
    });

    it('rejects invalid password login', async () => {
      await expect(verifyLogin(testEmail, 'WrongPassword123!')).rejects.toThrow();
    });

    it('recovers account with valid recovery code', async () => {
      const { user, recoveryCode } = await createUser({
        email: `recover_${Date.now()}@syncwave.test`,
        password: 'InitialPassword123!',
        displayName: 'Recover Me',
      });

      expect(recoveryCode).toBeDefined();

      const newPassword = 'BrandNewPassword999!';
      const { newRecoveryCode } = await resetPasswordWithRecovery(user.email, recoveryCode!, newPassword);

      expect(newRecoveryCode).toBeDefined();
      expect(newRecoveryCode.length).toBe(12);

      // Verify login with new password
      const loggedIn = await verifyLogin(user.email, newPassword);
      expect(loggedIn.id).toBe(user.id);
    });
  });

  describe('Session Management', () => {
    it('creates, validates, and destroys sessions', async () => {
      const { user } = await createUser({
        email: `session_${Date.now()}@syncwave.test`,
        password: 'SessionPassword123!',
        displayName: 'Session User',
      });

      const sessionId = createSession(user.id);
      expect(sessionId).toBeDefined();

      const validatedUser = validateSession(sessionId);
      expect(validatedUser).toBeDefined();
      expect(validatedUser?.id).toBe(user.id);

      destroySession(sessionId);
      const afterDestroy = validateSession(sessionId);
      expect(afterDestroy).toBeNull();
    });
  });
});
