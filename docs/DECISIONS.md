# Architecture Decision Records (ADR) Log

This document records the foundational architecture and technology decisions made for **SyncWave**. Each record follows a structured format outlining the decision context, chosen solution, rationale, rejected alternatives, and evaluated risks with mitigations.

---

## Index of Decisions

- [D001: SQLite via better-sqlite3 over PostgreSQL](#d001-sqlite-via-better-sqlite3-over-postgresql)
- [D002: Audius as Primary Music Provider with Jamendo Secondary](#d002-audius-as-primary-music-provider-with-jamendo-secondary)
- [D003: Recovery Code Instead of Email Reset](#d003-recovery-code-instead-of-email-reset)
- [D004: Origin-Based CSRF Protection](#d004-origin-based-csrf-protection)
- [D005: Socket.IO v4 over Raw WebSockets](#d005-socketio-v4-over-raw-websockets)
- [D006: Zustand over Redux Toolkit](#d006-zustand-over-redux-toolkit)
- [D007: Oracle Cloud Always Free Tier for Deployment](#d007-oracle-cloud-always-free-tier-for-deployment)
- [D008: Emoji and Color Avatars Instead of Image Uploads](#d008-emoji-and-color-avatars-instead-of-image-uploads)
- [D009: Argon2id for Password Hashing](#d009-argon2id-for-password-hashing)
- [D010: Single Reused HTMLAudioElement Pattern for Audio Engine](#d010-single-reused-htmlaudioelement-pattern-for-audio-engine)

---

## D001: SQLite via better-sqlite3 over PostgreSQL

- **Status**: Accepted
- **Context**: SyncWave is designed as a lightweight, zero-maintenance, self-hostable synchronous listening platform for friend groups and small communities (<1,000 concurrent listeners). It requires persistent data storage for user accounts, sessions, room configuration, playlists, and audit logs.
- **Decision**: Use embedded SQLite via `better-sqlite3` executed in Write-Ahead Logging (`WAL`) mode with synchronous writes set to `NORMAL`.
- **Why**:
  - **Self-Contained Deployment**: Runs inside the Node.js process without requiring a separate database container, server process, TCP networking, or connection pool configuration.
  - **Zero Cost & Portability**: The entire database is a single file (`syncwave.db`), making hot backups (`VACUUM INTO`), file transfers, and development synchronization trivial.
  - **Ultra-Low Latency**: In-process synchronous calls via native C++ bindings avoid TCP loopback round-trip latency (sub-millisecond reads).
  - **Fits Concurrency Profile**: Read operations are non-blocking in WAL mode; write queries for room state and queue mutations take fractions of a millisecond.
- **Alternatives Rejected**:
  - **PostgreSQL**: Adds external operational dependencies, memory footprint (~100-200MB baseline), connection pool management, and paid cloud hosting requirements for managed instances.
  - **MySQL / MariaDB**: Similar operational complexity with no added benefits for single-node deployments.
- **Risks & Mitigations**:
  - *Risk*: Single-writer concurrency lock contention during traffic spikes.
  - *Mitigation*: Configured `PRAGMA busy_timeout = 5000` to wait up to 5 seconds before failing. All transactions are scoped tightly. Periodic read queries use prepared statements. SyncEngine keeps ephemeral real-time state in memory to avoid constant disk I/O on heartbeat events.

---

## D002: Audius as Primary Music Provider with Jamendo Secondary

- **Status**: Accepted
- **Context**: SyncWave enables groups to stream music synchronously. Standard music streaming APIs (Spotify Web API, Apple MusicKit, YouTube Data API) explicitly forbid synchronized multi-user playback in their Terms of Service, employ aggressive DRM (Widevine/FairPlay) preventing coordinated offset seeking, or require paid developer subscriptions with strict playback quotas.
- **Decision**: Adopt the **Audius API** as the primary, zero-config music source and **Jamendo** as the secondary, Creative Commons music provider.
- **Why**:
  - **No Mandatory API Key**: Audius provides open discovery node endpoints (`https://discoveryprovider.audius.co`) requiring zero API keys for baseline search, trending feeds, and full-length MP3/AAC audio streaming.
  - **Generous Limits**: Up to 10 requests per second and 500,000 requests per month under public guidelines.
  - **Legal Direct Audio Streaming**: Both services return standard HTTP/HTTPS audio streams (Jamendo serves standard 128kbps/320kbps MP3s via `mp32` format; Audius resolves via HTTP 302 redirects to decentralized storage/edge nodes).
  - **Full-Length Playback**: No 30-second preview limitations.
- **Alternatives Rejected**:
  - **Spotify Web Playback SDK**: Requires every connected user to have an active Spotify Premium account; SDK restricts background audio playback on mobile browsers; Terms of Service prohibit synchronized group broadcast.
  - **YouTube IFrame Player API**: Lacks fine-grained seek precision; iframe prevents background audio playing on iOS Safari; syncing external video iframes introduces drift of 1-3 seconds.
  - **SoundCloud API**: Developer application registration has been largely closed or waitlisted; strict request quotas.
- **Risks & Mitigations**:
  - *Risk*: Audius discovery nodes can experience latency or transient network partitions.
  - *Mitigation*: SyncWave uses node failover and timeout wrappers (`AbortController` set to 10s). Secondary Jamendo provider provides high-uptime fallback when configured. Stream URLs and track metadata are cached locally in the `tracks` database table.

---

## D003: Recovery Code Instead of Email Reset

- **Status**: Accepted
- **Context**: Users occasionally forget their passwords. Traditional password reset flows rely on sending reset links or OTPs via transactional SMTP or email APIs (SendGrid, Postmark, AWS SES, Mailgun).
- **Decision**: Generate a cryptographically secure 12-character hex recovery code (`crypto.randomBytes(6).toString('hex')`) displayed to the user once upon account registration. Store only its SHA-256 hash in the database.
- **Why**:
  - **Zero External Dependencies**: Eliminates reliance on transactional email services, credit cards for API tier signups, SPF/DKIM/DMARC domain configuration, and deliverability problems (spam folders).
  - **Vendor Independence & Privacy**: User email addresses remain purely an identifier; no third-party email service receives user activity or communication metadata.
  - **Instant Account Recovery**: Recovery is self-contained and instantaneous via the recovery code.
- **Alternatives Rejected**:
  - **SendGrid / Mailgun Free Tiers**: Require domain verification, credit card verification, and frequently revoke accounts for low-volume hobby projects.
  - **Self-Hosted SMTP (Postfix/Exim)**: High maintenance, almost universally blocked by major providers (Gmail/Outlook) due to IP reputation rules on residential/VPS subnets.
- **Risks & Mitigations**:
  - *Risk*: User fails to save the recovery code upon registration.
  - *Mitigation*: UI explicitly presents the code in a high-visibility modal with a "Copy to Clipboard" action and requires the user to acknowledge that the code cannot be retrieved once closed. In case of loss, room owners or the instance superadmin can assist via the administrative panel.

---

## D004: Origin-Based CSRF Protection

- **Status**: Accepted
- **Context**: The application uses HttpOnly session cookies for stateful authentication across Single Page Application (SPA) REST endpoints. Protecting against Cross-Site Request Forgery (CSRF) is essential.
- **Decision**: Validate the `Origin` and `Referer` headers against the server's configured `BASE_URL` on all non-idempotent HTTP methods (`POST`, `PUT`, `DELETE`, `PATCH`), combined with `SameSite=Lax` (or `SameSite=Strict`) cookies.
- **Why**:
  - **Stateless & Resilient**: Avoids generating, storing, and synchronizing anti-CSRF tokens across browser tabs or REST responses.
  - **Compliant with Modern Standards**: The W3C and OWASP recommend origin verification as a primary CSRF defense for modern browsers, as browsers guarantee that `Origin` headers cannot be altered by JavaScript.
  - **SPA Native**: Works seamlessly with `fetch` and client-side routing without maintaining synchronized CSRF tokens across page transitions.
- **Alternatives Rejected**:
  - **Synchronizer Token Pattern / Double Submit Cookie**: Adds state management complexity and client cookie parsing without delivering additional security over strict origin checks when SameSite cookies are already enforced.
- **Risks & Mitigations**:
  - *Risk*: Rare legacy proxies or privacy extensions stripping `Origin` and `Referer` headers.
  - *Mitigation*: Requests lacking both headers on state-changing endpoints are rejected by default (`403 Forbidden`). All standard modern browsers transmit `Origin` on cross-origin and same-origin state-altering POST requests.

---

## D005: Socket.IO v4 over Raw WebSockets

- **Status**: Accepted
- **Context**: SyncWave requires bidirectional, low-latency communication to synchronize audio playback, propagate room queues, broadcast reactions, and maintain presence data.
- **Decision**: Standardize on **Socket.IO v4.6+** with Connection State Recovery enabled.
- **Why**:
  - **Connection State Recovery**: Built-in buffer for packets and room memberships when clients briefly disconnect (e.g. mobile lock screen or cellular-to-Wi-Fi switch), automatically re-joining rooms and receiving missed events.
  - **Native Room Management**: `socket.join(groupId)` and `socket.to(groupId).emit()` provide clean abstractions for multi-room routing without manual subscription registries.
  - **Automatic Fallback & Heartbeats**: Handshakes over HTTP Long-Polling before upgrading to WebSocket ensure reliability behind aggressive enterprise firewalls and mobile networks.
  - **Packet-Level Middleware**: Simplifies per-packet session validation and rate limiting.
- **Alternatives Rejected**:
  - **Raw WebSockets (`ws`)**: Requires manual implementation of room multiplexing, heartbeat timeouts, reconnection buffers, and long-polling fallback.
  - **Server-Sent Events (SSE) + HTTP POST**: Half-duplex; requires separate HTTP requests for every client action, introducing unnecessary connection overhead and latency variance.
- **Risks & Mitigations**:
  - *Risk*: Slight protocol overhead compared to raw binary WebSocket frames.
  - *Mitigation*: SyncWave payloads are concise JSON objects; total packet volume per room is well within Node.js process capacity (<1% CPU on modern hardware for 50-member rooms).

---

## D006: Zustand over Redux Toolkit

- **Status**: Accepted
- **Context**: The React client requires centralized state management for authentication, audio playback state, queue items, room presence, and real-time socket connections.
- **Decision**: Use **Zustand** for all client-side state management (`useAuthStore`, `usePlayerStore`, `useSocketStore`).
- **Why**:
  - **Zero Boilerplate**: No actions, reducers, dispatchers, or context providers wrapping the component tree. Stores are defined in self-contained files.
  - **Direct Access Outside React**: Can read and mutate state directly inside non-React listeners (such as audio event handlers and Socket.IO callbacks) via `getState()` and `setState()`.
  - **Selective Re-rendering**: Component hooks subscribe only to specific state slices (e.g., `const isPlaying = usePlayerStore(s => s.playbackState.isPlaying)`), preventing unnecessary render cascades across the DOM.
  - **Bundle Size**: ~1KB minified compared to >30KB for Redux Toolkit + React-Redux.
- **Alternatives Rejected**:
  - **Redux Toolkit (RTK)**: Unnecessary verbosity, boilerplate action creators, and provider wrapping for an application of this scale.
  - **React Context API**: Triggers re-renders across all consumers whenever any slice of context updates; poor fit for high-frequency updates like playback progress timers.
- **Risks & Mitigations**:
  - *Risk*: Lack of rigid structural constraints could lead to unorganized state mutations.
  - *Mitigation*: Strict TypeScript interfaces govern every store's state shape and action signatures.

---

## D007: Oracle Cloud Always Free Tier for Deployment

- **Status**: Accepted
- **Context**: The deployment target must provide continuous 24/7 uptime, persistent disk storage for the SQLite database, and sufficient CPU/RAM for audio sync handling at zero hosting cost.
- **Decision**: Recommend and document the **Oracle Cloud Infrastructure (OCI) Always Free Tier** (specifically Ampere A1 ARM compute with 200GB persistent block volume) as the target production environment.
- **Why**:
  - **Genuine Persistent Storage**: Provides up to 200GB of NVMe block storage included free forever, ensuring the SQLite database and backups survive instance reboots and container restarts.
  - **Generous Resource Allocation**: Up to 4 OCPUs and 24GB RAM on Ampere A1 ARM instances, easily supporting thousands of concurrent socket connections.
  - **Full Root & VM Control**: Allows Docker, Caddy/Nginx reverse proxy, automated SQLite backups, and systemd services to run unrestricted.
- **Alternatives Rejected**:
  - **Render / Railway Free Tiers**: Ephemeral filesystems wipe SQLite databases on redeploy or inactivity; strict execution hour caps and sleep timeouts.
  - **Fly.io**: Free tier persistent volume allowances are constrained (often requiring credit card validation and subject to sudden policy changes).
  - **Vercel / Netlify**: Serverless environments cannot sustain persistent Socket.IO connections or stateful SQLite connections.
- **Risks & Mitigations**:
  - *Risk*: ARM architecture compatibility.
  - *Mitigation*: SyncWave uses multi-arch Node.js base images (`node:20-alpine`) and better-sqlite3 compiles cleanly on `linux/arm64`. Standard x86 VMs are also supported.

---

## D008: Emoji and Color Avatars Instead of Image Uploads

- **Status**: Accepted
- **Context**: Users need identifiable visual personas in listening rooms, queue listings, and presence headers.
- **Decision**: Provide user profiles with curated musical/expressive emojis (`avatar_emoji`, e.g., 🎵, 🎧, 🎸, 🚀) paired with vivid hex background colors (`avatar_color`) instead of accepting custom image uploads.
- **Why**:
  - **Eliminates Attack Surfaces**: Completely prevents file upload vulnerabilities, Server-Side Request Forgery (SSRF) via avatar fetchers, malicious SVG/XSS payloads, ImageMagick exploits, and zip bombs.
  - **No Storage Overhead**: Avatars are stored as two plain strings in the database, avoiding local disk bloat or costly S3 bucket integrations.
  - **Zero Moderation Liability**: Prevents upload of offensive, illegal, or copyrighted imagery on open listening instances.
  - **Instant Rendering**: 100% vector-sharp on all screens with zero network requests or image decode overhead.
- **Alternatives Rejected**:
  - **Local/S3 File Uploads**: Requires MIME sniffing, multipart form parsing, image re-encoding (sharp), virus scanning, and storage maintenance.
  - **Gravatar Integration**: Leaks user email hashes to a third-party tracker, violating privacy principles.
- **Risks & Mitigations**:
  - *Risk*: Users cannot express unique personal branding through custom profile photos.
  - *Mitigation*: The palette of high-contrast background colors and diverse emoji icons offers hundreds of distinctive combinations that fit the music player aesthetic.

---

## D009: Argon2id for Password Hashing

- **Status**: Accepted
- **Context**: SyncWave stores credentials for standard users and superadmins. Passwords must be protected against brute-force and hardware-accelerated dictionary attacks.
- **Decision**: Hash all user passwords using **Argon2id** via the `argon2` native library.
- **Why**:
  - **Cryptographic Standard**: Argon2 won the Password Hashing Competition (PHC) and is recommended by OWASP, NIST, and IETF over legacy algorithms.
  - **Hybrid Resistance**: Argon2id combines Argon2d (resistant to GPU/ASIC cracking via data-dependent memory access) and Argon2i (resistant to side-channel cache-timing attacks via data-independent memory access).
  - **Memory-Hard**: Requires configurable RAM blocks during hashing, drastically raising the financial and computational cost of hardware cracking rigs.
- **Alternatives Rejected**:
  - **bcrypt**: Good historical standard, but lacks memory-hardness and caps input strings at 72 bytes.
  - **PBKDF2 / SHA-256**: Easily parallelized on commodity GPUs.
- **Risks & Mitigations**:
  - *Risk*: CPU/Memory load on low-power host CPUs during simultaneous logins.
  - *Mitigation*: Configured with OWASP-recommended default parameters (3 iterations, 64MB memory, 1 thread), completing in ~50-100ms per verification. API login endpoints are protected by an IP-based rate limiter (5 requests per 15 minutes) to block automated brute-force attempts.

---

## D010: Single Reused HTMLAudioElement Pattern for Audio Engine

- **Status**: Accepted
- **Context**: Web browsers—specifically mobile Safari on iOS and Chrome on Android—enforce strict autoplay policies and lifecycle limits on background media playback. Creating a `new Audio()` object or cycling audio elements in response to a network event (such as the next track in a queue starting) while the phone screen is locked results in immediate playback suspension.
- **Decision**: Maintain a single singleton `<audio>` element instantiated during the initial user interaction gesture, and reuse this identical element for the entire browser session. Perform track handoff synchronously inside the audio element's `ended` event listener.
- **Why**:
  - **iOS Background Continuity**: iOS Safari grants background audio execution permission to a specific `HTMLAudioElement` that was triggered by an explicit user gesture (tap/click). Swapping the DOM element or creating a new element drops this privilege.
  - **Seamless Queue Transitions**: Setting `audio.src = nextTrackStreamUrl; audio.play();` synchronously within the `ended` or preload event keeps the audio session alive in the OS kernel.
  - **Media Session Integration**: Binds cleanly to the browser's `navigator.mediaSession` API to display lock screen metadata, track artwork, and hardware playback keys.
- **Alternatives Rejected**:
  - **Web Audio API (`AudioContext`)**: Suspended automatically by iOS and Android as soon as the screen locks or the tab enters the background.
  - **Multiple Audio Elements (Crossfade Buffering)**: Secondary elements lack background gesture inheritance on iOS Safari unless each is explicitly tapped by the user while the screen is awake.
- **Risks & Mitigations**:
  - *Risk*: The reused element could retain stale buffering states or network errors from failed streams.
  - *Mitigation*: The audio engine explicitly resets playback position, cleans event listeners, handles `error` events gracefully, and verifies readyState before initiating playback.
