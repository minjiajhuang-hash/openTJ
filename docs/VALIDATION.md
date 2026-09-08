# Delivery validation

## Node 22.9 compatibility update

The compatibility update was checked on Windows with the official Node 22.9.0
binary (SHA-256 verified) and npm 10.8.3: clean engine-strict installation,
Prisma client generation, lint, 37 unit tests with coverage, type checking and
production compilation/standalone packaging. The dependency audit reports zero
vulnerabilities. CI now repeats the Linux checks and full service/browser suite
on exactly Node 22.9.0; see the commit's GitHub Actions result for its outcome.

These checks do not establish that the application fits Director's 100 MB limit
or that live ION credentials and external production services are configured.

## Original delivery

Validated on Windows with Node.js 22, real PostgreSQL 18, private local file storage,
and ClamAV 1.4.6 with verified official signatures. Local personas replace only
the external identity handoff; course data, sessions, authorization, grading,
moderation and uploads use the actual application services and database.

## Requirement evidence

| Requirement | Implementation and verification |
| --- | --- |
| ION login and protected material | Confidential authorization-code OAuth, S256 PKCE, one-use browser-bound state, server profile lookup and database sessions. Unit coverage includes callback replay, wrong browser binding and production persona rejection. Anonymous direct page/API requests are refused. |
| Student, staff and administrator access | Live API tests cover course membership, unassigned staff, revoked membership, account restrictions, forged authorship, last-administrator protection and role changes. Browser tests exercise staff and administrator screens. |
| Course listing and creation | Seeded Concrete Math AV - P4, join codes, administrator course creation, staff assignment and archiving. API and browser tests create isolated fictional courses. |
| Interactive calendar and annotations | Month/week/day/agenda views, Eastern time, event editing, drag/resize confirmation, and attributed updates. Browser checks create standalone events and updates, reload them, and verify persistence at three viewports. API checks verify another member can read and annotate standalone events. |
| Assessments | Topics, templates, details, optional dates, major-assessment banks and idempotent calendar linking. Live API checks include conflicting edits and repeated linking. |
| Notes | Attributed plain text, sanitized Markdown/LaTeX and private scanned PDFs. Browser checks verify persisted text and actual KaTeX output. |
| Advice | General and assessment-specific contributions with editing, attribution and reporting; persisted through the content API. |
| Practice banks | Choice, short text/aliases, numeric tolerance/units and long responses. Server-only keys, immutable revisions, explicit solutions, private history, idempotent attempts. Browser checks cover keyboard submission; API checks cover answer secrecy, revision changes and ungraded responses. |
| Moderation | Reports, attributed hide/restore/lock decisions, appeals, course notices, administrative restrictions and audit records. Browser test completes takedown, author appeal, staff overturn and restoration. |
| Search and larger courses | Debounced authenticated search, paginated content/history, loading older linked content, and question-bank filters. Search navigation has a browser regression check. |
| Lightweight UI | Course tab navigation reuses loaded course data; no periodic whole-course polling. FullCalendar stays on its route; fonts and math assets are self-hosted. Private responses cannot enter shared caches. |
| File safety | Actual ClamAV scan, bounded PDF parsing, quarantine, active-content rejection, private view authorization, integrity checking and worker-driven publication. Upload verification uses real bytes and the running worker. |
| Operations | Native local setup, Docker development/production stacks, migrations, environment checks, retention, backup/recovery instructions, CI and a standalone-package check. |

## Repeatable checks

- `npm run lint` and `npm run typecheck`.
- `npm test`: 37 unit tests, including grading, OAuth, PDF parsing and safe math rendering.
- `npm run test:api`: nine live workflow groups against PostgreSQL.
- `npm run test:uploads`: real clean/rejected PDFs, quarantine/private access and publication.
- `npm run test:e2e`: 36 browser tests across 1440px desktop, 768px tablet and 390px mobile.
  Includes WCAG A/AA axe scans, keyboard navigation, all course screens in dark mode,
  responsive screenshots, persistent contributions, practice and moderation.
- `npm run build`: production compilation and standalone-package inspection.
- `npm audit --omit=dev --audit-level=high`: zero production dependency vulnerabilities at delivery.
- `npm run check:env`: local settings accepted, with the expected missing-ION warning.

Browser screenshots/traces are saved in `test-results/` and `playwright-report/`.
The API verifier writes its result JSON in `test-results/`. These and runtime data
are ignored by Git. Unit coverage is deliberately reported separately from live
HTTP/browser checks; those integration checks do not contribute to V8 unit coverage.
Automated axe checks do not replace a complete manual accessibility review.

## External checks

The final live ION round trip requires the owner's registered client ID, client
secret, deployment URL/redirect URI and intended initial administrator ION ID.
No real ION account or token was used during local validation.

Docker is unavailable on the development machine. CI is configured to exercise
Linux production-image packaging and the PostgreSQL/MinIO/ClamAV container stack.
Its run status is authoritative for container validation. S3 deployment, HTTPS
reverse-proxy configuration and restoration of production backups must be checked
against the chosen hosting environment before opening it to students.
