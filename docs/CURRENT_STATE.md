# Current State

## M1 complete — 2026-08-04 UTC

- Node 22 / TypeScript control-plane scaffold with strict type checking.
- PostgreSQL Compose foundation, versioned M1 schema migration, and idempotent stable-ID station seed.
- Separate migrator/runtime database connection variables; runtime startup rejects SQLite fallback.
- Scrypt password-hash/session primitives, station-scoped role helpers, content-free audit schema, and deterministic programming dry-run domain logic.
- Protected, PostgreSQL-backed programming routes for all seven M1 entity families, with scoped CRUD dispatch, CSRF/RBAC checks, safe errors, and content-free rejection/mutation audits.
- Complete-state update validation for media, playlists, separation rules, rotations, clocks, program blocks, and scheduled events; retained and replacement references are checked in PostgreSQL against the selected station.
- Loopback-only HTTP server with liveness, readiness, version, and station-read endpoints.
- Role-aware browser operator UI with local bootstrap/login/logout, protected
  station context, programming CRUD workflows, explicit safe UI states, and
  deterministic read-only dry-run preview.
- Versioned domain contracts and explicit writer ownership for configuration versus future runtime observations.
- Repository hygiene, dependency audit, formatting, lint, type, domain, API, and UI checks.

M1.1 (foundations/persistence/security contract), M1.2 (protected backend),
and M1.3 (role-aware operator UI) were completed, committed, and pushed on
2026-08-03; M1.3 evidence is `9772b69`. M1.4 local-only acceptance evidence
passed and M1 is formally complete as of 2026-08-04 UTC. M2.1 planning is
complete. M2.2 migration/seed, post-migration least-privilege validation, and
M2.3 read-only topology validation completed under separately approved staging
gates. PostgreSQL remains the sole loopback-only running staging service; no
application, runtime, media, or listener-facing service has been activated.

M2.2 **Migration Execution Plan** documentation is published as `2cd85c3`;
the approved migration and idempotent five-station seed completed with
content-free evidence. M2.3 **Topology Validation Plan** documentation is
published as `be6a242`; its approved topology validation completed with
content-free evidence. M2.4 **Backup, Restore, and DR Plan** documentation is
published as `c8d5904`; its executable logical custom-archive backup contract
and separate backup-authority artifact are versioned. One approved staging
backup completed archive parsing, SHA-256/manifest verification, and retention
validation with content-free evidence `m2-backup-20260804T202301068Z-8a1a86fc408de506`.
The isolated recovery-target/restore contract is locally implemented and
published. On 2026-08-04 UTC, its one approved disposable-target restore
rehearsal passed archive attribution, recovery validation, station isolation,
least-privilege, RPO, RTO, and cleanup checks with content-free evidence
`m2-restore-20260804T211341391Z-33b489dab2be47b7`. M2 is formally accepted
as of 2026-08-04 UTC for staging persistence and DR readiness; the bounded
decision record is [M2 acceptance and staging-readiness decision](M2_ACCEPTANCE_AND_STAGING_READINESS_DECISION.md).
No application, runtime, listener-facing, production, or M3 action has
occurred or is authorized.

M2.5 **Operational-Authorization Decision Packet** is finalized as a
decision-only governance record. It records the accepted M2 posture and the
future owner gates for any separately scoped staging action; it creates no
standing authorization and performed no staging operation. M3.1 planning
remains separately approval-gated.

The M2.2 least-privilege [role-and-grant artifact](M2.2_STAGING_ROLE_AND_GRANT_ARTIFACT.sql)
was applied in the approved phases required for migration and runtime-boundary
validation. M2.4 adds a separate, fail-closed
[backup-authority artifact](M2.4_STAGING_BACKUP_AUTHORITY.sql) for the
logical-export identity only. It creates no restore capability and does not
authorize application activation.

## M2 acceptance boundary

M2 acceptance records only the non-public staging persistence and DR outcome.
It does not claim application activation, browser validation, runtime work, or
listener-facing readiness. The next permissible work is M3.1 planning only,
after separate explicit approval.

## Deliberately not implemented

- Media files, import/download tooling, media scanning, credentials, public/browser exposure, production infrastructure, and any production media migration.
- Liquidsoap/FFmpeg execution, playout, transitions, audio processing, encoders, Icecast/SHOUTcast, live-DJ audio, telemetry, listeners, relays, or current-system integration.

## Approved future architecture gates (roadmap only)

`docs/ROADMAP.md` records approved M4–M8 design gates for published schedule
artifacts, runtime/fault and automation-sandbox contracts, DSP ownership,
epoch-aware metadata failover, and evidence-based shadow acceptance. Its
sequential M1–M9 approval-gate policy and range-based calendar forecast are
planning tools only: they are not implemented capabilities and do not authorize
M3–M9 work or operational activity.

## M1.4 local-only acceptance record

The M1.4 acceptance pass ran locally on 2026-08-03 without a migration,
container, service, VM, media, or runtime action. Evidence includes:

- protected CRUD, role/station/CSRF/session, safe-error, and content-free audit
  coverage for the seven station-scoped programming families;
- deterministic, read-only dry-run coverage; and
- acceptance assertions that the live composition is PostgreSQL-only, excludes
  `m1-store`, and exposes no approval, publication, execution, media-ingestion,
  runtime, encoder, relay, or listener-facing control.

```bash
npm run check
git diff --check
```

Result: passed. Formatting, ESLint, strict TypeScript, 32 Node tests,
dependency audit (0 high-or-higher findings), and public-repository hygiene
passed. This evidence supports the formal M1 completion recorded above. M2
remains separately approval-gated.

Verified limitation, not an M1 defect: this pass uses injected route/repository
fixtures and rendered-UI assertions. A browser walkthrough against an applied
PostgreSQL database is deliberately deferred to M2 because M1.4 does not
authorize migrations, services, or infrastructure validation.

## Prior validation record

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

The historical M0 local-only record above predates M2. The M1 migration was
subsequently applied only in approved isolated staging; active staging remains
non-public and PostgreSQL-only. No application or stream service is exposed
publicly.
