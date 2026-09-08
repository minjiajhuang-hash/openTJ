# openTJ

A compact, student-contributed course workspace with ION OAuth authentication.
The initial course is **Concrete Math AV - P4**. The app includes shared calendars,
assessment details, attributed notes and advice, interactive practice banks,
course membership, moderation, appeals and platform administration.

OpenTJ is independent and is not an official ION, CSL, TJHSST or FCPS service.
The production seed contains the course structure without fictional assessment content.
Development uses clearly labeled fictional accounts and fixtures.

## Local development without ION credentials

Requirements: Node.js 22.9.0 or newer within Node 22, npm and Git. CI and the
default Docker image target exactly 22.9.0 for Director compatibility. Docker is optional for native
development. The portable database helper runs actual PostgreSQL on loopback and
keeps its data inside this checkout; it does not install a system service.

For the existing Director deployment, see [Node 22.9 setup](docs/NODE-22.9.md).

```powershell
npm ci
npm run setup:local
npm run db:local
```

Leave the database terminal open. In a second terminal:

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

Visit **http://127.0.0.1:3000** and choose a development persona. The seeded join
code is `concrete-p4-demo`; staff can rotate it in course administration. Student
members can post, the nonmember must join, the assigned teacher can moderate,
the unassigned teacher has no automatic course access, and the administrator
can create courses and manage roles. The suspended persona is refused access.

`setup:local` creates `.env` only when absent, generates a random session secret,
and uses PostgreSQL port 54329. It preserves existing configuration. Use the same
origin in the browser and `APP_URL`; mutation requests from other origins are rejected.
The Windows database helper also handles non-ASCII profile paths through short paths.

For PDF uploads on Windows, run this once, then start the worker in another terminal:

```powershell
powershell -NoProfile -File scripts/setup-clamav.ps1
npm run worker
```

The setup script downloads the official portable ClamAV release, updates and
verifies its signatures, and writes the local scanner paths to `.env`. Repeat it
to update signatures. On other systems use a maintained ClamAV daemon configured
through `CLAMAV_HOST`/`CLAMAV_PORT`, or use Docker below. Files remain quarantined
when the worker or scanner is unavailable; there is no bypass that marks files clean.

## Complete local stack with Docker

After `.env` setup, this starts the web app, migration/seed job, PostgreSQL, private
MinIO storage, ClamAV and the processing worker:

```powershell
docker compose up --build
```

The development web image supports local personas. Named volumes preserve data.
`docker compose down` stops services without removing data; do not add `--volumes`
unless you intend to erase those volumes. The first ClamAV signature update may
take several minutes. The app's readiness endpoint is `/api/health`.

## Using the workspace

- Join a course using its code or ask assigned staff to add your username.
- Create assessments with topics, question templates, descriptions and optional dates.
  A major assessment creates its question bank. Calendar linking is idempotent.
- Add shared events and attributed updates. Authors and assigned staff can edit
  event details; drag/resize changes require confirmation. Dates use Eastern time.
- Publish plain text, Markdown with LaTeX, or a PDF note. Every contribution shows
  its author and timestamps. PDF notes publish only after validation and scanning.
- Share general advice or advice linked to a particular assessment.
- Add original choice, short text, numeric or long response practice questions.
  Check answers by button or Enter; long responses retain normal newlines and use
  Ctrl/Cmd+Enter for comparison. Solutions require an explicit reveal.
- Edit or hide your own work, report inappropriate content, and appeal takedowns.
  Staff can hide, restore or lock contributions with a recorded reason.
- Administrators can create/archive courses, assign staff, grant/revoke platform
  roles and restrict accounts. Teacher status alone does not grant moderation.

Accept the contribution policy before first posting. The policy is publicly readable
at `/policy`. Practice history is private to the student and can be cleared.

## Activate ION

