# Implementation and verification plan

The starting checkout contained a Next.js interface, a Prisma schema, OAuth helpers,
and localStorage preview interactions. This delivery connects the existing interface
to real shared persistence. The supplied PLAN.md is a product reference; the current
request also asks for usable course creation, which is included in administration.

## 1. Establish the runtime

- Keep Next.js App Router, strict TypeScript, npm, PostgreSQL and Prisma.
- Apply versioned database migrations and seed the requested Concrete Math AV - P4 course.
- Provide six fictional development personas backed by ordinary database sessions.
- Support an isolated portable PostgreSQL process for local Windows development, and
  Docker Compose for the complete Linux deployment stack.
- Keep credentials, database files, uploaded PDFs, scanner binaries and test output out of Git.

## 2. Replace the preview boundary

- Authenticate the application layout and every API request using opaque sessions.
- Derive authorship, account status, membership and staff privileges on the server.
- Require current policy acceptance before posting.
- Read course data from authenticated APIs; surface loading, empty, denied and error states.
- Preserve compact navigation, a responsive calendar, light/dark/system themes and attribution.

## 3. Finish collaboration

- Assessments contain ordered topics and question templates; major assessments have banks.
- Each assessment can link to one calendar event, with the event as the date source.
- Calendar members add attributed updates; only authors or assigned staff edit canonical details.
- Plain text, sanitized Markdown/LaTeX and privately stored PDF notes share content controls.
- General advice and assessment-specific advice remain separate and filterable.
- Content edits use optimistic versions and retain attributed revisions.

## 4. Finish practice

- Author choice, short text, numeric and long response questions with skills and solutions.
- Keep answer keys, explanations and solutions out of ordinary course responses.
- Check answers against immutable revisions on the server, with duplicate-request protection.
- Support Unicode/whitespace normalization, aliases, case sensitivity, numeric tolerance and units.
- Reveal solutions explicitly; identify ungraded work without claiming automatic correctness.
- Keep practice history private to its student and allow that student to clear it.

## 5. Finish moderation and uploads

- Report, hide, restore, lock and appeal contributions with reasons and audit metadata.
- Limit teacher authority to assigned courses; expose platform roles and account controls to admins.
- Manage course creation, archiving, membership, staff assignments and rotating join codes.
- Quarantine PDFs, validate structure and page limits in a separate bounded process, scan with
  ClamAV, and publish only after successful scanning. Fail closed on scanner errors.
- Recheck authorization, visibility and scan state on every private file request.

## 6. Validate and publish

- Run lint, TypeScript, unit tests and a production build.
- Exercise real database workflows through HTTP, including role revocation, cross-course denial,
  stale versions, duplicate calendar links, hidden dependencies and private answer/history access.
- Exercise browser posting, editing, checking, reporting and management flows on desktop and mobile.
- Scan representative screens with axe and capture screenshots and viewport/runtime results.
- Run real clean/unsafe PDF lifecycle checks and verify unauthorized file downloads are denied.
- Review the staged source for secrets and generated artifacts, then push to the existing OpenTJ repo.

## ION activation boundary

ION account registration and a live authorization round trip require the user's confidential
client ID, secret and exact registered redirect URI. The implementation can be built and tested
with fictional personas before these exist. Client registration uses the official
[ION OAuth guide](https://tjcsl.github.io/ion/developing/oauth.html). Live ION login and any
authenticated visual comparison must be reported separately from local test results.

## Reference projects

- [ICT website](https://github.com/TJ-Computer-Team/ict-website): a small Next.js site.
- [TJVMT](https://github.com/arulandu/tjvmt): Next.js, Prisma, Docker and ION integration context.
- [AI Grader](https://github.com/ovkulkarni/ai-grader): background-job separation for expensive work.
- [ION](https://github.com/tjcsl/ion/): authentication authority and compact interface reference.

The interface and application code are independently implemented. OpenTJ is student contributed
and is not an official ION, CSL, TJHSST or FCPS service.
