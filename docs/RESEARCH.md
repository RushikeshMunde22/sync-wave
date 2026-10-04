# SyncWave Technology & API Research

This document compiles technical research conducted during the architecture and development of SyncWave. It evaluates music provider APIs, browser audio runtime constraints (especially iOS Safari), real-time protocol capabilities, database engine tuning, and free-tier infrastructure.

---

## Table of Contents
1. [Music Provider APIs](#1-music-provider-apis)
   - [Audius API (Primary)](#audius-api-primary)
   - [Jamendo API (Secondary Fallback)](#jamendo-api-secondary-fallback)
   - [Comparison & Legal Analysis](#comparison--legal-analysis)
2. [Browser Audio Runtime & Background Playback](#2-browser-audio-runtime--background-playback)
   - [The Single Audio Element Requirement](#the-single-audio-element-requirement)
   - [iOS Safari Lifecycle & Background Audio Rules](#ios-safari-lifecycle--background-audio-rules)
   - [Media Session API Support & Lock Screen Controls](#media-session-api-support--lock-screen-controls)
   - [Audio Range Requests & Service Worker Gotchas](#audio-range-requests--service-worker-gotchas)
3. [Realtime Protocol: Socket.IO v4.6+](#3-realtime-protocol-socketio-v46)
   - [Connection State Recovery](#connection-state-recovery)
   - [Cookie Authentication & Handshake Security](#cookie-authentication--handshake-security)
   - [Packet-Level Rate Limiting](#packet-level-rate-limiting)
4. [Embedded Database: SQLite & better-sqlite3](#4-embedded-database-sqlite--better-sqlite3)
   - [Write-Ahead Logging (WAL) Mode](#write-ahead-logging-wal-mode)
   - [Concurrency Tuning Pragmas](#concurrency-tuning-pragmas)
   - [Live Backup via VACUUM INTO](#live-backup-via-vacuum-into)
   - [Schema Migration Architecture](#schema-migration-architecture)
5. [Free-Tier Cloud Infrastructure Analysis](#5-free-tier-cloud-infrastructure-analysis)
   - [Oracle Cloud Infrastructure (OCI) Always Free](#oracle-cloud-infrastructure-oci-always-free)
   - [Turso (Alternative Serverless SQLite)](#turso-alternative-serverless-sqlite)
   - [PaaS Providers (Render, Railway, Fly.io) Evaluation](#paas-providers-render-railway-flyio-evaluation)

---

## 1. Music Provider APIs

### Audius API (Primary)

Audius is a decentralized, open music-sharing protocol built on decentralized node infrastructure. Unlike centralized commercial music APIs, Audius provides open public read gateways.

- **Endpoint Discovery**: Audius discovery nodes index metadata and serve the REST API. The official host gateway is `https://discoveryprovider.audius.co` (or any active discovery node discovered via `https://api.audius.co`).
- **Authentication**: Zero authentication required for baseline search, trending queries, and audio stream resolution. Passing an `app_name` query parameter (e.g., `?app_name=SyncWave`) satisfies network telemetry rules.
- **Rate Limits**:
  - Up to 10 requests per second per IP.
  - ~500,000 requests per month per client identifier.
- **Streaming Mechanics**:
  - Stream endpoint: `GET /v1/tracks/{track_id}/stream?app_name=SyncWave`
  - Audio delivery: The discovery node responds with an **HTTP 302 Found** redirect to a decentralized content node storing the raw 320kbps MP3 audio file.
  - Browsers follow the 302 redirect natively and stream the audio directly with full HTTP Range request support (`bytes=...`).
- **Search & Trending**:
  - Search: `GET /v1/tracks/search?query={q}&app_name=SyncWave`
  - Trending: `GET /v1/tracks/trending?app_name=SyncWave&limit=20`

```typescript
// Audius stream resolution example
const streamUrl = `https://discoveryprovider.audius.co/v1/tracks/${trackId}/stream?app_name=SyncWave`;
audioElement.src = streamUrl; // Browser automatically follows HTTP 302 redirect
```

### Jamendo API (Secondary Fallback)

Jamendo is a long-standing repository of indie music licensed under Creative Commons.

- **Endpoint**: `https://api.jamendo.com/v3.0/`
- **Authentication**: Requires a free `client_id` obtained in under 2 minutes at [devportal.jamendo.com](https://devportal.jamendo.com).
- **Rate Limits**:
  - Up to ~35,000 requests per month on the standard free developer plan.
- **Audio Format**:
  - Jamendo supports multiple audio formats. Setting `audioformat=mp32` returns high-quality 192kbps VBR MP3 streams.
- **Licensing & Attribution**:
  - Returns explicit CC license URLs (e.g., `http://creativecommons.org/licenses/by-nc-nd/3.0/`) in the `license_ccurl` property.
  - SyncWave stores and displays these attribution tags alongside the track metadata.

```typescript
// Jamendo query example
const url = new URL('https://api.jamendo.com/v3.0/tracks/');
url.searchParams.set('client_id', config.JAMENDO_CLIENT_ID);
url.searchParams.set('namesearch', query);
url.searchParams.set('format', 'json');
url.searchParams.set('audioformat', 'mp32');
```

### Comparison & Legal Analysis

| Feature | Audius API | Jamendo API | Spotify / YouTube API |
| :--- | :--- | :--- | :--- |
| **API Key Needed** | ❌ No | ✅ Yes (free `client_id`) | ✅ Yes (OAuth / Dev Key) |
| **Full Audio Stream** | ✅ Yes (302 redirect) | ✅ Yes (direct MP3 URL) | ❌ DRM / 30s preview only |
| **Sync ToS Compliant**| ✅ Yes (Open Protocol) | ✅ Yes (Creative Commons) | ❌ Prohibited by ToS |
| **Cost** | 100% Free | 100% Free | Requires User Premium |
| **Audio Format** | 320kbps MP3 / AAC | 192kbps MP3 (`mp32`) | Encrypted Widevine/FairPlay |

---

## 2. Browser Audio Runtime & Background Playback

Synchronizing audio across mobile web browsers requires navigating aggressive OS power-saving regimes and WebKit security policies.

### The Single Audio Element Requirement

On desktop browsers (Chrome, Firefox, Safari), calling `new Audio(url).play()` inside any asynchronous callback usually works. On mobile devices—specifically **iOS Safari** and Chrome for Android—arbitrary playback is prohibited:
1. Autoplay policies block any audio playback initiated without a direct, user-initiated DOM event (such as `touchend` or `click`).
2. Creating a new `HTMLAudioElement` (`document.createElement('audio')` or `new Audio()`) inside an asynchronous callback (e.g., a Socket.IO event indicating the track changed) is treated as an unprivileged playback attempt and rejected with `NotAllowedError: The play method is not allowed by the user agent or the platform`.

**The Solution**: SyncWave instantiates a single, persistent `HTMLAudioElement` at application launch:
- The user taps the initial "Play" or "Join Room" button.
- That single element's `play()` method is called within the user interaction context.
- For all subsequent track transitions, seeking, and pauses, **the same DOM element is retained**. Only its `.src` attribute is swapped.

### iOS Safari Lifecycle & Background Audio Rules

iOS Safari enforces an ultra-strict background task scheduler:
- When the screen locks or the user switches apps, Safari suspends all JavaScript execution within 3 to 10 seconds unless an audio session is actively streaming audio through an unlocked audio element.
- **The Synchronous Handoff Rule**: When Track A reaches its end, the `ended` event fires on the `<audio>` element. To continue playing Track B in the background without the iOS kernel killing the audio session, the client **must set the new `.src` and call `.play()` synchronously within the `ended` event handler**.
- Any network delay (such as making a fetch call to ask the server what track is next) breaks this synchronous handoff window, causing iOS to freeze the web worker / tab. SyncWave pre-buffers the next track URL in the queue store so the handoff is immediate.

```typescript
// Synchronous iOS Safari track handoff inside audio event handler
audio.addEventListener('ended', () => {
  const nextTrack = queueStore.peekNext();
  if (nextTrack) {
    audio.src = nextTrack.streamUrl;
    audio.currentTime = 0;
    audio.play().catch(console.error); // Synchronous call preserves iOS audio session
    socket.emit('playback:ended', { groupId, trackId: currentTrack.id, version });
  }
});
```

### Media Session API Support & Lock Screen Controls

The W3C Media Session API (`navigator.mediaSession`) enables web applications to display system-level media notifications, lock-screen media cards, and receive hardware key inputs (AirPods, smartwatch, steering wheel controls).

- **Browser Support**: >93% globally (supported on Chrome 73+, Edge 79+, Safari on iOS 15+, Firefox 82+).
- **Metadata**:
  - `title`: Track title
  - `artist`: Artist name
  - `album`: Album or room name
  - `artwork`: Array of artwork image sizes and MIME types
- **Action Handlers**:
  - `play`: Resumes group playback
  - `pause`: Pauses playback (or pauses locally depending on permissions)
  - `previoustrack` & `nexttrack`: Triggers track skip / queue advancement
  - `seekto`: Translates hardware seek slider updates to room seek events

```typescript
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: groupName,
    artwork: [
      { src: track.artworkUrl, sizes: '512x512', type: 'image/jpeg' },
    ],
  });

  navigator.mediaSession.setActionHandler('play', () => handlePlay());
  navigator.mediaSession.setActionHandler('pause', () => handlePause());
  navigator.mediaSession.setActionHandler('nexttrack', () => handleSkip());
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime !== undefined) handleSeek(details.seekTime * 1000);
  });
}
```

### Audio Range Requests & Service Worker Gotchas

When web audio streams play via `<audio>`, the browser requests chunks using the `Range: bytes=start-end` HTTP header. 
- On iOS Safari, the native media subsystem (CoreMedia) bypasses the WebKit networking stack and makes requests directly.
- **Service Worker Incompatibility**: A Service Worker `fetch` handler that intercepts requests cannot reliably stream Range requests on iOS Safari. Attempting to `event.respondWith()` an audio range request from cache or custom fetch often results in broken seek sliders or audio failing after byte 0.
- **Research Finding**: Audio stream URLs must bypass the Service Worker completely (or be allowed to pass straight through with `fetch(event.request)`).

---

## 3. Realtime Protocol: Socket.IO v4.6+

SyncWave utilizes Socket.IO v4.6+ over bare WebSockets to benefit from battle-tested production primitives.

### Connection State Recovery

In mobile real-time applications, brief network interruptions occur regularly (tunnel traversal, switching from 5G to Wi-Fi, screen lock sleep).
- **Mechanism**: The Socket.IO server maintains a ring buffer of emitted events alongside socket session IDs for up to 2 minutes (`maxDisconnectionDuration: 2 * 60 * 1000`).
- **Resumption**: When the client reconnects with its cached session ID, missed packets are replayed in order, and room memberships (`socket.rooms`) are restored automatically without re-invoking authorization handshakes or triggering duplicated join notifications.

```typescript
const io = new SocketIOServer(httpServer, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 120000,
    skipMiddlewares: false,
  },
});
```

### Cookie Authentication & Handshake Security

Socket.IO natively supports extracting signed HTTP cookies during the initial HTTP handshake:
- During handshake upgrade, `socket.request.headers.cookie` contains the signed `syncwave_session` cookie.
- `cookie-parser` decodes the session ID using the shared `SESSION_SECRET`.
- The session is validated against SQLite before the socket connection is accepted.
- If the session is missing, invalid, or belongs to a banned user, `next(new Error('Unauthorized'))` terminates the connection before any Socket.IO frames are processed.

### Packet-Level Rate Limiting

To prevent room spamming (e.g. rapid seek abuse or reaction flooding):
- Socket.IO middleware (`socket.use(([event, ...args], next) => ...)`) intercepts every incoming packet.
- In-memory token-bucket counters enforce per-event thresholds:
  - Reactions: Max 5 reactions per second, 30 per minute per user.
  - Playback controls: Max 2 seek/play/pause actions per second.
  - Payloads exceeding rate limits are rejected with an `error` event.

---

## 4. Embedded Database: SQLite & better-sqlite3

SQLite was selected for its single-file portability, zero-maintenance footprint, and exceptional read throughput.

### Write-Ahead Logging (WAL) Mode

The default SQLite rollback journal mode locks the entire database file during write transactions, preventing concurrent readers.
- **Setting**: `PRAGMA journal_mode = WAL;`
- **Effect**: Changes are written sequentially into a separate `-wal` file.
- **Concurrency**: Readers do not block writers, and writers do not block readers. Reads can occur concurrently across multiple threads while a write transaction is executing.

### Concurrency Tuning Pragmas

SyncWave configures the following engine pragmas at connection boot:

```sql
PRAGMA journal_mode = WAL;          -- Concurrent reads while writing
PRAGMA synchronous = NORMAL;         -- Sacrifices zero durability in WAL mode while doubling write throughput
PRAGMA foreign_keys = ON;            -- Enforces cascade deletions and referential integrity
PRAGMA busy_timeout = 5000;          -- Waits up to 5000ms for locks to clear before throwing SQLITE_BUSY
PRAGMA cache_size = -64000;          -- 64MB memory page cache for lightning-fast queries
PRAGMA temp_store = MEMORY;          -- In-memory temporary tables and indexes
```

### Live Backup via VACUUM INTO

SQLite 3.27+ introduced `VACUUM INTO 'filename.db'`, which creates a consistent, unfragmented snapshot of the live database without stopping active connections or risking corruption from raw file copying:
- Can run concurrently while users are streaming music.
- Backups are stored in `data/backups/syncwave-backup-{timestamp}.db`.
- SyncWave schedules automatic nightly backups using an embedded cron runner (`0 2 * * *`).

### Schema Migration Architecture

SyncWave employs an incremental, SQL-file-based migration runner (`server/src/db/migrator.ts`):
- A metadata table `_migrations` records executed filenames and timestamps.
- Migration files in `server/src/db/migrations/*.sql` execute in strict alphabetical order within isolated SQLite transactions (`db.transaction()`).
- On server startup, any unapplied migration scripts execute automatically, ensuring atomic, deterministic schema upgrades across all instances.

---

## 5. Free-Tier Cloud Infrastructure Analysis

SyncWave's operational goal is 100% free hosting with persistent state.

### Oracle Cloud Infrastructure (OCI) Always Free

| Resource | OCI Always Free Allocation | SyncWave Usage |
| :--- | :--- | :--- |
| **Compute** | 4 Ampere A1 ARM Cores, 24GB RAM | 1 Core, 1GB RAM (ample headroom) |
| **Storage** | 200GB persistent NVMe Block Volume | ~500MB (DB + backups + app) |
| **Egress** | 10TB outbound traffic per month | ~2-5GB/month (audio is direct stream) |
| **IP** | 1 static public IPv4 address | Included free |

- **Why it wins**: Oracle Cloud is the only global cloud provider offering genuine, permanent, persistent NVMe block storage at the free tier. Because audio bytes stream directly from Audius/Jamendo CDNs to user browsers, server bandwidth consumption is negligible.

### Turso (Alternative Serverless SQLite)

- **Architecture**: LibSQL distributed SQLite over HTTP/WebSocket.
- **Free Tier**: 9GB storage, 500 databases, generous read/write limits.
- **Evaluation**: An excellent drop-in option if hosting on serverless platforms (e.g., Fly.io or Vercel). However, for SyncWave's in-process Socket.IO engine and `better-sqlite3` native speed, a single persistent OCI VPS running embedded SQLite provides lower latency and avoids remote database query roundtrips.

### PaaS Providers (Render, Railway, Fly.io) Evaluation

- **Render**: Free tier disks are ephemeral (SQLite data is wiped on every deploy or sleep cycle). Free instances spin down after 15 minutes of inactivity, terminating real-time Socket.IO rooms.
- **Railway**: $5 monthly credit exhausts rapidly; no permanent free tier.
- **Fly.io**: Free tier persistent volume policies change frequently and require payment card verification.
- **Conclusion**: A self-contained Docker container deployed on an OCI Always Free VM (or any $3-5/mo VPS like Hetzner) offers the most reliable, zero-cost, permanent architecture.
