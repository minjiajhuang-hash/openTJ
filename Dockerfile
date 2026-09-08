# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.9.0-bookworm-slim

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl dumb-init openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci --include=dev --engine-strict; else npm install --include=dev --engine-strict; fi

FROM dependencies AS builder
COPY . .
RUN mkdir -p public \
    && npm run build

FROM dependencies AS development
ENV NODE_ENV=development
COPY . .
RUN npm run db:generate && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

# Operational jobs install only their runtime dependencies, not the web build,
# browser/lint/test tools or embedded development PostgreSQL distribution.
FROM base AS task-dependencies
COPY deployment/tasks/package.json deployment/tasks/package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --engine-strict \
    && npm run db:generate

FROM task-dependencies AS tasks
COPY src/worker.ts ./src/worker.ts
COPY src/lib/server/db.ts src/lib/server/storage.ts src/lib/server/env.ts src/lib/server/crypto.ts src/lib/server/retention.ts src/lib/server/pdf-scan.ts ./src/lib/server/
COPY scripts/pdf-inspect.mjs ./scripts/pdf-inspect.mjs
COPY scripts/check-env.mjs ./scripts/check-env.mjs
COPY docker/app-init.sh ./docker/app-init.sh
RUN chown -R node:node /app
USER node
ENV NODE_ENV=production
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "run", "worker"]

FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN groupadd --system --gid 1001 nextjs \
    && useradd --system --uid 1001 --gid nextjs --home-dir /app nextjs

COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]

# Export portable Linux files for hosts such as Director, without a Docker daemon.
FROM scratch AS deployment
COPY --from=runner /app /web
COPY --from=tasks /app /tasks
COPY deployment/load-env.mjs deployment/runtime-env.mjs deployment/run.sh deployment/migrate.sh deployment/worker.sh /
COPY scripts/check-env.mjs /check-env.mjs
