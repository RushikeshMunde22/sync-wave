# Multi-stage Dockerfile for SyncWave
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install all dependencies (including devDependencies for build)
RUN npm ci --workspace=server --workspace=client

# Copy source code
COPY . .

# Build client (static assets)
RUN npm run build -w client

# Build server (TypeScript)
RUN npm run build -w server

# Stage 2: Production
FROM node:20-alpine AS production

# Security: non-root user
RUN addgroup -g 1001 -S syncwave && \
    adduser -S syncwave -u 1001 -G syncwave

WORKDIR /app

# Copy package files for production install
COPY package.json package-lock.json* ./
COPY server/package.json ./server/

# Install production dependencies only
RUN npm ci --workspace=server --omit=dev && \
    npm cache clean --force

# Copy built server
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/src/db/migrations ./server/dist/db/migrations

# Copy built client (static files)
COPY --from=builder /app/client/dist ./client/dist

# Copy docs
COPY docs ./docs

# Create data directory
RUN mkdir -p /app/data/backups && \
    chown -R syncwave:syncwave /app/data

# Environment
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV PORT=3000

# Switch to non-root user
USER syncwave

# Expose port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start
CMD ["node", "server/dist/index.js"]
