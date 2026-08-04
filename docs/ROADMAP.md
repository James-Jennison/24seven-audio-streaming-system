# 24Seven.FM Audio Streaming System roadmap

Updated August 3, 2026 after reconciling the published M0 baseline, committed
M1.1/M1.2 evidence, architecture and ADRs, package scripts, migration assets,
and current tests. This is the authoritative implementation sequence; it is a
planning document, not authorization to execute an operational step.

## Purpose and success criteria

24Seven.FM needs a Linux-native, self-hosted replacement for the relevant
operational roles of SAM Pro/SAM Broadcaster and SHOUTcast 1.9.8 across five
stations: StreamingSoundtracks, 1980s.FM, Adagio.FM, Death.FM, and Entranced.FM.

Success is not merely a replacement stream. It is a securely operated,
station-isolated system with durable programming, a separately supervised
playout path, recoverable outputs, truthful runtime observation, compliant
reporting, documented operator handoffs, and a reversible listener cutover.
The final system must demonstrate usable audio and metadata parity in a
parallel period before it is allowed to replace the legacy listener path.

## State vocabulary, sub-goals, and planning estimates

- **Complete** — committed, validated evidence reached the stated acceptance
  gate. A later regression creates new work; it does not rewrite history.
- **In progress** — explicitly authorized work is underway but not yet complete
  or approved for release.
- **Approval-gated** — a human decision, credential, operational plan, or
  isolated environment is required before work may begin.
- **Planned** — dependency-ordered work that has not yet reached its gate.
- **Deferred** — deliberately outside the cutover path unless separately
  authorized.

### Sub-goal convention

Sub-goals are sequential internal work packages under a milestone, named
`M1.1`, `M1.2`, and so on. Each states its objective, strict boundary/non-goals,
required acceptance evidence, and the explicit approval required before the
next sub-goal. Completion of a sub-goal does **not** authorize the next
sub-goal, the next milestone, deployment, infrastructure activity, runtime
execution, or production changes. M1–M9 remain the authoritative milestone
sequence and primary approval gates; completed evidence is not renumbered or
invalidated.

### Completion-record convention

Every open sub-goal and milestone has a forecast completion window. Once it is
accepted, replace that forecast with an actual UTC completion date in
`YYYY-MM-DD` form and cite the bounded evidence record (commit(s), validation,
and owner acceptance where required). Update the associated milestone roll-up,
critical-path forecast, and `docs/CURRENT_STATE.md` in the same documentation
change. A documentation commit alone never marks implementation complete;
completion requires the sub-goal's stated evidence and approval. Historical
actual dates remain in the ledger rather than being overwritten by a reforecast.

### Planning estimates

The estimates below are planning ranges, not deadlines or authorization. They
assume one primary owner/developer assisted by Codex for coding, test writing,
documentation, and review preparation. **Focused engineering effort** excludes
approval waits; **elapsed duration** begins only after the named sub-goal is
explicitly approved and includes review, debugging, infrastructure coordination,
listening evaluation, and required safe observation windows. Human approvals,
credentials, rights decisions, staging readiness, provider/network decisions,
and hands-on audio/listening acceptance are external dependencies, not assumed
engineering capacity. Recalibrate estimates at every approved sub-goal boundary.
No estimate authorizes implementation, deployment, infrastructure changes, or
progression without explicit approval. Individual sub-goal effort/elapsed
ranges roll up into their milestone's calendar window below; the calendar is a
forecast of sequential approval outcomes, not permission to overlap milestones.

## Governing constraints

These constraints apply to every milestone and override convenience,
schedule pressure, or feature scope.

1. Keep the **Programming Control Plane**, **Playout & Automation Runtime**,
   **Source Encoder Layer**, and **Listener-Facing Icecast Layer** strictly
   decoupled and separately deployable.
2. Programming state transitions are exactly:
   **Proposed / Preview (Dry-Run) → Approved → Published (Versioned) →
   Executed (Runtime)**. No state may be skipped or inferred from a UI action.
3. A UI or API programming action must never implicitly ingest media, alter
   playout, execute schedules, change encoders, or operate relays/streams.
4. PostgreSQL is the sole live persistence store. Icecast 2.x is the sole
   future listener-facing streaming platform.
5. SQLite, PAL, SAM binaries, and legacy SHOUTcast dependencies must never
   become live-path dependencies.
6. Enforce station isolation everywhere. Every station-scoped entity, query,
   mutation, authorization check, and reference uses both `id` and
   `station_id`. Cross-station references fail as
   `station_reference_forbidden`; missing or out-of-scope resources return
   `not_found` without revealing existence.
7. Audit records are content-free. They may contain only action types, entity
   IDs, station IDs, actor IDs, timestamps, and safe outcome metadata. They
   never contain titles, filenames, programming payloads, credentials, session
   tokens, CSRF values, or raw SQL/database details.
8. Control-plane HTTP mutations must never directly signal audio devices,
   playout processes, encoders, relays, or stream mounts.
9. Maintain strict TypeScript, ESLint, formatting, dependency-audit, and
   safe-error-handling standards through `npm run check`.

## Where we are now

The published baseline is M0 at `2fa02a1`, followed by roadmap commit
`8fea092`. M1.1/M1.2 implementation evidence is committed and pushed in
`1f84acc`, with the accompanying architecture-gate documentation in `832810f`.
M1.3 is the next unstarted local-only implementation sub-goal. No migration,
Docker/Compose invocation, service startup, deployment, runtime/stream action,
or production-system action is authorized by this roadmap.

| Area                       | Evidence in the current worktree                                                                                                        | State                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Live persistence direction | `PostgresPersistence`, `PostgresM1Repositories`, separate runtime/migrator URLs, loopback Compose asset, and `002_m1_control_plane.sql` | M1.1 complete; migration remains unapplied             |
| Identity and authorization | scrypt hashing, server-session primitives, roles/station grants, bootstrap/login/logout adapters, and CSRF/session helpers              | M1.1/M1.2 complete locally and pushed                  |
| Programming model          | Station-scoped media, playlists, separation rules, rotations, clocks, program blocks, and scheduled events                              | M1.1/M1.2 complete locally and pushed                  |
| API boundary               | Protected programming adapter, safe error mapping, authenticated dry-run route, and negative-path coverage                              | M1.2 complete and pushed                               |
| Update validation          | All seven entity families use scoped load/merge/validate/persist paths; retained and replacement references are SQL-scoped              | M1.2 complete and pushed                               |
| UI                         | M1 state-rendering primitives exist; active browser UI remains the M0 status dashboard                                                  | M1.3 next, unstarted                                   |
| Validation                 | `npm run check` builds, lints, typechecks, runs 29 tests, audits dependencies, and runs hygiene                                         | M1.2 local evidence passed; M1.3/M1.4 evidence remains |
| Automation                 | No `.github` workflow is present                                                                                                        | Planned; local check remains the current gate          |

`m1-store` is a test double only and must never enter the live application
path. The test runner no longer requires Node's experimental SQLite flag, and
SQLite remains absent from the live M1 application path.

### Active M1 completion scope

M1.1 foundations/persistence/security and M1.2 protected backend are complete
and pushed. M1.3 is next: replace the status-only browser surface with the
authorized operator UI—bootstrap/login/logout, protected station context,
library/programming views, clear proposed-preview semantics, and explicit
loading, empty, forbidden, read-only, validation-error, and unavailable states.
It must not add an execution control. M1.4 is the later local-only acceptance
and completion recommendation; it cannot start without approval after M1.3.

## Remaining-work estimate table

This is a range-based planning forecast, not a launch date. Calendar windows
assume the next approval arrives promptly after the preceding acceptance; a
late gate shifts every dependent window. Elapsed ranges are sequential unless a
later gate explicitly permits otherwise; revise the critical path after each
approved sub-goal.

| Milestone      | Focused engineering effort    | Expected elapsed duration             | Indicative completion window | Confidence | Key dependency / approval gate                                                 |
| -------------- | ----------------------------- | ------------------------------------- | ---------------------------- | ---------- | ------------------------------------------------------------------------------ |
| M1 (M1.1–M1.4) | 3–6 weeks remaining           | 5–10 weeks remaining                  | September–November 2026      | Medium     | M1.3 UI approval, then M1 completion decision                                  |
| M2             | 4–8 weeks                     | 8–16 weeks                            | December 2026–March 2027     | Low        | Formal M1 acceptance; staging, credentials, migration and DR approval          |
| M3             | 8–14 weeks                    | 14–28 weeks                           | April–October 2027           | Low        | M2 evidence; rights manifest, approved paths, sandbox policy                   |
| M4             | 7–12 weeks                    | 10–20 weeks                           | July 2027–March 2028         | Medium     | M3 immutable asset handles; publication semantics approval                     |
| M5             | 16–28 weeks                   | 28–52 weeks                           | February 2028–May 2029       | Low        | M4 published artifact; isolated runtime/audio plan and listening evidence      |
| M6             | 5–9 weeks                     | 8–18 weeks                            | May–October 2029             | Medium     | M5 acceptance, M4 publication boundary, and public-input threat-model approval |
| M7             | 10–18 weeks                   | 18–36 weeks                           | October 2029–July 2030       | Low        | Approved runtime/PCM bus; private infrastructure and failover test approval    |
| M8             | 8–14 weeks plus observation   | 16–32 weeks plus observation          | August 2030–May 2031         | Low        | M7 private outputs; shadow plan and operator listening windows                 |
| M9             | 6–12 weeks plus stabilization | 12–28 weeks plus observation/rollback | June 2031–March 2032         | Low        | M8 evidence; cutover, compliance, DNS, and retirement approvals                |