Follow the official [ION OAuth registration guide](https://tjcsl.github.io/ion/developing/oauth.html):
register a **Confidential** client using **Authorization code**. Enter the exact callback
URL for your deployment, for example `https://your-host/api/v1/auth/ion/callback`.
OpenTJ requests only the `read` scope and uses S256 PKCE plus one-time browser-bound state.

Set these values privately in the server environment:

```dotenv
APP_URL=https://your-host
ION_CLIENT_ID=your-registered-client-id
ION_CLIENT_SECRET=your-registered-client-secret
ION_REDIRECT_URI=https://your-host/api/v1/auth/ion/callback
BOOTSTRAP_ADMIN_ION_IDS=your-stable-ion-profile-id
```

The client ID, client secret and registered redirect URI are the remaining ION
configuration needed from the owner. Never commit them. Passwords and OTPs are
entered only on the official ION site. Access tokens stay on the server and are
discarded after retrieving the identity profile, with best-effort revocation.
Bootstrap IDs are used only while no local platform administrator exists; later
role changes are made through administration.

For production, use a fresh database/storage environment, strong PostgreSQL/MinIO
credentials and a random session secret. Set `STORAGE_DRIVER=s3`, disable local
personas, configure an HTTPS reverse proxy, and run:

```powershell
docker compose -f docker-compose.yml -f docker-compose.production.yml up --build -d
```

The production override selects the optimized web image and explicitly forces
`NODE_ENV=production`, `APP_ENV=production`, `DEMO_AUTH_ENABLED=false`. The migration
job validates deployment settings before starting the app. Final live ION login
requires the registered credentials and a real account; local persona tests do
not prove that external round trip.

## Architecture and operating notes

- Next.js App Router, React, TypeScript, Prisma and PostgreSQL. Private S3-compatible
  storage in deployment; an authenticated local filesystem adapter for development.
- Database-backed opaque sessions in HttpOnly cookies; identity, membership,
  permissions and optimistic versions are checked at server boundaries.
- Ordinary question responses exclude keys, solutions and explanations. Checking
  uses immutable question revisions and deduplicates repeated submissions.
- Calendar and rich math code are confined to their relevant screens. Course tab
  navigation reuses loaded data; lists and private history have bounded pages.
- A separate PDF worker enforces 20 MiB/200-page limits, validates compressed PDF
  objects in a bounded process, rejects active/encrypted/embedded content, and
  requires a clean ClamAV result. Private viewing rechecks membership, publication,
  scan state and byte integrity, and sends a sandboxed PDF response.
- Nonce-based script CSP, Origin checks, input limits, private cache headers and
  request IDs protect server boundaries. Logs omit submitted answers and secrets.
- Per-process rate limits suit one web instance. Before deploying replicas,
  enforce aggregate limits at the trusted reverse proxy. Set `TRUST_PROXY=true`
  only when that proxy overwrites incoming forwarding headers.

## Backups, recovery and retention

Back up PostgreSQL and private object storage together. For Docker, use a scheduled
`pg_dump` in the `postgres` container and a private MinIO mirror/snapshot. Store
backups encrypted outside the server and test restoration to a separate environment.
Avoid piping binary database dumps through Windows PowerShell text redirection;
write the dump inside the container and copy it out with `docker compose cp`.

Restore the matching database and storage backup, apply pending migrations, then
start the worker and verify `/api/health`, member access and a private file view.
Do not expose MinIO buckets publicly. Development data directories, secrets and
test artifacts are ignored by Git and Docker build context.

The worker performs bounded hourly retention: hidden content expires after 90 days,
with text/answer-key removal and retried object deletion. Audit metadata and resolved
moderation records expire after 13 calendar months. Open reports and appeals preserve
the relevant content. Set `PRESERVATION_HOLD=true` to pause retention during a school
review. Private attempt/revision identities and recorded outcomes survive content
expiry until the student clears their history.

## Verification

Run the database, web app and scanner worker before HTTP/browser tests:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:api
npm run test:uploads
npx playwright install chromium
npm run test:e2e
```

On Windows, stop web/worker Node processes before `npm run build`: Prisma cannot
replace its native engine DLL while those processes use it. Restart development
services after building. CI runs static/unit/build checks and the complete Docker
stack, including browser accessibility/responsive checks and real MinIO/ClamAV uploads.

API verification uses a temporary fictional course and archives it afterward.
Upload/browser tests create clearly fictional contributions in the development
course. Run these only against a local test environment. Inspect `test-results/`
and `playwright-report/` for local results. See [the implementation plan](docs/IMPLEMENTATION.md)
for the original work breakdown and [validation notes](docs/VALIDATION.md) for the
verified delivery results and remaining external checks.
