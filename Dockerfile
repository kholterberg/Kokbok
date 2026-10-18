# --- Steg 1: installera beroenden (better-sqlite3 kan behöva kompileras) ---
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Steg 2: själva appen, utan byggverktyg ---
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/recept.db \
    IMAGE_DIR=/data/images
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Kör som den inbyggda node-användaren (uid 1000) i stället för root
RUN mkdir -p /data /backups && chown node:node /data /backups
USER node

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD node -e "fetch('http://localhost:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
