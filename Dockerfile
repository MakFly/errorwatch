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
COPY package.json ./
COPY bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN cd apps/api && bun install --frozen-lockfile

# ===========================================
# API — Build
# ===========================================
FROM base AS api-build
COPY package.json ./
COPY bun.lock ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/drizzle.config.ts ./apps/api/drizzle.config.ts
RUN cd apps/api && bun install --frozen-lockfile
COPY apps/api/src ./apps/api/src
RUN cd apps/api && bun run build

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
COPY --from=api-build --chown=errorwatch:errorwatch /app/apps/api/dist ./dist
COPY --from=api-build --chown=errorwatch:errorwatch /app/apps/api/package.json ./
COPY --from=api-build --chown=errorwatch:errorwatch /app/apps/api/drizzle.config.ts ./
COPY --chown=errorwatch:errorwatch apps/api/drizzle ./drizzle
COPY --chown=errorwatch:errorwatch apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=api-build --chown=errorwatch:errorwatch /app/apps/api/src/db ./src/db

ENV NODE_ENV=production
ENV PORT=3333
ENV SOURCEMAPS_PATH=/data/sourcemaps

USER errorwatch
EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3333/health/live || exit 1

ENTRYPOINT ["sh", "docker-entrypoint.sh"]

# ===========================================
# Web — Dependencies
# ===========================================
FROM base AS web-deps
COPY package.json ./
COPY bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
RUN cd apps/web && bun install --frozen-lockfile

# ===========================================
# Web — Build (uses Node.js — Next.js requires napi modules)
# ===========================================
FROM node:22-alpine AS web-build
WORKDIR /app
COPY --from=web-deps /app/node_modules ./node_modules
COPY apps/web/package.json ./
COPY apps/web/next.config.ts apps/web/tsconfig.json apps/web/tailwind.config.ts apps/web/postcss.config.js apps/web/components.json ./
COPY apps/web/src ./src
COPY apps/web/public ./public

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_MONITORING_API_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NEXT_PUBLIC_MONITORING_API_URL=${NEXT_PUBLIC_MONITORING_API_URL}

RUN npx next build

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
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["bun", "run", "server.js"]
