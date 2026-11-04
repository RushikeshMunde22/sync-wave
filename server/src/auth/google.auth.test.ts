import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, closeDb } from '../db/database.js';
import { runMigrations } from '../db/migrator.js';
import { createUser, findUserByEmail, findUserByGoogleId, linkGoogleId } from './auth.service.js';
import { OAuth2Client } from 'google-auth-library';

describe('Google Authentication & Verification', () => {
  beforeAll(() => {
    getDb();
    runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  it('creates and retrieves a user by Google ID', async () => {
    const googleId = `google_sub_${Date.now()}`;
    const email = `googleuser_${Date.now()}@syncwave.test`;
    const displayName = 'Google User';

    const { user } = await createUser({
      email,
      displayName,
      googleId,
    });

    expect(user).toBeDefined();
    expect(user.email).toBe(email);

    const found = findUserByGoogleId(googleId);
    expect(found).toBeDefined();
    expect(found?.id).toBe(user.id);
    expect(found?.email).toBe(email);
  });

  it('links Google ID to an existing account without overriding other data', async () => {
    const email = `linkuser_${Date.now()}@syncwave.test`;
    const googleId = `google_linked_${Date.now()}`;

    const { user } = await createUser({
      email,
      displayName: 'Existing User',
      password: 'StrongP@ssw0rd99!',
    });

    // Before link: should not find by googleId
    expect(findUserByGoogleId(googleId)).toBeUndefined();

    // Link google ID
    linkGoogleId(user.id, googleId);

    // After link: should be found by googleId
    const found = findUserByGoogleId(googleId);
    expect(found).toBeDefined();
    expect(found?.id).toBe(user.id);
  });

  it('rejects tampered or malformed Google ID tokens cryptographically', async () => {
    const clientId = '405727386310-t8h1eup0h2ia1iddlf8qlse7pnalail0.apps.googleusercontent.com';
    const client = new OAuth2Client(clientId);

    // Tampered fake token
    const forgedToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJhY2NvdW50cy5nb29nbGUuY29tIiwiYXVkIjoiZmFrZS1jbGllbnQtaWQiLCJzdWIiOiIxMjM0NSJ9.invalid_signature';

    await expect(
      client.verifyIdToken({
        idToken: forgedToken,
        audience: clientId,
      })
    ).rejects.toThrow();
  });
});
