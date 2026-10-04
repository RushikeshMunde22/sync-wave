# SyncWave Known Limitations & Platform Constraints

This document provides a technical appraisal of known platform limitations, browser engine quirks (specifically Apple WebKit / iOS Safari), database boundaries, and third-party API dependencies. Understanding these constraints is essential for maintaining and operating SyncWave effectively.

---

## Table of Contents
1. [iOS Safari & Apple WebKit Audio Constraints](#1-ios-safari--apple-webkit-audio-constraints)
   - [Synchronous Track Handoff Requirement](#synchronous-track-handoff-requirement)
   - [The 3-Second Audio Silence PWA Termination Bug](#the-3-second-audio-silence-pwa-termination-bug)
   - [Service Worker Incompatibility with Audio Range Requests](#service-worker-incompatibility-with-audio-range-requests)
2. [Database Concurrency: SQLite Single-Writer Boundary](#2-database-concurrency-sqlite-single-writer-boundary)
3. [Music Provider Catalog & Network Variance](#3-music-provider-catalog--network-variance)
   - [Audius Decentralized Topology](#audius-decentralized-topology)
   - [Catalog Scope & Mainstream Music Availability](#catalog-scope--mainstream-music-availability)
4. [Free-Tier Infrastructure Constraints](#4-free-tier-infrastructure-constraints)
5. [Summary Matrix of Limitations & Workarounds](#5-summary-matrix-of-limitations--workarounds)

---

## 1. iOS Safari & Apple WebKit Audio Constraints

Modern mobile browsers enforce aggressive battery-preservation policies. Apple WebKit (which powers all web browsers on iOS, including Safari, Chrome, and Firefox on iOS) imposes the most restrictive runtime constraints in the industry.

---

### Synchronous Track Handoff Requirement

#### The Limitation
When an iOS device locks its screen or the user navigates away from the browser, WebKit suspends all JavaScript execution (timers, WebSockets, background promises) within **3 to 10 seconds**—*unless an audio session is actively streaming sound*.

When a track ends:
1. The `<audio>` element fires the `ended` DOM event.
2. WebKit allows a brief execution slice inside this specific synchronous event callback.
3. If the application makes an asynchronous network call (e.g. `await fetch('/api/next-track')` or awaits a WebSocket event) before invoking `audio.play()`, **WebKit considers the audio session terminated**.
4. The iOS kernel revokes the audio execution privilege, freezes the JavaScript thread, and locks the playback engine. The next song will not start until the user manually unlocks their phone and turns the screen back on.

#### SyncWave Mitigation
- **Singleton Audio Element**: SyncWave reuses a single `HTMLAudioElement` initialized during the initial user click.
- **Client-Side Queue Pre-Buffering**: The client store maintains the immediate `nextTrack` URL locally in memory.
- **Synchronous Handoff Execution**: Inside the `ended` listener, `audio.src` is updated and `audio.play()` is invoked **synchronously**, preserving the OS audio session uninterrupted while locked.

```typescript
// Synchronous handoff prevents iOS suspension
audio.addEventListener('ended', () => {
  const next = queueStore.peekNext();
  if (next) {
    audio.src = next.streamUrl;
    audio.currentTime = 0;
    audio.play(); // MUST be synchronous inside the event listener!
  }
});
```

---

### The 3-Second Audio Silence PWA Termination Bug

#### The Limitation
When SyncWave is added to the home screen as a **Progressive Web App (PWA)** on iOS, it runs inside WebKit's standalone WebApp container (`WebClip`).
- If audio playback stops (for instance, when an admin pauses the room, or if network buffering causes a pause lasting longer than **approximately 3 seconds** while the screen is locked), the iOS operating system reclaims memory and terminates the PWA process entirely.
- When the user wakes the screen, the PWA reloads from the splash screen, losing in-memory state.

#### SyncWave Mitigation
- In room view, when an admin or host pauses playback, mobile clients are advised to keep the screen awake if they intend to resume shortly, or rely on the native browser tab rather than standalone PWA mode for extended paused sessions.
- Connection state recovery allows the socket to re-establish state immediately upon app relaunch.

---

### Service Worker Incompatibility with Audio Range Requests

#### The Limitation
Web browsers stream audio files using HTTP `Range: bytes=start-end` requests to allow scrubbing and chunked buffering.
- On iOS Safari, the audio rendering pipeline is handed off directly to Apple's low-level `CoreMedia` daemon.
- When a Progressive Web App registers a Service Worker with a `fetch` event handler (`self.addEventListener('fetch', ...)`), CoreMedia requests passed through `event.respondWith()` frequently fail on iOS:
  - Streaming range chunks will result in `DOMException: The element has no supported sources`.
  - Seek sliders become disabled or cause playback to restart from second 0.

#### SyncWave Mitigation
- SyncWave's Service Worker (`client/public/sw.js`) explicitly excludes all audio streams and external provider URLs from interception.
- Audio stream requests bypass the Service Worker completely, permitting direct browser-to-CDN transport.

```javascript
// Service Worker passthrough for audio requests
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Bypass all audio streams and discovery endpoints
  if (
    url.pathname.includes('/stream') ||
    url.hostname.includes('audius.co') ||
    url.hostname.includes('jamendo.com') ||
    event.request.headers.get('range')
  ) {
    return; // Pass through to native network stack
  }
  // Standard cache-first strategy for static UI assets
});
```

---

## 2. Database Concurrency: SQLite Single-Writer Boundary

#### The Limitation
SQLite is an embedded, file-based database engine. Unlike client-server databases (PostgreSQL/MySQL) that support multi-version concurrency control (MVCC) with concurrent row-level write locks across separate nodes:
- SQLite enforces a **single-writer lock**. While SQLite WAL mode permits unlimited concurrent readers, only one write transaction may execute at any given instant.
- If multiple write operations collide, transactions must wait for the writer lock to clear. If a lock is held longer than the configured `busy_timeout` (5000ms), SQLite throws `SQLITE_BUSY: database is locked`.

#### Architectural Boundaries & Mitigation
- **In-Memory Ephemeral State**: SyncWave's real-time room engine (`SyncEngine`) maintains active playback positions, clock offsets, and member presence **in Node.js memory maps**. Ephemeral ping heartbeats and reaction broadcasts never touch the database.
- **Tightly-Scoped Transactions**: Database writes are limited to persistent state (account creation, room configuration changes, queue additions, audit logging).
- **Practical Capacity**: SQLite WAL mode easily supports **500 to 1,000 concurrent listeners** on a standard single-node server before write contention surfaces. Beyond this scale, migrating to an external database like PostgreSQL would be necessary.

---

## 3. Music Provider Catalog & Network Variance

SyncWave depends on open music protocols (Audius) and Creative Commons repositories (Jamendo) to remain 100% free and compliant with synchronization terms.

---

### Audius Decentralized Topology

#### The Limitation
- Audius operates via independent, decentralized discovery nodes and content storage nodes.
- If a discovery node experiences network degradation or downtime, search latency may increase.
- Content nodes delivering the final 320kbps MP3 audio file occasionally throttle high-bandwidth requests or suffer intermittent packet loss in specific geographic regions.

#### SyncWave Mitigation
- Requests implement a strict 10-second timeout via `AbortController`.
- Track metadata and direct stream URLs are cached locally in the SQLite `tracks` table.
- Secondary fallback to Jamendo ensures basic audio playback continues if Audius discovery nodes experience disruptions.

---

### Catalog Scope & Mainstream Music Availability

#### The Limitation
- Commercial streaming services (Spotify, Apple Music) license billions of dollars worth of major label catalogs (Universal, Sony, Warner Music).
- Neither Audius nor Jamendo license major label Top 40 pop hits.
- **Audius catalog**: Strong in electronic, EDM, indie hip-hop, underground dance, lofi, and independent artist originals/remixes.
- **Jamendo catalog**: Creative Commons, indie rock, classical, background ambient, and instrumental productions.

#### Operating Reality
SyncWave is designed for discovering independent artists, community playlists, and communal listening without paid subscriptions or DRM restrictions. Users seeking commercial Billboard pop songs will find limited direct availability.

---

## 4. Free-Tier Infrastructure Constraints

When hosting on the Oracle Cloud Infrastructure (OCI) Always Free Tier:
- **ARM Ampere Capacity Availability**: In specific high-demand OCI regions (e.g. Phoenix, Ashburn, Frankfurt), provisioning an Ampere A1 ARM instance may occasionally return `Out of capacity for shape VM.Standard.A1.Flex`. (Workaround: Retry during off-peak hours or select an alternate availability domain).
- **Outbound Bandwidth**: While OCI allocates 10TB/month free, SyncWave consumes negligible server bandwidth because audio bytes stream directly from Audius/Jamendo edge CDNs to client browsers.
- **Static IPv4 Rules**: OCI provides 1 free ephemeral/reserved IPv4 address per account. Deleting and re-allocating instances requires updating DNS `A` records.

---

## 5. Summary Matrix of Limitations & Workarounds

| System Component | Constraint / Limitation | User / Dev Impact | SyncWave Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **iOS Safari** | Background execution halted if audio is silent. | Playback stops on locked phones if next song takes >500ms to start. | Singleton `HTMLAudioElement` + pre-buffered queue + synchronous handoff in `ended` listener. |
| **iOS Standalone PWA** | WebClip process killed after ~3s audio silence. | Long pauses while locked kill the PWA app. | Recommend browser tab for extended pauses; Connection State Recovery restores state on reopen. |
| **Service Worker** | Cannot proxy audio HTTP Range requests on iOS. | Audio fails to stream or scrub if intercepted by SW. | Service Worker regex explicitly excludes `/stream` and external CDN domains. |
| **SQLite Engine** | Single-writer concurrency lock. | Maximum ~1,000 active concurrent users per single instance. | WAL mode (`PRAGMA journal_mode = WAL`), in-memory sync state, 5000ms busy timeout. |
| **Audius API** | Decentralized node latency variance. | Occasional slow track metadata load. | 10s fetch timeout, metadata caching in SQLite, Jamendo fallback provider. |
| **Catalog Depth** | No major label commercial DRM music. | No Spotify Top 40 Billboard hits. | Rich indie, EDM, lofi, and Creative Commons catalog; 100% legal & DRM-free. |
