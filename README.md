# 🌊 SyncWave

**Listen together, in sync.** SyncWave lets two or more people, in different places, listen to the same song at the same moment through the browser.

## ✨ Features

- **Real-time sync** — Everyone hears the same track within ~150ms of each other
- **Rooms (Groups)** — Create a room, share an invite code, friends join in seconds
- **Shared queue & playlists** — Build playlists together, queue songs, vote to skip
- **Emoji reactions** — React with ❤️ 🔥 😂 and more — floating animations for everyone
- **Background playback** — Music keeps playing when your screen is locked
- **Free music** — Streams from Audius and Jamendo (Creative Commons)
- **PWA** — Install as an app on any device
- **Admin panel** — Full ops dashboard for superadmins
- **Privacy-first** — No tracking, minimal data, delete your account anytime

## 🚀 Quickstart (5 minutes)

### Prerequisites
- Node.js 20+ (`node -v`)
- npm 10+ (`npm -v`)

### 1. Clone and install
```bash
git clone <your-repo-url> syncwave
cd syncwave
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env` and set the required values:
```env
SESSION_SECRET=<random 48+ character string>
ADMIN_EMAIL=admin@syncwave.local
ADMIN_INITIAL_PASSWORD=<strong password, min 10 chars>
```

Generate a session secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 3. Build and start
```bash
# Development mode (hot reload)
npm run dev

# Production mode
npm run build
npm start
```

The app is live at **http://localhost:3000** 🎉

### 4. First login
Sign in with the `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD` you set. You'll be prompted to change your password on first login.

## 🧪 Running Tests

```bash
# Unit and integration tests
npm test

# End-to-end tests (requires the app to be running)
npm run test:e2e
```

## 🐳 Docker

```bash
# Build and run
docker build -t syncwave .
docker run -p 3000:3000 \
  -e SESSION_SECRET=your-secret-here \
  -e ADMIN_EMAIL=admin@syncwave.local \
  -e ADMIN_INITIAL_PASSWORD=your-password \
  -v syncwave-data:/app/data \
  syncwave

# Or with Docker Compose
cp .env.example .env
# Edit .env with your values
docker compose up -d
```

## 📁 Project Structure

```
syncwave/
├── server/                 # Express + Socket.IO backend
│   └── src/
│       ├── index.ts        # Entry point
│       ├── config.ts       # Environment validation
│       ├── auth/           # Authentication system
│       ├── db/             # SQLite database + migrations
│       ├── groups/         # Groups/rooms management
│       ├── music/          # Music provider adapters
│       ├── sync/           # Real-time sync engine
│       └── admin/          # Admin panel API
├── client/                 # React + Vite frontend
│   └── src/
│       ├── pages/          # Page components
│       ├── components/     # Reusable components
│       ├── stores/         # Zustand state management
│       ├── player/         # Audio engine + sync
│       └── hooks/          # Custom React hooks
├── docs/                   # Documentation
├── tests/                  # Test suites
├── Dockerfile              # Production container
├── docker-compose.yml      # Dev convenience
└── .env.example            # Environment template
```

## 🎵 Music Sources

SyncWave streams from legal, free music APIs:

- **Audius** (primary) — Decentralized music platform, no API key needed
- **Jamendo** (secondary) — Creative Commons music, requires free client_id

The app works with Audius alone. To add Jamendo as a fallback, get a free client_id at [devportal.jamendo.com](https://devportal.jamendo.com) and set `JAMENDO_CLIENT_ID` in your `.env`.

## 📖 Documentation

- [Architecture](docs/ARCHITECTURE.md) — System design, data model, sync algorithm
- [Deployment](docs/DEPLOY.md) — Free hosting setup, step-by-step
- [Security Audit](docs/SECURITY_AUDIT.md) — OWASP checklist and threat model
- [Design](docs/DESIGN.md) — UX decisions and principles
- [Decisions](docs/DECISIONS.md) — Technical decision log
- [Known Limits](docs/KNOWN_LIMITS.md) — Honest browser/platform limitations
- [Research](docs/RESEARCH.md) — API and technology research

## 🔒 Security

- Argon2id password hashing
- HttpOnly, Secure, SameSite session cookies
- Strict CSP via Helmet
- CSRF protection (Origin/Referer validation)
- Rate limiting on all endpoints and socket events
- Parameterized SQL queries only
- No secrets in frontend or logs
- Full audit trail for admin actions

## 📄 License

MIT
