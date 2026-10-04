# SyncWave Production Deployment Guide

This guide provides end-to-end instructions for deploying **SyncWave** locally, via Docker, and on **Oracle Cloud Infrastructure (OCI) Always Free Tier** for permanent zero-cost hosting.

---

## Table of Contents
1. [Prerequisites & Environment Variables](#1-prerequisites--environment-variables)
2. [Local Development Setup](#2-local-development-setup)
3. [Acquiring a Free Jamendo Client ID (2 Minutes)](#3-acquiring-a-free-jamendo-client-id-2-minutes)
4. [Docker Deployment](#4-docker-deployment)
5. [Oracle Cloud Always Free Deployment (Complete Walkthrough)](#5-oracle-cloud-always-free-deployment-complete-walkthrough)
   - [Creating the VM Instance](#step-1-create-the-compute-instance)
   - [Configuring Network Ingress & Firewall](#step-2-configure-network-ingress-and-firewall)
   - [Server Setup & Docker Installation](#step-3-server-setup-and-docker-installation)
   - [Deploying SyncWave](#step-4-deploying-syncwave)
   - [Configuring Caddy for Automatic HTTPS](#step-5-configuring-caddy-for-automatic-https)
6. [Database Backup & Disaster Recovery](#6-database-backup--disaster-recovery)
7. [Health Checks & Monitoring](#7-health-checks--monitoring)

---

## 1. Prerequisites & Environment Variables

### System Requirements
- **Node.js**: `v20.0.0+`
- **npm**: `v10.0.0+`
- **RAM**: Minimum 512MB (1GB+ recommended)
- **Disk**: 1GB free storage for SQLite DB and backups

### Environment Variables Reference

Create a `.env` file in the project root:

```ini
# ── Required ──────────────────────────────────────────────
# Cryptographic secret for signing session cookies (min 32 chars)
# Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
SESSION_SECRET=e4a8b792c30f4a8b659d4c2b988f01c38e912a76f23b610c598a4421b8c716298ef47c0b2d6a54109867c29b8c0491a2

# Initial superadmin credentials (created on first database bootstrap)
ADMIN_EMAIL=admin@syncwave.local
ADMIN_INITIAL_PASSWORD=ChangeThisSecurePassword123!

# ── Production Host Configuration ─────────────────────────
# Public URL for your deployment (used for CORS, CSRF, and invite links)
BASE_URL=https://syncwave.yourdomain.com
PORT=3000
NODE_ENV=production
DATA_DIR=/app/data

# ── Music Providers ───────────────────────────────────────
# Optional: Jamendo API client ID for secondary Creative Commons music
# App functions seamlessly without it using Audius
JAMENDO_CLIENT_ID=

# ── Optional Settings ─────────────────────────────────────
# Maximum members allowed in a single listening room (default: 50)
MAX_GROUP_MEMBERS=50

# Temporarily close new registrations
SIGNUPS_DISABLED=false

# Contact email displayed in footer for DMCA queries
DMCA_CONTACT=admin@yourdomain.com
```

---

## 2. Local Development Setup

To run SyncWave locally on your development machine:

```bash
# 1. Clone the repository
git clone https://github.com/your-repo/syncwave.git
cd syncwave

# 2. Install dependencies for all workspaces
npm install

# 3. Copy and configure environment variables
cp .env.example .env

# Generate a session secret and add it to .env
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(48).toString('hex'))"

# 4. Start concurrent development servers (client + server with hot-reload)
npm run dev
```

The application will be live at:
- Frontend & API: **http://localhost:3000** (or Vite client on port 5173 with proxy).

---

## 3. Acquiring a Free Jamendo Client ID (2 Minutes)

Jamendo provides access to thousands of Creative Commons tracks as a fallback provider.

1. Navigate to [devportal.jamendo.com](https://devportal.jamendo.com).
2. Click **Create an account** (free, no credit card required).
3. Once logged in, navigate to **My Apps** -> **Create an Application**.
4. Enter:
   - **Application Name**: `SyncWave`
   - **Type**: `Non-commercial` or `Personal`
5. Click **Save**. Your new **Client ID** (a 8-character string, e.g. `a1b2c3d4`) will appear immediately on the dashboard.
6. Paste the client ID into your `.env`:
   ```ini
   JAMENDO_CLIENT_ID=a1b2c3d4
   ```
7. Restart SyncWave. The Jamendo search and trending provider is now active alongside Audius!

---

## 4. Docker Deployment

SyncWave includes an optimized multi-stage `Dockerfile` and `docker-compose.yml`.

### Quick Run with Docker Compose

```bash
# 1. Ensure your .env is populated
cp .env.example .env
nano .env

# 2. Build and launch the container in the background
docker compose up -d --build

# 3. Verify container status
docker compose ps
docker compose logs -f syncwave
```

The data directory is persisted in a named Docker volume `syncwave-data`.

### Standalone Docker Command

```bash
# Build the container
docker build -t syncwave:latest .

# Run with persistent volume mount
docker run -d \
  --name syncwave \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env \
  -v syncwave-data:/app/data \
  syncwave:latest
```

---

## 5. Oracle Cloud Always Free Deployment (Complete Walkthrough)

Oracle Cloud Infrastructure (OCI) provides the most generous permanent free tier available:
- **Ampere A1 ARM Compute**: Up to 4 OCPUs, 24GB RAM (or 1 OCPU, 6GB RAM).
- **Persistent Storage**: 200GB free NVMe block storage.
- **Outbound Bandwidth**: 10TB/month free.

### Step 1: Create the Compute Instance
1. Register for an [Oracle Cloud Always Free account](https://www.oracle.com/cloud/free/).
2. From the OCI console, navigate to **Compute** -> **Instances** -> **Create Instance**.
3. **Name**: `syncwave-server`
4. **Image**: `Ubuntu 22.04 Minimal` or `Canonical Ubuntu 24.04`
5. **Shape**: Select **Ampere** -> **VM.Standard.A1.Flex** (Allocate 2 OCPUs, 12GB RAM).
6. **Networking**: Assign a public IPv4 address.
7. **SSH Keys**: Download and save your private SSH key.
8. Click **Create**. Note your instance's **Public IP**.

### Step 2: Configure Network Ingress and Firewall
1. In the OCI Console, click on your instance's **Virtual Cloud Network (VCN)** -> **Security Lists** -> **Default Security List**.
2. Click **Add Ingress Rules**:
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: `TCP`
   - **Destination Port Range**: `80,443`
   - **Description**: `HTTP and HTTPS web traffic`
3. Click **Add Ingress Rules**.

### Step 3: Server Setup and Docker Installation

Connect to your instance via SSH:
```bash
ssh -i /path/to/your-key.key ubuntu@<YOUR_PUBLIC_IP>
```

Open the OS-level iptables firewall on Ubuntu:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Update system packages and install Docker:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw fail2ban

# Install Docker via official script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose plugin
sudo apt install -y docker-compose-plugin

# Activate group without logging out
newgrp docker
```

### Step 4: Deploying SyncWave

Clone the repository into `/opt/syncwave`:
```bash
sudo mkdir -p /opt/syncwave
sudo chown ubuntu:ubuntu /opt/syncwave
git clone https://github.com/your-username/syncwave.git /opt/syncwave
cd /opt/syncwave

# Create production environment file
cp .env.example .env
nano .env
```

Configure `.env`:
- Set `BASE_URL=https://syncwave.yourdomain.com`
- Set `SESSION_SECRET`
- Set `ADMIN_INITIAL_PASSWORD`

Build and launch the application:
```bash
docker compose up -d --build
```

### Step 5: Configuring Caddy for Automatic HTTPS

Caddy handles reverse proxying, WebSockets, and automatic Let's Encrypt TLS certificate generation with zero configuration:

```bash
# Install Caddy on host
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

Create `/etc/caddy/Caddyfile`:
```bash
sudo nano /etc/caddy/Caddyfile
```

Add your domain configuration:
```caddy
syncwave.yourdomain.com {
    # Forward all traffic to the SyncWave Docker container
    reverse_proxy 127.0.0.1:3000

    # Compression
    encode gzip zstd

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
}
```

Restart Caddy:
```bash
sudo systemctl reload caddy
```

Point your domain's DNS `A` record to `<YOUR_PUBLIC_IP>`. Caddy will obtain a free SSL certificate within seconds. Your SyncWave instance is now live at `https://syncwave.yourdomain.com`!

---

## 6. Database Backup & Disaster Recovery

SyncWave uses SQLite in WAL mode. Copying the raw `syncwave.db` file while the server is running risks file corruption. Always use SQLite's native `VACUUM INTO` command.

### Automated Backups
SyncWave runs an embedded nightly backup cron at 02:00 AM UTC:
- Destination: `/app/data/backups/syncwave-backup-{timestamp}.db`
- Retention: Keeps the last 7 daily snapshots automatically.

### Manual Live Snapshot
To trigger an immediate live snapshot on the host:
```bash
docker compose exec syncwave node -e "
  const db = require('better-sqlite3')('/app/data/syncwave.db');
  const path = '/app/data/backups/manual-backup-' + Date.now() + '.db';
  db.exec('VACUUM INTO \'' + path + '\'');
  console.log('Created backup:', path);
"
```

### Restoring from a Backup
In the event of accidental data deletion or hardware failure:

```bash
# 1. Stop the application container
docker compose stop syncwave

# 2. Locate backup file in host volume mount
cd /opt/syncwave
# Find the latest backup
BACKUP_FILE=$(ls -t ./data/backups/syncwave-backup-*.db | head -1)

# 3. Replace the active database file and clear WAL journals
cp "$BACKUP_FILE" ./data/syncwave.db
rm -f ./data/syncwave.db-wal ./data/syncwave.db-shm

# 4. Restart SyncWave
docker compose start syncwave
docker compose logs -f syncwave
```

### Offsite Backup Script (rclone / S3)
To mirror backups offsite to Google Drive or AWS S3:
```bash
#!/bin/bash
# /opt/syncwave/offsite-backup.sh
rclone sync /opt/syncwave/data/backups remote:syncwave-backups --max-age 7d
```

---

## 7. Health Checks & Monitoring

### Health Endpoint
SyncWave provides an unauthenticated `/api/health` monitoring endpoint:
```bash
curl -I https://syncwave.yourdomain.com/api/health
```

Sample JSON response:
```json
{
  "status": "ok",
  "uptime": 14285.24,
  "timestamp": "2026-10-04T20:00:00.000Z"
}
```

### Viewing Real-Time Logs
```bash
# Follow live container logs
docker compose logs -f --tail=100 syncwave

# Filter for security warnings or errors
docker compose logs syncwave | grep -E "ERROR|WARN"
```

### System Performance Monitoring
```bash
# Check container CPU and memory usage
docker stats syncwave
```
Under normal listening loads (10-20 active rooms), SyncWave uses **under 80MB RAM** and **<2% CPU** on a single ARM core.