## Completion ledger and forecast calendar

The ledger records completed work done on **2026-08-03** separately from
planning-only documentation. Forecast windows are rolling calendar ranges and
must be replaced with actual completion dates and evidence when each boundary
is accepted.

### Completed work

| Sub-goal                                             | Actual completion date | Evidence                                                        | Result                                                                                                                                       |
| ---------------------------------------------------- | ---------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| M1.1 — Foundations and persistence/security contract | 2026-08-03             | `1f84acc`; local validation recorded in `docs/CURRENT_STATE.md` | Complete and pushed; PostgreSQL-only foundation, station scope, identity/session, audit, and migration boundary established.                 |
| M1.2 — Protected backend                             | 2026-08-03             | `1f84acc`; 29 passing local tests and hygiene/audit evidence    | Complete and pushed; protected CRUD, complete-state SQL validation, safe errors, content-free audits, and deterministic dry run established. |
| Approved architecture-gate documentation             | 2026-08-03             | `832810f`                                                       | Roadmap-only M4–M8 design gates recorded; no runtime authorization.                                                                          |
| Sub-goal and estimate planning update                | 2026-08-03             | `7c56f50`                                                       | Roadmap-only convention and estimates recorded; no implementation authorization.                                                             |

### Forecast completion calendar

| Sub-goal                                                | Forecast completion window  | Status / completion-record trigger                                                                      |
| ------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| M1.3 — Role-aware operator UI                           | September–October 2026      | Next, unstarted; replace with actual date after local UI evidence and owner acceptance.                 |
| M1.4 — Local-only M1 acceptance decision                | October–November 2026       | Approval-gated; replace with actual date only after complete M1 evidence and completion recommendation. |
| M2.1 — Staging activation plan and rehearsal design     | November–December 2026      | Approval-gated; replace after owner-approved plan.                                                      |
| M2.2 — Staging PostgreSQL migration verification        | December 2026–January 2027  | Approval-gated; replace after approved staging migration evidence.                                      |
| M2.3 — Separately deployable staging topology           | January–February 2027       | Approval-gated; replace after topology-boundary validation.                                             |
| M2.4 — Backup, restore, and DR evidence                 | February–March 2027         | Approval-gated; replace after DR signoff recommendation.                                                |
| M3.1 — Media intake and immutable asset lifecycle       | April–May 2027              | Approval-gated; replace after lifecycle/rights acceptance.                                              |
| M3.2 — Sandboxed asynchronous ingestion worker          | May–June 2027               | Approval-gated; replace after worker-boundary evidence.                                                 |
| M3.3 — Offline analysis pipeline                        | June–August 2027            | Approval-gated; replace after repeatable analysis and listening review.                                 |
| M3.4 — Metadata/artwork/retry/quarantine acceptance     | August–October 2027         | Approval-gated; replace after provenance and lifecycle acceptance.                                      |
| M4.1 — Deterministic scheduling contract                | July–November 2027          | Approval-gated; replace after rules/test-corpus evidence.                                               |
| M4.2 — Station-scoped 24-hour compilation               | September 2027–January 2028 | Approval-gated; replace after deterministic compilation evidence.                                       |
| M4.3 — Published schedule artifact contract             | November 2027–February 2028 | Approval-gated; replace after artifact integrity/rollback evidence.                                     |
| M4.4 — Publication/rollback recommendation              | January–March 2028          | Approval-gated; replace after operator acceptance recommendation.                                       |
| M5.1 — Runtime architecture and fault-model gate        | February–April 2028         | Approval-gated; replace after owner-approved design/benchmark plan.                                     |
| M5.2 — Controlled shadow-runtime foundation             | May–August 2028             | Approval-gated; replace after supervisor/worker recovery evidence.                                      |
| M5.3 — Transition/deck/failure/rollback validation      | August–November 2028        | Approval-gated; replace after measured fault and transition evidence.                                   |
| M5.4 — DSP evaluation and acceptance                    | November 2028–February 2029 | Approval-gated; replace after capacity, license, and listening evidence.                                |
| M5.5 — WASM-first automation sandbox                    | February–April 2029         | Approval-gated; replace after security/regression evidence.                                             |
| M5.6 — M5 acceptance decision                           | April–May 2029              | Approval-gated; replace after owner runtime/listening signoff.                                          |
| M6.1 — Request/listener-message contract                | May–June 2029               | Approval-gated; replace after threat/privacy acceptance.                                                |
| M6.2 — Approved intake and eligibility controls         | June–July 2029              | Approval-gated; replace after abuse/rate-limit evidence.                                                |
| M6.3 — Operator moderation and presentation             | July–August 2029            | Approval-gated; replace after role/audit/operator evidence.                                             |
| M6.4 — Safe future-slot proposal insertion              | August–September 2029       | Approval-gated; replace after publication/separation proof.                                             |
| M6.5 — Security/load/abuse acceptance                   | September–October 2029      | Approval-gated; replace after owner acceptance recommendation.                                          |
| M7.1 — Source encoder/PCM-bus design                    | October–November 2029       | Approval-gated; replace after boundary/profile approval.                                                |
| M7.2 — Icecast topology validation plan                 | November 2029–January 2030  | Approval-gated; replace after private infrastructure plan approval.                                     |
| M7.3 — Processed PCM fan-out and codecs                 | January–March 2030          | Approval-gated; replace after private codec/output evidence.                                            |
| M7.4 — Epoch-aware metadata distribution                | March–May 2030              | Approval-gated; replace after epoch/failover evidence.                                                  |
| M7.5 — Source/failover listener evidence                | May–July 2030               | Approval-gated; replace after measured private listener validation.                                     |
| M8.1 — Shadow-operation plan and parity definition      | August–September 2030       | Approval-gated; replace after owner-approved observation plan.                                          |
| M8.2 — Measurement collection                           | September–November 2030     | Approval-gated; replace after reproducible comparison evidence.                                         |
| M8.3 — Controlled failure drills                        | December 2030–February 2031 | Approval-gated; replace after timed drill/recovery evidence.                                            |
| M8.4 — Operator listening/parity/cutover recommendation | February–May 2031           | Approval-gated; replace after signed evidence pack.                                                     |
| M9.1 — Guarded cutover and rollback plan                | June–July 2031              | Approval-gated; replace after plan/rehearsal approval.                                                  |
| M9.2 — Compliance and operational-readiness validation  | July–August 2031            | Approval-gated; replace after reconciliation/readiness evidence.                                        |
| M9.3 — Phased DNS/listener cutover                      | September–October 2031      | Approval-gated; replace only after the authorized cutover window closes.                                |
| M9.4 — Post-cutover stability/compliance verification   | October–December 2031       | Approval-gated; replace after observation/rollback period acceptance.                                   |
| M9.5 — Legacy decommissioning and closeout              | January–March 2032          | Approval-gated; replace only after separate retirement approval.                                        |

## Phase 1 — M1: Programming Control Plane and Security Baseline

### Objective

Turn the current local M1 foundation into a secure, PostgreSQL-only
programming-control plane with no capability to execute audio work.

### In scope

- Complete persistence contracts for users, roles/station grants, sessions,
  bootstrap state, content-free audit queries, and all seven programming
  entities.
- Enforce id-plus-station SQL scope for list/read/create/update/delete and all
  foreign references. Implement complete-state validation on every partial
  update.
- Finish one-time owner bootstrap, server-side session expiry/revocation,
  secure local-development cookies, CSRF issuance/validation, and content-free
  outcomes for authentication, CSRF, authorization, and programming changes.
- Finish protected CRUD and deterministic dry-run APIs with safe, consistent
  error contracts.
- Build the role-aware, station-scoped operator UI with no hidden execution
  affordance and explicit unavailable-runtime status.
- Preserve the completed retirement of SQLite from the live application path;
  add migration-safe PostgreSQL adapter tests and no-migration HTTP/UI tests.
- Document the API, bootstrap procedure, local-only operation, and the
  unexecuted-migration boundary. Add CI only under a separate publication/
  workflow authorization.

### Sub-goals and approval sequence

