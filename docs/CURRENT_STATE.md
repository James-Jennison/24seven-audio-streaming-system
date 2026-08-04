# Current State

## Implemented and pushed through M1.2

- Node 22 / TypeScript control-plane scaffold with strict type checking.
- PostgreSQL Compose foundation, versioned M1 schema migration, and idempotent stable-ID station seed.
- Separate migrator/runtime database connection variables; runtime startup rejects SQLite fallback.
- Scrypt password-hash/session primitives, station-scoped role helpers, content-free audit schema, and deterministic programming dry-run domain logic.
- Protected, PostgreSQL-backed programming routes for all seven M1 entity families, with scoped CRUD dispatch, CSRF/RBAC checks, safe errors, and content-free rejection/mutation audits.
- Complete-state update validation for media, playlists, separation rules, rotations, clocks, program blocks, and scheduled events; retained and replacement references are checked in PostgreSQL against the selected station.
- Loopback-only HTTP server with liveness, readiness, version, and station-read endpoints.
- Minimal browser dashboard showing all five stations, unimplemented audio-runtime state, and version/build metadata.
- Versioned domain contracts and explicit writer ownership for configuration versus future runtime observations.
- Repository hygiene, dependency audit, formatting, lint, type, domain, API, and UI checks.

M1.1 (foundations/persistence/security contract) and M1.2 (protected backend)
are committed and pushed. M1.3, the role-aware operator UI, is the next
unstarted local-only sub-goal. Its completion, M1 completion, M2 activation,
and every operational action each require separate explicit approval.

## Deliberately not implemented

- Media files, import/download tooling, media scanning, credentials, public/browser exposure, production infrastructure, and any production media migration.
- Liquidsoap/FFmpeg execution, playout, transitions, audio processing, encoders, Icecast/SHOUTcast, live-DJ audio, telemetry, listeners, relays, or current-system integration.

## Approved future architecture gates (roadmap only)

`docs/ROADMAP.md` records approved M4–M8 design gates for published schedule
artifacts, runtime/fault and automation-sandbox contracts, DSP ownership,
epoch-aware metadata failover, and evidence-based shadow acceptance. Its
sequential M1–M9 sub-goal convention and range-based calendar forecast are
planning tools only: they are not implemented capabilities and do not authorize
M1.3, M2–M9 work, or operational activity.

## Validation record

The latest safe M1 backend validation ran locally on 2026-08-03:

```bash
npm run check
git diff --check
```

Result: passed. Formatting, ESLint, strict TypeScript, 29 Node tests,
dependency audit (0 high-or-higher findings), and public-repository hygiene
passed. The test runner no longer requires Node's experimental SQLite flag;
SQLite remains absent from the live M1 application path.

The M0 validation run on 2026-08-03 used Node v22.22.1 and npm 9.2.0:

```bash
npm run check
```

Result: passed. Prettier, ESLint, TypeScript strict checking, six Node tests (three domain, two API, one UI), `npm audit --audit-level=high` (0 vulnerabilities), and staged/trackable-file hygiene all passed.

An additional process-level smoke test started `npm run start` on `127.0.0.1:31987` with an ignored local SQLite file. `GET /readyz` returned `{"status":"ready"}` and `GET /api/v1/stations` returned five stations, each with runtime status `unavailable`.

No M1 migration has been executed. The UpCloud development VM is provisioned
for later container validation, but no application/database/stream service is
exposed publicly.
