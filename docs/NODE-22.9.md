# Node 22.9 compatibility

Director currently supplies Node 22.9.0 and npm 10.8.3. `.nvmrc`, CI and the
default Docker image use that exact Node release. Newer Node 22 patch releases
remain supported and are preferable when the host makes them available.

The application remains on Next.js 16.3.4 and Prisma 6.12.0. Compatibility pins
apply to development tooling:

- Vite 6.4.3 satisfies Vitest 4's supported dependency range without requiring
  Node 22.12 or Rolldown.
- Rollup 4.62.2 avoids the newer Linux native compression dependency that
  requires Node 22.20.
- TypeScript 5.9.3 and typescript-eslint 8.55.0 form a compatible compiler/linter
  pair using eslint-visitor-keys 4, which supports Node 22.9.
- The resolver's optional WASM runtime is pinned to 1.1.4 within its declared
  dependency range; later versions require Node 22.13.
- Node type definitions target 22.9 instead of Node 24.

CI installs with `--engine-strict` so incompatible engines fail the build instead
of becoming warnings. Do not remove these pins without testing on Node 22.9.0.

## Updating an existing Director checkout

In the site's Web Terminal:

```sh
cd /site/private/openTJ
git pull --ff-only origin main
node --version
npm ci --include=dev --engine-strict
```

The version check should show `v22.9.0` (or a newer Node 22 release). If you
previously prepended a privately installed Node to PATH, open a fresh terminal
and remove that PATH override from your startup script to use Director's Node.

Only after installation succeeds, and with Director's `DATABASE_URL` present:

```sh
export NODE_ENV=production
export APP_ENV=production
export DEMO_AUTH_ENABLED=false
npm run db:generate && npm run db:migrate && npm run db:seed
```

This initializes the database; it does not complete production configuration.
ION credentials, private S3 storage, PDF scanning/worker configuration and the
web startup script are still required as described in the README.

Node compatibility does not reduce Director's memory allocation. If installation
is killed at the approximately 100 MB limit, request more memory or install/build
on a suitable Linux build host. Do not bypass engine checks or disable upload
scanning to work around a resource limit.
