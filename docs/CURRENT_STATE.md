# Current State

## M3 local-only foundation — implemented and committed; operational activation pending

M3 is implemented locally under the explicit M3 approval and committed on the
authoritative branch. The [M3.1 media intake and immutable asset-lifecycle
contract](M3.1_MEDIA_INTAKE_AND_IMMUTABLE_ASSET_LIFECYCLE_CONTRACT.md)
established the planning boundary and [M3.2 additive PostgreSQL persistence and
migration design](M3.2_ADDITIVE_POSTGRESQL_PERSISTENCE_AND_MIGRATION_DESIGN.md)
remains decision-only. The completed local-only [M3.3 safe source-reference
and quarantine boundary](M3.3_SAFE_SOURCE_REFERENCE_AND_QUARANTINE_BOUNDARY.md)
adds deterministic opaque-reference validation outcomes, quarantine/rejection
records, and explicit no-dispatch retry visibility. It authorizes no M3.4-or-
later work or operational action at its completion.
The completed local-only [M3.4 disabled async processing boundary](M3.4_DISABLED_ASYNC_PROCESSING_BOUNDARY.md)
adds station-scoped future-worker eligibility, resource-limit, idempotency,
failure/retry, and content-free evidence contracts. Its default dispatcher is
disabled and no M3.5-or-later work or operational action was authorized at its
completion.
The completed local-only [M3.5 EBU R128 normalization analysis contract](M3.5_EBU_R128_NORMALIZATION_ANALYSIS_CONTRACT.md)
adds disabled, deterministic fixture-preview request/result validation only; it
does not perform media measurement or gain application and authorizes no M3.6-
or-later work or operational action.
The completed local-only [M3.6 cue and fade analysis contract](M3.6_CUE_AND_FADE_ANALYSIS_CONTRACT.md)
adds disabled, deterministic fixture-preview cue/intro/outro/fade
recommendation validation only; it does not detect media cues or apply playout
settings and authorizes no M3.7-or-later work or operational action.
The completed local-only [M3.7 metadata enrichment and operator resolution contract](M3.7_METADATA_ENRICHMENT_AND_OPERATOR_RESOLUTION_CONTRACT.md)
adds disabled, deterministic fixture-candidate and append-only operator-
resolution validation only; it does not call providers, read tags, or publish
runtime/stream metadata and authorizes no M3.8-or-later work or operational
action.
The completed local-only [M3.8 visual Operator Dashboard shell](M3.8_VISUAL_OPERATOR_DASHBOARD_SHELL.md)
adds an accessible, responsive, station-context visual workspace for the four
planes, M3 lifecycle contract labels, fixture-only analysis/metadata status,
and the content-free evidence shape. It loads no media, source reference,
fixture candidate, audit event, or live operational-health data; its playout,
encoder, and listener-facing views are explicitly unavailable. It adds no
operational command path and authorizes no M3.9-or-later work or operational
action.
It adds a station-scoped, non-executing control-plane foundation for opaque
import requests/jobs; immutable asset revisions, provenance, analysis,
metadata-candidate, resolution, and failure records; deterministic EBU R128
and cue/fade contracts; and a provider-neutral, MusicBrainz-compatible
metadata boundary. The lifecycle is bounded:

`proposed → validated → approved_for_processing → processing → analyzed → metadata_pending → ready_for_schedule_use`

with `rejected`, `quarantined`, `failed`, and `superseded` branches. Readiness
does not publish a schedule, make an asset runtime-available, or authorize M4
or M5. Underlying M3 APIs retain their scoped, non-dispatching validation and
authorization contracts; the M3.8 dashboard shell itself visualizes only
content-free contract status and never starts a worker.

`003_m3_asset_lifecycle.sql` is an additive PostgreSQL migration registered in
the existing ordered migration runner but has **not** been executed. It uses
same-station composite foreign keys, lifecycle triggers, idempotency keys, and
append-only revision/result/candidate/resolution records. The only processing
implementation is an injectable deterministic fixture boundary: it has no
filesystem, subprocess, network, media-tool, schedule, runtime, encoder,
relay, or Icecast capability. No media/title/artist/path/tag/payload/provider
data is logged or audited.