**M1.1 — Foundations and persistence/security contract — Complete.** Objective:
establish PostgreSQL-only composition, station-scoped contracts, identity,
sessions, and audit boundaries. Boundary: no migration or operational service.
Evidence: committed schema, repositories, Compose boundary, and local checks.
Completed **2026-08-03**; evidence `1f84acc`. Completion did not authorize
M1.2 or operational activity.

**M1.2 — Protected backend — Complete.** Objective: secure scoped CRUD,
complete-state SQL validation, safe errors, content-free audits, and
deterministic dry-run behavior. Boundary: no operator UI, migration, runtime,
or media action. Evidence: committed route/repository coverage and local
`npm run check`. Completed **2026-08-03**; evidence `1f84acc`. Completion did
not authorize M1.3.

**M1.3 — Role-aware operator UI — Next, unstarted.** Objective: connect
proposal, dry-run preview, approval, published-state, and safe-status views to
the protected API, enforcing role capability and station isolation in every
screen/action. Boundary: no hidden mutation or execution control; no media
ingestion, playout, encoder, stream, relay, or runtime control. Evidence:
local UI/API integration, authorization/CSRF/error-path coverage,
accessibility/usability review, and content-free audit verification. Gate:
explicit approval of M1.3 local-only implementation. Estimate: **2–4 weeks**
focused effort, **3–7 weeks** elapsed, **medium** confidence; depends on stable
M1.2 API contracts and owner UI review.

**M1.4 — Local-only M1 end-to-end acceptance and completion decision — Future,
approval-gated.** Objective: re-run complete local functional/security evidence
and verify the `Proposed → Approved → Published` boundary without runtime
execution. Boundary: no migration, deployment, runtime, or automatic advance
to M2. Evidence: full local validation, role/station/CSRF/audit evidence,
manual operator-path review, and an M1 completion recommendation. Gate:
separate approval after M1.3; advancing to M2 needs a further explicit M2
approval. Estimate: **1–2 weeks** focused effort, **2–3 weeks** elapsed,
**high** confidence; depends on accepted M1.3 evidence.

### Out of scope

Running a migration, Compose/container startup, real media, media import,
audio decoding, schedule execution, Liquidsoap/FFmpeg, Icecast/SHOUTcast,
public access, or any production/VM action.

### Deliverables and acceptance evidence

- A reviewed M1 change set where `PostgresM1Repositories`, not `m1-store`, is
  the only live composition path.
- Complete protected API and UI tests covering all roles, five-station
  boundaries, CSRF/session failures, safe error handling, complete-state
  validation, dry-run determinism, and content-free audits.
- `npm run check`, `git diff --check`, migration-safe repository assertions,
  and manual local UI review all pass. No test executes a migration.
- Updated architecture, current-state, operator, API, and ADR material that
  does not claim an applied database or operating audio system.

### Risks and mitigations

- **False completeness from schema-first work:** require route, repository,
  UI, and negative-path evidence before M1 acceptance.
- **SQLite residue:** remove it from application behavior and make its test
  status explicit before accepting the PostgreSQL-only claim.
- **Auth leakage:** use generic failures, hash only server-side secrets, and
  test audit outputs for absence of sensitive/content values.

### Required human action and next gate

The owner must explicitly approve M1.3 before implementation. After M1.4 is
accepted, a separate approval must state:

> “Approve the M2 staging plan to execute the named PostgreSQL migration on
> the approved development environment, validate backup/restore, and keep all
> services non-public.”

Planning estimate: M1.3/M1.4 is summarized in the remaining-work table and
must be recalibrated after the M1.3 approval boundary.

## Phase 2 — M2: Persistence Activation, Staging Infrastructure, and DR

### Objective

Prove the PostgreSQL persistence path and operational recovery process in the
approved, non-production development environment before any media or audio
runtime work.

### In scope

- Execute the approved migration once on the named staging environment with a
  dedicated migration authority and a lower-privilege runtime role.
- Validate idempotent station seed, migrations ledger, database role grants,
  connection failure behavior, Compose reproducibility, loopback-only binding,
  and no public listener.
- Create tested backup, restore, point-in-time/recovery expectations, retention
  policy, restore drill, and operator runbook. Record only non-sensitive
  environment facts.
- Add integration tests that use the staging database only when explicitly
  authorized; retain fast local fakes for ordinary tests.

### Sub-goals and approval sequence

**M2.1 — Staging activation plan and rehearsal design — Future,
approval-gated.** Objective: define the named staging plan, secrets and
migrator/runtime role boundary, abort conditions, and migration rehearsal.
Boundary: no connection, migration, or service start. Evidence: owner-reviewed
plan, non-sensitive role/secret handling, backup and rollback design. Gate:
formal M1 acceptance plus explicit M2.1 approval. Estimate: **1–2 weeks**
focused effort, **2–4 weeks** elapsed, **medium** confidence; depends on
staging readiness and owner decisions.

**M2.2 — Staging PostgreSQL migration execution and verification — Future,
approval-gated.** Objective: execute the approved migration once in isolated
staging and verify roles, seed, schema, and application behavior. Boundary: no
production database or public service. Evidence: migration ledger, least-
privilege verification, five-station and auth/programming integrity checks.
Gate: explicit named migration-execution approval after M2.1. Estimate:
**1–2 weeks** focused effort, **2–5 weeks** elapsed, **low** confidence;
depends on canonical access, credentials, extension privileges, and abort plan.

**M2.3 — Separately deployable staging topology — Future, approval-gated.**
Objective: validate the Compose topology and control-plane/database boundary.
Boundary: non-public staging only; no audio, stream, or production action.
Evidence: repeatable bounded topology, loopback/network checks, service-role
separation, and recovery-safe failure tests. Gate: explicit topology-validation
approval after M2.2. Estimate: **1–2 weeks** focused effort, **2–4 weeks**
elapsed, **medium** confidence; depends on staging capacity and M2.2 evidence.

**M2.4 — Backup, restore, and DR evidence — Future, approval-gated.**
Objective: automate backup/restore evidence and produce recovery-time/recovery-
point and DR signoff recommendation. Boundary: isolated staging data only.
Evidence: timed restore drill, integrity checks, documented retention/rollback,
and owner-reviewed recommendation. Gate: explicit DR-drill approval after
M2.3. Estimate: **1–3 weeks** focused effort, **2–6 weeks** elapsed, **low**
confidence; depends on storage/backup tooling and restore observations.

### Out of scope

Production database access, source-media access, test-media import, audio
runtime, encoder/Icecast operation, public HTTP(S), or production DNS/firewall
changes.

### Acceptance evidence

- Migration identity, runtime identity, and permissions are independently
  verified; runtime cannot alter schema.
- A backup made after seed can be restored into an isolated target and passes
  schema, five-station, login/session, and programming-data integrity checks.
- The rollback procedure is timed, documented, and owner-reviewed. No public
  port is opened.

### Risks, dependencies, and next gate

This depends on owner-provided staging approval, canonical SSH access,
credentials managed outside the repository, and storage/backup decisions.
Extension privileges (including `pgcrypto`) and restore duration may require
schema or role adjustments. Mitigate with a rehearsal on disposable staging
data and an abort plan before applying anything.

The owner must explicitly approve the M3 asset plan:

> “Approve the fixed rights manifest, authorized media locations, sandboxed
> import design, and retention/deletion policy for isolated M3 test assets.”

Planning estimate: M2 ranges appear in the remaining-work table and are
recalibrated after each approved staging/DR sub-goal.

## Phase 3 — M3: Media Ingestion, Metadata, and Asset Lifecycle

### Objective

Create a safe, rights-aware asset lifecycle that operates with an empty
library by default and never touches the existing Windows production library.

### In scope

- Fixed, hand-reviewed manifests for exactly 50 complete, unique MP3s per
  station format (250 total) with source page, direct URL, attribution,
  CC0/CC-BY/public-domain license, and station-fit reason.
- Explicit genre acceptance for cinematic score, authentic 1980s synth/new
  wave, slow lyrical classical, death-metal variants, and melodic/uplifting/
  progressive/psytrance respectively; reject stems, loops, effects, generic
  EDM/metal/noise, and out-of-format substitutes.
- Async, idempotent import jobs using approved staging paths only; checksums,
  quarantine, lifecycle transitions, extraction, validation, provenance, and
  operator-visible failures.
- Sandboxed FFmpeg-based analysis for duration, EBU R128 measurement,
  cue/fade candidates, and bounded metadata enrichment such as MusicBrainz
  where licensing/API terms permit it. Results are proposed metadata pending
  review, not hidden programming changes.

### Sub-goals and approval sequence

