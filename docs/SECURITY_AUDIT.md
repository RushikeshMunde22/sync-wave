# SyncWave Security Audit & OWASP Top 10 Compliance

This document details the security posture, defensive architecture, cryptographic choices, and OWASP Top 10 mitigation verification for **SyncWave**.

---

## Security Architecture Summary

SyncWave adheres to a **defense-in-depth**, **deny-by-default** security model. Because the application handles user credentials and persistent group states, security controls are implemented at the HTTP perimeter, the real-time WebSocket protocol layer, the application service layer, and the database persistence layer.

---

## 1. Authentication & Credential Management

### Argon2id Password Hashing
- **Algorithm**: `argon2id` (the winner of the Password Hashing Competition, combining memory-hardness and side-channel resistance).
- **Configuration**: OWASP-recommended parameters (time cost: 3, memory cost: 64MB, parallelism: 1).
- **Strength Validation**: Enforced via `checkPasswordStrength()`:
  - Minimum 10 characters.
  - Rejection of uniform repeated characters (e.g., `aaaaaaaaaa`).
  - Dictionary check against common patterns (`1234567890`, `password123`, `qwertyuiop`).

### Constant-Time Comparisons
- Verification of recovery codes and hash comparisons use fixed-time operations to prevent timing side-channel attacks:
  ```typescript
  // Hash comparison resistant to timing analysis
  const valid = crypto.timingSafeEqual(
    Buffer.from(computedHash, 'hex'),
    Buffer.from(storedHash, 'hex')
  );
  ```

### Session Lifecycle & Cryptographic Identifiers
- **Session ID Entropy**: Generated using 256 bits of cryptographically secure pseudorandom data:
  ```typescript
  const sessionId = crypto.randomBytes(32).toString('hex');
  ```
- **Cookie Delivery**:
  - `HttpOnly`: Prevents access from client-side JavaScript, mitigating XSS session theft.
  - `Secure`: Mandatory in production, ensuring cookies are transmitted strictly over TLS/HTTPS.
  - `SameSite=Lax`: Prevents third-party sites from sending session cookies on cross-site requests.
  - `Signed`: Signed with HMAC-SHA256 using `SESSION_SECRET` to prevent cookie tampering.
- **Session Rotation & Revocation**:
  - `rotateSession()`: Generates a fresh session ID upon privilege changes or authentication events.
  - `destroyAllUserSessions()`: Explicitly revokes all active user sessions on password resets.
  - Absolute session expiration enforced at 30 days (`expires_at`), with background cleanup routines.

### Multi-Tier Rate Limiting
SyncWave prevents automated brute-force attacks across both HTTP and WebSocket interfaces:
- **Express API Rate Limiter**: 500 requests per 15 minutes per IP address.
- **Authentication Limiter**: 5 login attempts per 15 minutes per IP address.
- **Socket.IO Event Limiter**:
  - Reactions: Maximum 5 reactions per second, 30 per minute per user.
  - Playback Actions: Maximum 2 seek/play/pause events per second per user.

---

## 2. Authorization & Access Control

### Deny-by-Default Architecture
- Unauthenticated requests to protected endpoints are rejected with `401 Unauthorized` before reaching route controllers.
- Route-level middleware (`requireAuth`, `requireRole('superadmin')`) explicitly gates administrative actions.

### Insecure Direct Object Reference (IDOR) Prevention
- In room and playlist management (`groups/group.service.ts`), every mutation validates that the authenticated `req.user.id` is either the **room owner** or has an explicit **admin role** within the target group.
- Group membership is validated before permitting access to room states or allowing queue modifications:
  ```typescript
  // IDOR check in group middleware
  const membership = getGroupMembership(groupId, user.id);
  if (!membership) {
    return res.status(403).json({ error: 'You are not a member of this group' });
  }
  ```
- Member-level permission flags (`members_can_control`) are strictly validated on the server before standard members can emit global play/pause/seek events.

---

## 3. Input Validation: Zod Everywhere

To eliminate injection attacks, parameter pollution, and schema bypasses, **all user inputs are validated at runtime using strict Zod schemas**.

### HTTP Endpoints
Every route parses and validates `req.body`, `req.query`, and `req.params`:
```typescript
export const signupSchema = z.object({
  email: z.string().email().max(255).toLowerCase().trim(),
  password: z.string().min(10).max(128),
  displayName: z.string().min(2).max(32).trim(),
  avatarEmoji: z.string().max(8).optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
```

### Real-Time WebSocket Payloads
Socket events undergo packet-level schema validation via `validateSocketPayload()` before processing by the `SyncEngine`:
```typescript
const seekSchema = z.object({
  groupId: z.string().uuid(),
  positionMs: z.number().min(0).max(86400000), // Max 24 hours
});

const reactionSchema = z.object({
  groupId: z.string().uuid(),
  emoji: z.string(),
});
```
Payloads with unknown or malformed properties are dropped, preventing prototype pollution or unexpected runtime errors.

