FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        ca-certificates \
        fonts-liberation \
        wget \
        gnupg \
        libnss3 \
        libatk-bridge2.0-0 \
        libxss1 \
        libasound2 \
        libxshmfence1 \
        libgbm1 \
        libxcomposite1 \
        libxrandr2 \
        libxdamage1 \
        libxkbcommon0 \
        libpangocairo-1.0-0 \
        libgtk-3-0 \
        libdrm2 \
        libxfixes3 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libuuid1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev \
    && npx puppeteer browsers install chrome

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