**M3.1 — Media intake and immutable asset lifecycle — Future, approval-gated.**
Objective: define station-scoped intake, immutable handles, provenance, and
quarantine/lifecycle rules. Boundary: no production-library access or arbitrary
source paths in programming payloads. Evidence: reviewed lifecycle/rights
contract and station/quarantine test corpus. Gate: explicit M3.1 approval after
M2. Estimate: **1–2 weeks** focused effort, **2–4 weeks** elapsed, **medium**
confidence; depends on approved paths and rights policy.

**M3.2 — Sandboxed asynchronous ingestion worker — Future, approval-gated.**
Objective: create an idempotent processing-worker boundary with no programming
or runtime authority. Boundary: no playout execution or automatic programming
change. Evidence: job/idempotency, failure, duplicate, sandbox, and quarantine
tests. Gate: explicit worker-implementation approval after M3.1. Estimate:
**2–4 weeks** focused effort, **4–8 weeks** elapsed, **medium** confidence;
depends on M3.1 and approved isolated paths.

**M3.3 — Offline analysis pipeline — Future, approval-gated.** Objective:
measure EBU R128 integrated loudness/loudness range, true peak, silence,
cue/fade candidates, and recommended gain. Boundary: analysis is offline and
does not execute playout or alter programming. Evidence: repeatable fixture
measurements, bounded failure behavior, and listening-reviewed candidates.
Gate: explicit analysis approval after M3.2. Estimate: **2–4 weeks** focused
effort, **4–8 weeks** elapsed, **medium** confidence; depends on approved
assets and tooling evaluation.

**M3.4 — Metadata, artwork, retry/quarantine, and lifecycle acceptance —
Future, approval-gated.** Objective: complete enrichment and asset-handling
behavior with safe retry/quarantine evidence. Boundary: no broad archive search
or implicit media publication. Evidence: provenance/attribution review,
failure/retry tests, and owner-reviewed representatives for every format. Gate:
explicit M3 acceptance approval after M3.3. Estimate: **3–5 weeks** focused
effort, **4–10 weeks** elapsed, **low** confidence; rights and curation are
external critical dependencies.

### Out of scope

Any scan, copy, move, delete, or modification of the physical Windows server
or its media library; broad archive searching/downloading; public streaming;
or running imported files through playout.

### Acceptance evidence

- Rights and attribution manifest review by the owner; no media is committed
  to the repository.
- Import failure, duplicate, malformed-file, sandbox escape, license-missing,
  and rollback/quarantine tests pass.
- At least one manually reviewed representative from each station format has
  correct lifecycle/provenance and analysis evidence; full catalog completion
  remains owner-curated, not automated discovery.

### Risks, dependencies, and next gate

Rights verification and musical fit are human decisions and can dominate the
calendar. FFmpeg/LUFS/fade heuristics must be reviewed by listening, not
treated as editorial truth. Keep an empty-library path so a curation delay does
not block M4 control-plane work unnecessarily.

Next gate:

> “Approve M4 publication semantics: approved programming may create a
> versioned schedule artifact, but publication must not execute it.”

Planning estimate: M3 is **8–14 weeks** focused effort and **14–28 weeks**
elapsed, with an indicative completion range of **April–October 2027** if its
preceding approval gates close promptly. Recalibrate after each sub-goal.

## Phase 4 — M4: Advanced Scheduling and Versioned Publication

### Objective

Turn programming data into explainable, deterministic, versioned schedule
artifacts without signalling a runtime.

### In scope

- A deterministic 24-hour planning engine that resolves clocks, program
  blocks, rotations, categories, station time zones, separation rules, and
  scheduled events.
- A distinct approval workflow: preview/dry-run proposal, human approval,
  immutable published schedule version, and later runtime execution receipt.
- Explainable eligibility/exclusion reasons, seedable deterministic outputs,
  validation of schedule gaps/conflicts, version comparison, publication
  history, atomic rollback to a previous version, and content-free audit
  records.
- Simulation/property tests across all stations, DST boundaries, empty and
  constrained libraries, malformed programming, repeatability, and rollback.

### Sub-goals and approval sequence

**M4.1 — Deterministic scheduling, clock, and separation contract — Future,
approval-gated.** Objective: define deterministic rules and a regression/property
test corpus for clocks, rotations, and separation. Boundary: no schedule
execution or runtime command. Evidence: station-isolated deterministic fixtures
and documented policy decisions. Gate: explicit M4.1 approval after M3. Estimate:
**1–3 weeks** focused effort, **2–5 weeks** elapsed, **medium** confidence;
depends on M3 handles and editorial policy.

**M4.2 — Station-scoped 24-hour compilation — Future, approval-gated.**
Objective: compile bounded daily schedules with conflict, gap, and explanation
behavior. Boundary: proposals only; no queue or playout mutation. Evidence:
repeatable 24-hour plans across DST, empty/constrained libraries, and safe
failure cases. Gate: explicit compilation approval after M4.1. Estimate:
**2–4 weeks** focused effort, **3–7 weeks** elapsed, **medium** confidence;
depends on validated M4.1 rules.

**M4.3 — Published schedule artifact contract — Future, approval-gated.**
Objective: fulfill the already-approved versioning, compatibility, integrity,
immutable-handle, atomic activation/rollback, and offline-runtime contract.
Boundary: publish artifacts only; no runtime activation or playout control.
Evidence: deterministic schema, integrity, compatibility, rollback, and
control-plane-unavailable tests. Gate: explicit publication-semantics approval
after M4.2. Estimate: **2–3 weeks** focused effort, **3–6 weeks** elapsed,
**medium** confidence; depends on immutable M3 media handles.

**M4.4 — Publication/rollback evidence and operator recommendation — Future,
approval-gated.** Objective: prove approval/publication/rollback workflows and
prepare the M5 acceptance recommendation. Boundary: no `Published → Executed`
transition. Evidence: operator review, version-history/audit evidence, and
safe failure/rollback tests. Gate: explicit M5 feasibility approval after
M4.4. Estimate: **1–2 weeks** focused effort, **2–4 weeks** elapsed, **high**
confidence; depends on M4.3 evidence.

### Published schedule artifact contract (approval-gated design deliverable)

- Define a deterministic, versioned runtime-consumable schedule-artifact
  schema, including publication revision and compatibility semantics and
  integrity verification before runtime use.
- Resolve media to immutable media handles when publishing. Programming
  payloads must never supply arbitrary filesystem paths to the runtime.
- Specify atomic artifact activation and rollback, plus offline-runtime
  behavior: during PostgreSQL/control-plane unavailability, a runtime may
  retain only its last verified published artifact and may not accept new
  programming.
- Permit runtime consumption only across the `Published → Executed` boundary.
  The runtime has read-only access to published artifacts and has no approval
  or publication authority.
- Prove the contract with deterministic-schema, compatibility, integrity,
  atomic-activation, rollback, and control-plane-unavailable tests. This is a
  control-plane design/acceptance deliverable; it does not require a live
  playout engine or stream execution.

### Out of scope

Direct queue writes, automatic playout, a time-triggered scheduler, runtime
commands, audio transitions, or listener-visible output.

### Acceptance evidence

- Repeating the same versioned inputs produces the same plan and explanation.
- A rejected/invalid plan cannot publish; a published plan cannot mutate in
  place; rollback is versioned and auditable.
- Human review confirms that dry-run and published views say "proposal" or
  "published artifact," never "on air" or "executing."
- The published-artifact contract proves that only verified, compatible,
  immutable-handle artifacts can be atomically activated or rolled back by a
  later read-only runtime.

### Risks, dependencies, and next gate

Real programming rules contain editorial edge cases. Resolve them as explicit
policy/configuration and regression fixtures, rather than hidden selection
logic. DST and empty-library behavior require owner decisions on fallback
policy.

Next gate:

> “Approve the M5 runtime feasibility decision and an isolated audio-test
> plan. No public output, production media, or listener traffic is included.”

Planning estimate: M4 is **7–12 weeks** focused effort and **10–20 weeks**
elapsed, with an indicative completion range of **July 2027–March 2028**.
Publication-artifact acceptance must precede all M5 runtime consumption.

## Phase 5 — M5: Playout Runtime, DSP, and Sandboxed Automation

### Objective

Introduce a separately supervised, test-only playout runtime that consumes
published schedule versions and emits truthful observations through a versioned
contract.

### In scope

- A technology-feasibility decision recorded in an ADR. The current preferred
  implementation is Liquidsoap for playout/transitions/encoding, with FFmpeg
  restricted to analysis and bounded fallback jobs.
- A native Rust/C++ component may supervise, bridge, or contain runtime
  contracts, but this milestone must **not** create a custom real-time DSP,
  codec, or playout engine without a new ADR and approval. The four-deck
  routing/DSP objective is a capability requirement, not permission to rebuild
  Liquidsoap.
- Process supervision, explicit command idempotency, runtime instance identity,
  sequence/freshness, crash recovery, state handoff, gaps/crossfades, loudness
  measurement, EQ/multiband compression/limiting evaluation, and failure
  behavior using approved isolated assets.
