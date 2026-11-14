# Production image of the server (issue #19). Build from the repository root:
#   docker build -f apps/server/Dockerfile -t antigravity-connector .

FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @antigravity-connector/server build \
 && pnpm --filter @antigravity-connector/server deploy --prod --legacy /deploy

# The agy binary is pinned by version, URL and SHA-512 (from the release manifest of the official installer).
# Installed root-owned, so the server user cannot replace it with a self-update.
FROM debian:bookworm-slim AS agy
ARG AGY_URL=https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.9-4515810895593472/linux-x64/cli_linux_x64.tar.gz
ARG AGY_SHA512=d01eb13ba7750eed18907f1ae8860864371e0ad9064415e8d033d22b4bd7b9b4e4c7f962058520b452d67db1c33163d9a889d55a7dffa159596ec6cd91a87b79
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL -o /tmp/agy.tar.gz "${AGY_URL}" \
 && echo "${AGY_SHA512}  /tmp/agy.tar.gz" | sha512sum -c - \
 && tar -xzf /tmp/agy.tar.gz -C /tmp antigravity \
 && install -m 0755 /tmp/antigravity /usr/local/bin/agy \
 && rm -f /tmp/agy.tar.gz /tmp/antigravity

FROM node:22-bookworm-slim AS runtime
# Why: the browse tool drives Google Chrome; agy looks for google-chrome on PATH.
ARG CHROME_URL=https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && curl -fsSL -o /tmp/chrome.deb "${CHROME_URL}" \
 && apt-get install -y --no-install-recommends /tmp/chrome.deb \
 && rm -f /tmp/chrome.deb \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --shell /usr/sbin/nologin agy \
 && mkdir -p /home/agy/.gemini /data && chown agy:agy /home/agy/.gemini /data
COPY --from=agy /usr/local/bin/agy /usr/local/bin/agy
WORKDIR /app
COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /repo/apps/server/dist/main.mjs ./main.mjs
# Why: the bind guard refuses 0.0.0.0 unless ALLOW_NON_LOOPBACK_BIND is set; the container must listen on all interfaces so Docker can forward the port, and compose publishes it on 127.0.0.1 only.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    ALLOW_NON_LOOPBACK_BIND=true \
    PORT=8787 \
    AGY_BIN=agy \
    DATA_DIR=/data
EXPOSE 8787
USER agy
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8787/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "main.mjs"]