---

## 4. Injection Prevention

### Parameterized SQL Only
- **Zero Raw Concatenation**: SyncWave interacts with SQLite exclusively through `better-sqlite3` prepared statements.
- Every query utilizes positional parameter binding (`?`), completely neutralising SQL injection:
  ```typescript
  // CORRECT - Parameterized query
  const stmt = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)');
  const user = stmt.get(email);

  // Strictly prohibited in codebase:
  // db.exec(`SELECT * FROM users WHERE email = '${email}'`);
  ```
- Dynamic schema elements (such as `_migrations` filename logging) use strict internal file list lookups, avoiding user-controlled parameters.

---

## 5. Cross-Site Scripting (XSS) Prevention

### React DOM Auto-Encoding
- The user interface is built exclusively with React JSX, which automatically encodes strings before rendering into the DOM, preventing script injection.
- **Zero `dangerouslySetInnerHTML`**: The client codebase contains zero occurrences of raw HTML injection.

### Strict Content Security Policy (CSP)
SyncWave enforces a locked-down Content Security Policy via Helmet:
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"], // No 'unsafe-inline' or 'unsafe-eval'
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
      mediaSrc: ["'self'", 'https:', 'blob:'],
      connectSrc: [
        "'self'", 
        'wss:', 
        'ws:', 
        'https://discoveryprovider.audius.co', 
        'https://api.jamendo.com'
      ],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"], // Prevents Clickjacking
    },
  },
}));
```

---

## 6. Cross-Site Request Forgery (CSRF) Prevention

SyncWave combines **SameSite Cookie Policies** with **Strict Origin Verification**:
1. All session cookies are configured with `SameSite=Lax` (or `SameSite=Strict`), blocking cross-site form submission cookies in modern browsers.
2. The `csrfProtection` middleware inspects the `Origin` and `Referer` headers on all state-altering HTTP methods (`POST`, `PUT`, `DELETE`, `PATCH`):
   ```typescript
   export function csrfProtection(req: Request, res: Response, next: NextFunction) {
     const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
     if (safeMethods.includes(req.method)) return next();

     const origin = req.headers.origin || req.headers.referer;
     if (!origin) {
       return res.status(403).json({ error: 'CSRF validation failed: missing origin' });
     }

     const normalizedOrigin = new URL(origin).origin;
     const normalizedBase = new URL(config.BASE_URL).origin;

     if (normalizedOrigin !== normalizedBase) {
       return res.status(403).json({ error: 'CSRF validation failed: origin mismatch' });
     }

     next();
   }
   ```

---

## 7. HTTP Security Headers (Helmet Configuration)

The following headers are attached to every HTTP response:

| Header | Configured Value | Security Purpose |
| :--- | :--- | :--- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS communication and prevents SSL stripping attacks. |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-type confusion attacks. |
| `X-Frame-Options` | `DENY` | Prevents the application from being loaded in an `<iframe>` (Clickjacking). |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Protects privacy by omitting sensitive query parameters in referrers. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates browsing context against Spectre-style cross-origin leaks. |
| `X-DNS-Prefetch-Control` | `off` | Prevents prefetching of external DNS links. |

---

## 8. OWASP Top 10 Compliance Verification

| OWASP Risk Category | Status | Verified Implementation |
| :--- | :---: | :--- |
| **A01: Broken Access Control** | **PASS** | Role-based middleware, group ownership checks, IDOR verification on all room mutations. |
| **A02: Cryptographic Failures** | **PASS** | Argon2id for passwords, SHA-256 for recovery hashes, HSTS enforced, 256-bit session tokens. |
| **A03: Injection** | **PASS** | 100% parameterized SQLite statements via `better-sqlite3`; zero raw string queries. |
| **A04: Insecure Design** | **PASS** | Threat-modeled architecture, recovery code design avoiding third-party email exposure, no image upload attack vector. |
| **A05: Security Misconfiguration** | **PASS** | Helmet CSP configured, default admin account enforces mandatory password change, generic error responses in production. |
| **A06: Vulnerable & Outdated Components** | **PASS** | Dependencies tracked with `package-lock.json`, verified via `npm audit`. |
| **A07: Identification & Auth Failures** | **PASS** | Argon2id hashing, multi-tier login rate limiting, session rotation, constant-time comparisons. |
| **A08: Software & Data Integrity Failures** | **PASS** | Signed session cookies with HMAC-SHA256, atomic SQL schema migrations. |
| **A09: Security Logging & Monitoring Failures**| **PASS** | Tamper-evident `audit_log` records administrative actions, group closures, and security events. |
| **A10: Server-Side Request Forgery (SSRF)** | **PASS** | No arbitrary external URL fetching or user avatar uploads; provider adapters query fixed hostnames only (`discoveryprovider.audius.co`, `api.jamendo.com`). |