- A sandboxed WASM/JS automation surface only after baseline playout is stable:
  max 50 ms execution, 64 MB memory, no filesystem, process, network, or
  ambient I/O access; deterministic inputs/outputs; kill/timeout audit trail.
- Runtime-owned playback state, output-health observations, and auditable
  live-DJ takeover/priority/fallback state. The control plane remains a
  configuration writer, never a playback-state authority.

### Runtime architecture and fault-model gate (before implementation)

- Define "four decks" precisely: main and auxiliary responsibilities,
  cue/preview routing, overlap/crossfade behavior, interruption priority,
  voice-tracking insertion, and recovery after any deck or worker loss.
- Specify a local runtime command/IPC contract with idempotency,
  acknowledgements, timeouts, and crash-recovery semantics.
- Define measurable fault acceptance for worker crash, decoder stall, corrupt
  media, disk/media unavailability, silence detection, schedule-artifact
  rollback, CPU saturation, and worst-case overlapping decks. Benchmark using
  target sample rate, codecs, bitrates, and overlap conditions; measure
  internal processing/buffer latency separately from listener end-to-end
  streaming latency.
- The M5 baseline is a Rust runtime supervisor as the durable authority for
  verified published-artifact consumption, runtime state, health, recovery,
  watchdogs, safe telemetry, and authoritative metadata-event emission. An
  unprivileged, replaceable Liquidsoap worker may implement the initial shadow
  runtime/audio graph through a narrow local execution contract only; it has
  no PostgreSQL, control-plane, approval, or publication authority.
- A native Rust audio graph remains an evidence-based future decision, only if
  measurements show unacceptable transition accuracy, latency, CPU behavior,
  fault recovery, or required deck behavior. This gate is not authorization to
  introduce Rust runtime or Liquidsoap code during M1.

### WASM-first automation sandbox gate (before implementation)

- Start with no WASI and no filesystem, network, environment, clocks, process
  spawning, database access, or arbitrary host imports. Allow only a strict,
  bounded host-call allowlist.
- Require a pure-function model: `approved runtime context → bounded proposed
action(s) → runtime validation of allowlisted result`. The sandbox may not
  directly operate runtime components.
- Enforce a 50 ms maximum execution with deterministic fuel budgeting and a
  wall-clock interruption/watchdog. Set memory below the external 64 MB cap to
  retain host-overhead headroom, and bound instances, tables, memories, inputs,
  and outputs in a short-lived isolated lifecycle.
- Define trap, timeout, validation-failure, and content-free audit-safe error
  behavior, supported by a security and regression corpus. Arbitrary
  JavaScript is not the initial path; any future compatibility path requires a
  separate explicit decision and OS-level isolation design.

### DSP ownership and replaceable-component evaluation

- M3 measures integrated loudness, loudness range, true peak, silence/cue
  data, and recommended gain during ingestion. M5 applies stored per-track
  gain and transition-aware handling, then one shared station program-bus
  processor applies final EQ, conservative multiband processing when justified,
  and true-peak limiting before codec fan-out.
- M7 encodes that already-processed PCM bus into AAC-LC and MP3 variants; it
  does not independently re-master each output. FFmpeg filters, Liquidsoap
  facilities, and candidate processors such as `master_me` are replaceable
  components, never system authorities.
- A production component choice requires a bill-of-materials and
  license/package review, measured real-time headroom and worst-case overlap
  testing, normal sustained DSP/encoding load below approximately 50–60% of
  allocated capacity, and structured listening-test acceptance rather than a
  feature-list comparison.

### Sub-goals and approval sequence

**M5.1 — Runtime architecture and fault-model design gate — Future,
approval-gated.** Objective: close the approved four-deck, IPC,
supervisor/worker, recovery, benchmark, and fault-model design gate. Boundary:
no runtime implementation or audio process. Evidence: ADR/design review,
measurable benchmark/fault plan, and owner approval of the isolated test plan.
Gate: explicit M5.1 approval after M4. Estimate: **2–4 weeks** focused effort,
**4–8 weeks** elapsed, **low** confidence; depends on M4 artifacts and target
test environment decisions.

**M5.2 — Controlled shadow-runtime foundation — Future, approval-gated.**
Objective: implement the approved Rust-supervisor and unprivileged,
replaceable Liquidsoap-worker baseline. Boundary: narrow local contract only;
worker has no PostgreSQL, control-plane, approval, or publication authority.
Evidence: isolated supervisor/worker lifecycle, watchdog, health, and recovery
tests. Gate: explicit M5.2 approval after M5.1. Estimate: **4–7 weeks** focused
effort, **6–12 weeks** elapsed, **low** confidence; depends on approved tooling
and isolated assets.

**M5.3 — Transition, deck, cue/preview, failure, and rollback validation —
Future, approval-gated.** Objective: validate overlap/crossfade, voice-tracking,
interruption, silence, corrupt-media, and artifact-rollback behavior. Boundary:
offline shadow operation only. Evidence: fault drills, deck/transition metrics,
and recovery evidence. Gate: explicit M5.3 approval after M5.2. Estimate:
**3–6 weeks** focused effort, **6–12 weeks** elapsed, **low** confidence;
depends on realistic fixtures and hands-on evaluation.

**M5.4 — DSP evaluation and acceptance — Future, approval-gated.** Objective:
apply per-track gain/transition handling and evaluate one final shared station
processor before codec fan-out. Boundary: no automatic component choice or
per-codec re-mastering. Evidence: capacity below the documented load target,
BOM/license review, structured listening results, and measured true-peak
behavior. Gate: explicit DSP choice approval after M5.3. Estimate: **3–6 weeks**
focused effort, **6–14 weeks** elapsed, **low** confidence; subjective audio
approval may extend observation time.

**M5.5 — WASM-first automation sandbox — Future, approval-gated.** Objective:
implement the approved no-WASI, bounded-host-call, fuel/watchdog, memory, and
audit-safe sandbox contract. Boundary: no arbitrary JavaScript compatibility
path or direct runtime authority. Evidence: trap/timeout/limit/security corpus
and deterministic allowed-action validation. Gate: explicit sandbox approval
after baseline runtime safety. Estimate: **3–5 weeks** focused effort, **5–10
weeks** elapsed, **low** confidence; depends on M5.1 contract and security
review.

**M5.6 — M5 acceptance decision — Future, approval-gated.** Objective: assemble
measurable runtime, recovery, safety, quality, and capacity evidence. Boundary:
no listener-facing service or automatic advance to M6. Evidence: owner-signed
listening/fault/capacity review and accepted known limitations. Gate: separate
M6 approval after M5.6. Estimate: **1–2 weeks** focused effort, **2–6 weeks**
elapsed, **low** confidence; depends on successful subjective and measured
acceptance.

### Out of scope

Public listener delivery, Icecast listener service, production source media,
unbounded third-party scripts, direct PAL execution, or custom codec/DSP work
that bypasses the feasibility decision.

### Acceptance evidence

- Isolated listening tests cover transition quality, underrun/gap behavior,
  loudness consistency, crash/restart, malformed schedule, invalid script,
  source loss, live-input loss, and fallback to automation.
- Runtime/control-plane contracts reject wrong version/station/sequence and
  show unavailable/degraded rather than fabricated healthy state.
- Owner signs off on hands-on listening across representative material from all
  five formats; automated tests alone cannot close this milestone.
- The runtime design gate has documented deck, IPC, fault, benchmark, sandbox,
  component-license, capacity, and listening-test evidence before a component
  becomes a production choice.

### Risks, dependencies, and next gate

Audio quality and real-time reliability require more manual testing than
ordinary web work. Hardware/driver differences, Liquidsoap feature fit, and
script isolation may change the design. Keep the runtime offline and use fixed
assets until its error budget and observation contract are accepted.

Next gate:

> “Approve M6 request intake/moderation design and, if requested, the limited
> public-interface threat model. A public listener remains out of scope.”

Planning estimate: M5 is **16–28 weeks** focused effort and **28–52 weeks**
elapsed, with an indicative completion range of **February 2028–May 2029**.
Audio quality, capacity, and recovery evidence—not code completion—control the
range.

## Phase 6 — M6: Listener Requests and Moderation

### Objective

Provide a safe request lifecycle that produces proposed programming changes,
not direct playback actions.

### In scope

- Station-scoped rate limits, eligibility checks, duplicate/cooldown rules,
  abuse controls, moderation queue, operator decisions, and content-free audit
  events.
- Explicit request states from received through eligible/rejected/moderated to
  proposed future-schedule insertion; insertion still follows the M4 approval
  and publication state machine.
- A public-interface design only if separately approved: threat model, abuse
  response, privacy/retention policy, accessibility, monitoring, and safe
  unavailable/error states.

### Sub-goals and approval sequence

