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

# The worker and migration jobs need Prisma's CLI and tsx at runtime. They are
# intentionally isolated from the smaller public web image.
# Worker/migration jobs need source files and Prisma, but no Next.js build.
FROM development AS tasks
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