No migration, database connection, container, application process, worker,
media ingestion, external provider call, playout, encoder, relay, stream, or
deployment was performed for M3. Staging activation of the M3 schema or any
future worker requires a new explicit owner approval and evidence for reviewed
commit/migration identity, least-privilege role scope, station isolation,
empty/non-production input boundary, sandbox limits, inactive runtime/encoder/
Icecast planes, rollback/stop conditions, and content-free verification. See
[the M3 implementation and authorization record](M3_IMPLEMENTATION_AND_AUTHORIZATION_RECORD.md).
The next unstarted item is separately approval-gated **M3.9 — isolation,
idempotency, failure, and recovery validation**.

## M1 complete — 2026-08-04 UTC

- Node 22 / TypeScript control-plane scaffold with strict type checking.
- PostgreSQL Compose foundation, versioned M1 schema migration, and idempotent stable-ID station seed.
- Separate migrator/runtime database connection variables; runtime startup rejects SQLite fallback.
- Scrypt password-hash/session primitives, station-scoped role helpers, content-free audit schema, and deterministic programming dry-run domain logic.
- Protected, PostgreSQL-backed programming routes for all seven M1 entity families, with scoped CRUD dispatch, CSRF/RBAC checks, safe errors, and content-free rejection/mutation audits.
- Complete-state update validation for media, playlists, separation rules, rotations, clocks, program blocks, and scheduled events; retained and replacement references are checked in PostgreSQL against the selected station.
- Loopback-only HTTP server with liveness, readiness, version, and station-read endpoints.
- Role-aware browser local sign-in/out and protected station context. M3.8
  presents the accepted M1/M3 boundaries through a read-only visual dashboard;
  the existing protected programming CRUD routes and deterministic dry-run
  contract remain separate from schedule publication or runtime execution.
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
No application, runtime, listener-facing, or production action occurred under
M2. The subsequent M3 local-only implementation is separately authorized and
does not alter the accepted M2 staging posture.

M2.5 **Operational-Authorization Decision Packet** is finalized as a
decision-only governance record. It records the accepted M2 posture and the
future owner gates for any separately scoped staging action; it creates no
standing authorization and performed no staging operation. The subsequent M3
local implementation does not create standing authorization for any staging or
operational action.

The M2.2 least-privilege [role-and-grant artifact](M2.2_STAGING_ROLE_AND_GRANT_ARTIFACT.sql)
was applied in the approved phases required for migration and runtime-boundary
validation. M2.4 adds a separate, fail-closed
[backup-authority artifact](M2.4_STAGING_BACKUP_AUTHORITY.sql) for the
logical-export identity only. It creates no restore capability and does not
authorize application activation.

## M2 acceptance boundary

M2 acceptance records only the non-public staging persistence and DR outcome.
It does not claim application activation, browser validation, runtime work, or
listener-facing readiness. M3 local implementation was later separately
approved; any staging activation remains independently approval-gated.

## Deliberately not implemented

- Media files, upload/download tooling, media scanning, credentials, public exposure, production infrastructure, and any production media migration.
- Worker/container/subprocess launch; FFmpeg or other media-tool execution; external provider calls; playout, transitions, applied DSP, encoders, Icecast/SHOUTcast, live-DJ audio, telemetry, listeners, relays, or current-system integration.
- M4 schedule publication/versioning, M5 runtime/DSP execution, and M7 source-encoder or listener-facing work.

## Approved future architecture gates (roadmap only)

`docs/ROADMAP.md` records approved M4–M8 design gates for published schedule
artifacts, runtime/fault and automation-sandbox contracts, DSP ownership,
epoch-aware metadata failover, and evidence-based shadow acceptance. Its
sequential M1–M9 approval-gate policy and range-based calendar forecast are
planning tools only: they are not implemented capabilities and do not authorize
M4–M9 work or operational activity. M3 is limited to the local-only foundation
recorded above and remains non-operational.

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