**M6.1 — Request/listener-message contract and abuse model — Future,
approval-gated.** Objective: define public request and dedication/shout-out
handling, privacy/content boundaries, rate limits, and abuse response. Boundary:
no public exposure or runtime queue action. Evidence: threat/privacy review,
station-scope contract, and abuse/retention test plan. Gate: explicit M6.1
approval after M5. Estimate: **1–2 weeks** focused effort, **2–4 weeks**
elapsed, **medium** confidence; depends on owner policy decisions.

**M6.2 — Approved intake and eligibility controls — Future, approval-gated.**
Objective: implement the approved authenticated/anonymous intake, cooldown,
eligibility, idempotency, and anti-spam rules. Boundary: no privileged
anonymous mutation or direct scheduling/runtime signal. Evidence: rate-limit,
abuse, and station-isolation tests. Gate: explicit M6.2 approval after M6.1.
Estimate: **1–3 weeks** focused effort, **2–5 weeks** elapsed, **medium**
confidence; depends on approved threat model.

**M6.3 — Operator moderation and presentation — Future, approval-gated.**
Objective: provide station-scoped moderation, approval/denial, and safe
dedication/shout-out presentation. Boundary: moderation does not publish or
execute programming alone. Evidence: role/audit/privacy/operator workflow
tests. Gate: explicit M6.3 approval after M6.2. Estimate: **1–2 weeks** focused
effort, **2–4 weeks** elapsed, **medium** confidence; depends on M1 UI and M6.2.

**M6.4 — Safe future-slot proposal insertion — Future, approval-gated.**
Objective: propose insertion only into eligible future published schedule slots
with separation-rule protection. Boundary: no direct runtime queue mutation.
Evidence: publication-state, separation, and no-runtime-side-effect tests.
Gate: explicit M6.4 approval after M6.3. Estimate: **1–2 weeks** focused
effort, **2–4 weeks** elapsed, **medium** confidence; depends on M4 publication
boundary.

**M6.5 — Security/load/abuse and operator acceptance — Future,
approval-gated.** Objective: validate abuse resistance, load limits, safe
failures, and operator workflow. Boundary: no public launch unless separately
approved. Evidence: security/load findings, privacy review, and owner acceptance
recommendation. Gate: explicit M7 approval after M6.5. Estimate: **1–2 weeks**
focused effort, **2–5 weeks** elapsed, **medium** confidence; depends on
controlled testing and owner review.

### Out of scope

Request-triggered runtime commands, automatic on-air insertion, stream
operation, anonymous privileged mutation, or exposure before a specific owner
authorization.

### Acceptance evidence

- Five-station authorization and rate-limit tests, moderation decision audit,
  duplicate/idempotency behavior, privacy review, and manual operator workflow
  evidence.
- A request cannot bypass approval/publication or reveal out-of-scope library
  records.

### Risks, dependencies, and next gate

Public input introduces abuse, privacy, and moderation obligations. Treat
external visibility as its own deployment decision; a local/operator-only
implementation can be accepted first.

Next gate:

> “Approve M7 private source-encoder and Icecast test outputs, including
> network boundaries, secret handling, certificates, and rollback. Any public
> listener exposure requires a separate explicit approval.”

Planning estimate: M6 is **5–9 weeks** focused effort and **8–18 weeks**
elapsed, with an indicative completion range of **May–October 2029**. M6 depends
on M4 publication and never becomes runtime queue control.

## Phase 7 — M7: Source Encoding, Icecast, and Dynamic Metadata

### Objective

Build the encoder and listener-delivery planes as independent, observable,
recoverable services, starting with private test outputs only.

### In scope

- Explicit source-encoder contracts for AAC-LC and MP3, bitrate/profile
  selection, metadata injection, source health, reconnect/backoff, and bounded
  failure handling.
- Codec variants consume the shared, already-processed station PCM program bus
  defined by M5; neither encoder variant may independently re-master output.
- Icecast 2.x primary/secondary architecture, private mount testing, source
  authentication stored outside the repository, listener/output metrics,
  log/retention policy, and active/passive failover design.
- Dynamic ICY and webhook metadata synchronization with station ID, sequence,
  freshness, deduplication, and stale/unavailable behavior.
- Failure drills for source loss, encoder crash, Icecast node loss, metadata
  lag, DNS/cache behavior, and recovery. The sub-500 ms failover objective is a
  measurement target to validate, not an assumption or automatic acceptance.

### Sub-goals and approval sequence

**M7.1 — Source encoder/PCM-bus and profile design — Future, approval-gated.**
Objective: define source-encoder boundaries, processed PCM ownership, codec
profiles, and output health contracts. Boundary: no source/stream process or
listener exposure. Evidence: reviewed interface, profile rationale, and
capacity/failure test plan. Gate: explicit M7.1 approval after M5/M6 acceptance.
Estimate: **1–3 weeks** focused effort, **2–5 weeks** elapsed, **medium**
confidence; depends on the approved M5 bus.

**M7.2 — Icecast topology and deployability validation plan — Future,
approval-gated.** Objective: design primary/secondary Icecast and separately
deployable source/relay boundaries. Boundary: private, approved testing only;
no public DNS/firewall changes. Evidence: network, secret, certificate,
rollback, and failover plan. Gate: explicit M7.2 infrastructure-test approval
after M7.1. Estimate: **1–3 weeks** focused effort, **3–7 weeks** elapsed,
**low** confidence; depends on provider/network decisions.

**M7.3 — Processed PCM fan-out and codec variants — Future, approval-gated.**
Objective: create AAC-LC/MP3 fan-out from the shared already-processed PCM bus.
Boundary: no independent codec re-mastering. Evidence: profile, CPU, output
quality, and reconnect tests. Gate: explicit private-output approval after
M7.2. Estimate: **2–4 weeks** focused effort, **4–8 weeks** elapsed, **low**
confidence; depends on private test infrastructure and M5 DSP evidence.

**M7.4 — Epoch-aware metadata distribution — Future, approval-gated.**
Objective: implement the approved runtime-owned event/distributor contract:
WebSocket/SSE authority, Icecast adapters, idempotency, stale-event rejection,
synchronizing state, and failover reconciliation. Boundary: no claim of
frame-perfect listener metadata. Evidence: epoch/failover tests and separate
latency measures. Gate: explicit M7.4 approval after M7.3. Estimate: **2–4
weeks** focused effort, **4–8 weeks** elapsed, **low** confidence; depends on
runtime event contract and controlled mounts.

**M7.5 — Source/failover and listener-facing evidence — Future,
approval-gated.** Objective: measure source loss, reconnect, mount convergence,
audio continuity, metadata correctness, and private listener behavior.
Boundary: no public listener launch. Evidence: measured drills, listener
validation, safe degraded states, and owner recommendation. Gate: explicit M8
shadow-test approval after M7.5. Estimate: **3–5 weeks** focused effort,
**5–12 weeks** elapsed, **low** confidence; infrastructure and listening
windows dominate.

### Epoch-aware metadata and failover contract (approval-gated deliverable)

- Define a separate, runtime-owned authoritative metadata event path containing
  station-scoped opaque event ID, monotonic sequence, stream epoch, published
  schedule revision, effective audio timestamp, and idempotency key
  `(station_id, stream_epoch, sequence)`.
- Require a metadata distributor to fan out events to Icecast mount adapters,
  listener-facing WebSocket/SSE, and dashboard/player APIs. WebSocket/SSE is
  the primary listener-facing authority; ICY is a compatibility channel.
- On failover, increment the epoch, reconcile the current runtime event into
  the replacement mount, reject stale prior-epoch events, and expose a brief
  `synchronizing` state rather than stale Now Playing data.
- Measure runtime-to-distributor latency, distributor-to-mount convergence,
  WebSocket/SSE latency, audio continuity, and listener-perceived metadata
  alignment separately. Sub-second internal propagation is feasible; a
  universal frame-perfect listener-visible guarantee across buffered players is
  not.

### Out of scope

Legacy SHOUTcast service, public launch, permanent listener migration, and
unapproved network/firewall/DNS changes. SHOUTcast compatibility remains a
future adapter only after Icecast is proven.

### Acceptance evidence

- Private, authorized test listeners confirm each codec/bitrate and metadata
  state; automated measurements and human listening agree on transitions.
- Failover/reconnect, stale metadata, no-source, and recovery behavior are
  documented with actual measured timings and safe listener messaging.
- Secrets are injected through the approved environment/secret mechanism and
  never appear in the repository, logs, test fixtures, or audit records.
- Metadata evidence proves epoch-aware stale-event rejection, replacement-mount
  reconciliation, and the documented distinction between audio continuity and
  listener-visible metadata convergence.

### Risks, dependencies, and next gate

Network topology, TLS/certificates, bandwidth, codec licensing/patent posture,
and listener compatibility need owner/provider decisions. Keep source encoders
and Icecast independently restartable so a listener-plane fault cannot alter
programming or runtime state.

