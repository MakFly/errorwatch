# ===========================================
# ErrorWatch Multi-Target Dockerfile
# ===========================================
# Usage:
#   docker build --target api -t errorwatch-api .
#   docker build --target web -t errorwatch-web .

FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# ===========================================
# API — Dependencies
# ===========================================
FROM base AS api-deps
COPY apps/api/package.json ./
COPY bun.lock ./
RUN bun install --frozen-lockfile --production

# ===========================================
# API — Build
# ===========================================
FROM base AS api-build
COPY apps/api/package.json ./
COPY bun.lock ./
COPY apps/api/tsconfig.json ./tsconfig.json
COPY apps/api/drizzle.config.ts ./drizzle.config.ts
RUN bun install --frozen-lockfile
COPY apps/api/src ./src
RUN bun run build

# ===========================================
# API — Production
# ===========================================
FROM oven/bun:1.2-alpine AS api

LABEL org.opencontainers.image.title="ErrorWatch API Server"
LABEL org.opencontainers.image.vendor="ErrorWatch"

WORKDIR /app

RUN addgroup --system --gid 1001 errorwatch && \
    adduser --system --uid 1001 errorwatch && \
    mkdir -p /data/sourcemaps && \
    chown -R errorwatch:errorwatch /data

COPY --from=api-deps --chown=errorwatch:errorwatch /app/node_modules ./node_modules
COPY --from=api-build --chown=errorwatch:errorwatch /app/dist ./dist
COPY --from=api-build --chown=errorwatch:errorwatch /app/package.json ./
COPY --from=api-build --chown=errorwatch:errorwatch /app/drizzle.config.ts ./
COPY --chown=errorwatch:errorwatch apps/api/drizzle ./drizzle

ENV NODE_ENV=production
ENV PORT=3333
ENV SOURCEMAPS_PATH=/data/sourcemaps

USER errorwatch
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3333/health/live || exit 1

CMD ["bun", "run", "dist/index.js"]

# ===========================================
# Web — Dependencies
# ===========================================
FROM base AS web-deps
COPY apps/web/package.json ./
COPY bun.lock ./
RUN bun install --frozen-lockfile

# ===========================================
# Web — Build
# ===========================================
FROM base AS web-build
COPY --from=web-deps /app/node_modules ./node_modules
COPY apps/web/package.json ./
COPY bun.lock ./
COPY apps/web/next.config.ts apps/web/tsconfig.json apps/web/tailwind.config.ts apps/web/postcss.config.js apps/web/components.json ./
COPY apps/web/src ./src
COPY apps/web/public ./public

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_MONITORING_API_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_MONITORING_API_URL=${NEXT_PUBLIC_MONITORING_API_URL}

RUN bun run build

# ===========================================
# Web — Production
# ===========================================
FROM oven/bun:1.2-alpine AS web

LABEL org.opencontainers.image.title="ErrorWatch Dashboard"
LABEL org.opencontainers.image.vendor="ErrorWatch"

WORKDIR /app

RUN addgroup --system --gid 1001 nextjs && \
    adduser --system --uid 1001 nextjs

COPY --from=web-build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=web-build --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=web-build --chown=nextjs:nextjs /app/public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["bun", "run", "server.js"]