Next gate:

> “Approve M8 read-only parallel shadow testing against the legacy system,
> including comparison inputs, manual listening windows, and failure drills.”

Planning estimate: M7 is **10–18 weeks** focused effort and **18–36 weeks**
elapsed, with an indicative completion range of **October 2029–July 2030**.
Sub-second internal metadata propagation remains a target; listener-perceived
alignment is measured, not universally guaranteed.

## Phase 8 — M8: Parallel Operations, Shadow Testing, and Parity

### Objective

Earn production-cutover confidence through read-only comparison and repeated
operational drills; do not treat a working private stream as listener-ready.

### In scope

- Parallel/shadow playout of approved test or authorized duplicate programming
  against legacy outputs without controlling, copying from, or modifying the
  Windows host or its library.
- Audio, transition, loudness, schedule, metadata, now-playing, timing,
  health, and failure/recovery comparison records; use owner-approved exports
  or observation feeds rather than undocumented legacy dependencies.
- Manual listening panels across all five formats, device/network diversity,
  operator handoff rehearsals, source/encoder/Icecast failover drills, backup
  restore rehearsal, rollback rehearsal, and incident runbooks.
- Cutover readiness review covering capacity, security, rights, support,
  observability, alerting, operating ownership, and the exact abort threshold.

### Sub-goals and approval sequence

**M8.1 — Shadow-operation plan and parity definition — Future,
approval-gated.** Objective: define read-only observation boundaries, approved
comparison inputs, intended parity, and intentional differences. Boundary: no
legacy control/copying or listener cutover. Evidence: owner-approved plan,
metrics, and abort criteria. Gate: explicit M8.1 approval after M7. Estimate:
**1–2 weeks** focused effort, **2–5 weeks** elapsed, **medium** confidence;
depends on legacy-observation availability.

**M8.2 — Measurement collection — Future, approval-gated.** Objective: collect
schedule, transition, audio-quality, metadata, and intentional-difference
evidence. Boundary: read-only shadow operation only. Evidence: time-correlated
measurement set and reproducible comparison method. Gate: explicit M8.2
approval after M8.1. Estimate: **2–4 weeks** focused effort, **6–12 weeks**
elapsed, **low** confidence; observation windows and owner listening govern.

**M8.3 — Controlled failure drills — Future, approval-gated.** Objective:
exercise worker restart, decoder/media failure, silence, rollback, CPU
saturation, source failover, and stale-metadata rejection. Boundary: drills use
approved isolated/shadow scope only. Evidence: timed outcomes, recovery proof,
and incident/runbook updates. Gate: explicit M8.3 approval after M8.2.
Estimate: **2–4 weeks** focused effort, **4–10 weeks** elapsed, **low**
confidence; depends on M7 capability and operational windows.

**M8.4 — Operator listening, parity evidence, and cutover recommendation —
Future, approval-gated.** Objective: obtain documented listening evaluation,
capacity evidence, SAM parity findings, and cutover-readiness recommendation.
Boundary: continuous connectivity alone is never acceptance evidence, and no
cutover occurs. Evidence: signed evidence pack, accepted differences, and M9
runbook recommendation. Gate: explicit M9 cutover-plan approval after M8.4.
Estimate: **3–4 weeks** focused effort, **6–16 weeks** elapsed, **low**
confidence; operator signoff and sufficient failure observation are mandatory.

### Out of scope

Changing production DNS, routing listeners, connecting to legacy production
systems without explicit access approval, or decommissioning anything.

### Acceptance evidence

- Defined parity thresholds and a signed evidence pack with known differences
  either fixed or formally accepted by the owner.
- Multiple successful planned and unplanned recovery drills; no critical
  station-isolation, security, metadata, or audio-quality finding remains
  open.
- A date-specific M9 runbook has a tested rollback route and named human
  decision makers.
- "The stream remained connected" is not sufficient. Document measured
  thresholds and operator signoff for listening and transition quality,
  cue/crossfade timing, worst-case CPU/memory headroom, worker/runtime restart
  and recovery, published-artifact rollback, decoder/corrupt-media/silence
  handling, source failover, metadata convergence/stale-event rejection, and
  audio continuity separately from metadata correctness. Where SAM parity is
  intended, verify it; record intentional differences explicitly.

### Risks, dependencies, and next gate

This milestone is calendar-heavy because it needs manual listening and enough
time to observe failures. Legacy behavior may be inconsistent or undocumented;
capture it as observed evidence, not as an invitation to import SAM/PAL
dependencies.

Next gate:

> “Approve the date-specific M9 listener cutover and rollback plan, including
> DNS, compliance, support, monitoring, and authority to abort.”

Planning estimate: M8 is **8–14 weeks** focused effort plus observation and
**16–32 weeks** elapsed plus observation, with an indicative completion range
of **August 2030–May 2031**. Continuous connectivity alone is never
acceptance evidence.

## Phase 9 — M9: Listener Cutover and Legacy Decommissioning

### Objective

Move listeners only after M8 acceptance, preserve an executable rollback, then
retire SAM Pro/SHOUTcast 1.9.8 only after the stabilization criteria are met.

### In scope

- A change-controlled cutover window, final backups/configuration evidence,
  staged DNS/listener transition, source and Icecast capacity verification,
  listener communications, on-call ownership, incident escalation, and
  measured post-cutover health.
- Royalty/compliance export design and validation, including SoundExchange
  reporting inputs, retention, reconciliation, and correction procedure. Legal
  interpretation and filings remain owner/provider responsibilities.
- A defined rollback period with objective thresholds for audio quality,
  availability, metadata correctness, listener impact, and security.
- Only after the stability window: documented legacy data/archive decision,
  credential revocation, service shutdown, asset disposition, and retirement
  record. No irreversible deletion occurs before explicit authorization.

### Sub-goals and approval sequence

**M9.1 — Guarded cutover and rollback plan — Future, approval-gated.**
Objective: prepare the production change, communication, authority, abort, and
rollback plan. Boundary: no DNS/listener change or legacy action. Evidence:
named decision makers, rehearsed rollback, communications, and owner-approved
go/no-go criteria. Gate: explicit M9.1 plan approval after M8. Estimate:
**1–2 weeks** focused effort, **3–6 weeks** elapsed, **low** confidence;
depends on M8 evidence and provider coordination.

**M9.2 — Compliance export and operational-readiness validation — Future,
approval-gated.** Objective: validate royalty/compliance exports and readiness
evidence. Boundary: no claim of legal compliance without owner/legal review.
Evidence: reconciliation samples, retention/correction procedure, support and
monitoring readiness. Gate: explicit M9.2 approval after M9.1. Estimate:
**1–3 weeks** focused effort, **3–8 weeks** elapsed, **low** confidence;
depends on owner/legal/accounting decisions.

**M9.3 — Phased DNS/listener cutover — Future, approval-gated.** Objective:
execute an explicitly approved phased Icecast cutover with observation and
rollback windows. Boundary: no automatic or irreversible transition. Evidence:
change record, observed availability/audio/metadata, and rollback decision.
Gate: exact cutover authorization immediately before action. Estimate: **1–2
weeks** focused effort, **2–6 weeks** elapsed, **low** confidence; depends on
M9.1/M9.2, DNS/provider authority, and real listener observation.

**M9.4 — Post-cutover stability, metadata, and compliance verification —
Future, approval-gated.** Objective: verify stability during the defined
observation/rollback period. Boundary: legacy remains recoverable; no
decommission. Evidence: all-station quality/availability/metadata evidence,
incident review, and compliance reconciliation. Gate: separate stability
acceptance approval after M9.3. Estimate: **2–3 weeks** focused effort,
**4–12 weeks** elapsed, **low** confidence; depends on real operating data.

**M9.5 — Approved legacy decommissioning and closeout — Future,
approval-gated.** Objective: retire SAM Pro and SHOUTcast 1.9.8 gracefully,
preserve required evidence, and recommend project closeout. Boundary: no
decommission until M9.4 evidence and a separate owner approval. Evidence:
retirement record, credential/access disposition, evidence preservation, and
final owner signoff. Gate: explicit legacy-decommission approval after M9.4.
Estimate: **1–2 weeks** focused effort, **2–6 weeks** elapsed, **low**
confidence; depends on completed rollback window and owner decision.

### Out of scope

Unapproved DNS/Cloudflare/provider changes, automatic decommission, deletion
of the old media library, or a claim of royalty compliance without owner/legal
review and verified reporting evidence.

### Acceptance evidence

- Cutover and rollback runbooks executed or rehearsed with timestamps,
  responsible people, and a clear go/no-go record.
- All five stations meet agreed availability, audio, metadata, and support
  thresholds during the stabilization window; no untriaged critical incident.
- SoundExchange/compliance export is reconciled to authoritative history, and
  the owner accepts the legal/operational process.
- The owner explicitly approves legacy retirement after the rollback window,
  not merely the listener cutover.

### Required human action

The owner must approve the cutover runbook immediately before execution and
must separately approve legacy retirement. Planning estimate: M9 is **6–12
weeks** focused effort plus stabilization and **12–28 weeks** elapsed plus
observation/rollback, with an indicative completion range of **June 2031–March
2032**. Every M9 date is contingent on cutover evidence, not a commitment.

## Dependency and critical path

```text
M1.3 role-aware operator UI
  → M1.4 local-only M1 acceptance recommendation
  → M2 staging activation, migration, topology, and DR proof
  → M3 immutable rights-aware asset lifecycle
  → M4 deterministic compilation and published-artifact acceptance
  → M5 supervised runtime, fault/DSP/sandbox and listening acceptance
  → M6 moderated future-schedule proposals
  → M7 private PCM/encoder/Icecast/failover and metadata evidence
  → M8 shadow observation, failure drills, and operator parity signoff
  → M9 guarded cutover, rollback observation, and separately approved retirement
```

This is a planning forecast, not a launch date. M1.3/M1.4 must complete before
M2 operational work can begin. M2 depends on staging PostgreSQL readiness,
controlled migration execution, backup/restore exercises, and DR evidence. M3
must establish immutable assets before M4 publishes runtime-consumable handles;
M4 artifact acceptance precedes M5 runtime consumption. M5 is governed by
measurable runtime/fault/DSP evidence and subjective listening approval, which
can widen its elapsed range. M6 can propose only safe M4 future-publication
changes, never direct runtime queue control. M7 depends on the approved runtime
and PCM-bus boundary and needs controlled infrastructure testing; M8 needs a
meaningful shadow-observation period and operator listening signoff, not code
completion alone. M9 requires deliberate observation/rollback windows,
compliance evidence, and explicit cutover and retirement approvals.

Some design, fixture, and documentation work can be prepared before later
gates, but it must not activate a service, create media, use credentials, or
perform an operational action early. Reforecast this calendar path after every
approved sub-goal rather than compressing evidence to preserve a target date.

## Capability-replacement matrix

| SAM Pro / legacy capability                     | Modern replacement                                                              | Owner plane                   | Milestone              | Verification method                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------- | ---------------------- | -------------------------------------------------------------- |
| Media categories, library metadata, and ingest  | Rights-aware PostgreSQL metadata and sandboxed asset lifecycle                  | Programming Control Plane     | M3                     | Manifest/provenance review, quarantine and import tests        |
| Playlist, rotations, clocks, and category rules | Deterministic schedule planner with explicit approval/publication               | Programming Control Plane     | M1–M4                  | Station-isolation, deterministic-plan, DST, and rollback tests |
| Queue/programming preview                       | Read-only dry-run and versioned published schedules                             | Programming Control Plane     | M1–M4                  | Repeatable result/explanation and no-mutation assertions       |
| Audio decks and cue routing                     | Supervised Liquidsoap-centered playout runtime; optional native supervisor only | Playout & Automation Runtime  | M5                     | Manual listening, transition/failure/restart evidence          |
| AGC, crossfade, gap handling, DSP               | Measured EBU R128 processing pipeline with documented presets                   | Playout & Automation Runtime  | M5                     | Loudness/transition metrics and owner listening sign-off       |
| PAL scripting                                   | Deterministic, resource-bounded WASM/JS sandbox                                 | Playout & Automation Runtime  | M5                     | Timeout/memory/IO denial, deterministic regression tests       |
| Live-DJ takeover and fallback                   | Explicit live-input state machine and auditable handoff/fallback                | Playout & Automation Runtime  | M5                     | Source-loss/takeover rehearsal and audit review                |
| SHOUTcast source encoders                       | Separate AAC-LC/MP3 source-encoder layer                                        | Source Encoder Layer          | M7                     | Private codec/reconnect/failure testing                        |
| SHOUTcast listener service                      | Icecast 2.x primary/secondary listener layer                                    | Listener-Facing Icecast Layer | M7                     | Private listener, failover, metrics, metadata tests            |
| Dynamic song metadata                           | Versioned ICY/webhook metadata bridge with freshness semantics                  | Source Encoder + Icecast      | M7                     | Sequence/stale/deduplication tests and listener checks         |
| Song requests                                   | Rate-limited request intake plus operator moderation                            | Programming Control Plane     | M6                     | Abuse, eligibility, station-scope, and approval-flow tests     |
| SoundExchange reporting                         | Playback-history-derived reporting exporter and reconciliation process          | Control Plane + Runtime       | M9                     | Sample-period reconciliation and owner/legal review            |
| Existing relay/dashboard ecosystem              | Versioned integration API with explicit contracts                               | External integration          | After M7/M9 acceptance | Contract review and non-coupled integration test               |

## Release, staging, rollback, and operational-readiness strategy

1. **Local authoring:** use the Ubuntu workstation for code, fixtures, strict
   checks, and migration-safe tests. Local passing tests are not staging or
   audio acceptance.
2. **Staging activation:** M2 is the first approved migration on the
   development VM. It stays SSH-administered and non-public, with separate
   migrator/runtime database privileges and recorded restore evidence.
3. **Private audio validation:** M3–M7 use isolated assets and explicitly
   approved private test outputs. Each plane has independent health, logs,
   restart, and rollback behavior. No test stream implies listener launch.
4. **Shadow readiness:** M8 compares behavior without controlling legacy
   production. It produces a go/no-go record, manual listening evidence,
   incident contacts, capacity data, recovery results, and an exact M9 abort
   route.
5. **Cutover and rollback:** M9 uses a scheduled, owner-approved change
   window. Rollback remains available through a defined stabilization period;
   legacy shutdown is a later, separately approved action.
6. **Release evidence:** every operational gate records immutable configuration
   version, deployable artifact identity, dependency audit, migration state,
   validation result, known risks, rollback decision, and named approver.

## Risks and assumptions that most affect dates

| Risk or assumption                                      | Schedule impact                                | Mitigation                                                                    |
| ------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------- |
| Owner approval cadence, credentials, and staging access | Blocks every operational milestone             | Prepare plans/evidence locally; request narrowly scoped gates early           |
| Rights-cleared, format-appropriate test music           | Can delay M3 and all meaningful listening      | Fixed human-curated manifest; preserve empty-library path                     |
| PostgreSQL privileges, backups, and restore time        | Can delay M2 or require schema/role correction | Disposable rehearsal, least-privilege roles, timed restore drill              |
| Liquidsoap/DSP feature fit and audio quality            | Can materially extend M5                       | Feasibility ADR, fixed fixtures, human listening, no custom-engine shortcut   |
| Network, certificates, bandwidth, Icecast behavior      | Can delay M7 and public readiness              | Private outputs first, measured failover, independent encoder/listener layers |
| Legacy parity availability and observations             | Can extend M8 observation windows              | Owner-approved read-only exports/comparisons; document accepted differences   |
| Compliance and SoundExchange reporting rules            | Can block M9 retirement                        | Engage owner/legal/accounting review before cutover; reconcile samples early  |
| Solo-owner throughput and interruptions                 | Widens every calendar range                    | Reforecast at each gate; protect sequential acceptance criteria               |

## Not in scope or deferred

- Recreating proprietary SAM internals, importing PAL scripts, using SAM
  binaries, or coupling the live system to legacy SHOUTcast.
- A custom real-time DSP, codec, or playout engine absent a later ADR and
  explicit approval; the preferred direction remains a supervised Liquidsoap
  runtime.
- Reading, scanning, copying, moving, deleting, or modifying the Windows
  production media library without a specific future authorization.
- Broad archive searching, dynamic test-music downloading, committed media,
  production credentials, public service exposure, or automatic DNS/firewall
  changes.
- SHOUTcast compatibility/relay support until Icecast is proven and a separate
  adapter scope is approved.
- Features outside the operating replacement objective, including unapproved
  listener social/community features and external dashboard coupling.

## Definition of done for M9

M9 is complete only when all of the following are true:

- The four planes are independently deployable, supervised, and have clear
  authoritative writers and failure boundaries.
- All five stations have passed station-isolation, audio, metadata, scheduling,
  output-health, recovery, and manual listening acceptance.
- Programming transitions are demonstrably previewed, approved, published as
  immutable versions, and only then executed by the runtime; no web mutation
  can bypass that process.
- PostgreSQL recovery has been demonstrated; operating credentials are
  least-privilege and absent from code/logs; audit records remain content-free.
- Icecast listener delivery, encoder recovery, dynamic metadata, observability,
  alerting, support ownership, and rollback are accepted in production-like
  and parallel conditions.
- Reporting/export evidence is reconciled and accepted by the owner with
  appropriate legal/compliance review.
- The owner has approved both the listener cutover and, after the defined
  stability/rollback period, the separate retirement of SAM Pro and SHOUTcast
  1.9.8.
