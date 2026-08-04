# 24Seven.FM Audio Streaming System roadmap

Updated August 3, 2026 after reconciling the published M0 baseline, the active
uncommitted M1 worktree, architecture and ADRs, package scripts, migration
assets, and current tests. This is the authoritative implementation sequence;
it is a planning document, not authorization to execute an operational step.

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

## State vocabulary and forecast model

- **Complete** — committed, validated evidence reached the stated acceptance
  gate. A later regression creates new work; it does not rewrite history.
- **In progress** — authorized local work is underway but not yet complete or
  approved for release.
- **Approval-gated** — a human decision, credential, operational plan, or
  isolated environment is required before work may begin.
- **Planned** — dependency-ordered work that has not yet reached its gate.
- **Deferred** — deliberately outside the cutover path unless separately
  authorized.

All dates below are **estimates contingent on approvals, infrastructure
readiness, rights decisions, and validation outcomes**. Active effort is the
focused implementation/review time likely required from the owner and Codex;
calendar windows also allow for handoffs, debugging, listening tests,
infrastructure waits, and corrective work. The date model starts Monday,
August 3, 2026, assumes prompt gate responses (normally within five business
days), roughly four effective engineering days per week, and no material
rights or provider delay. Every delayed gate shifts its dependent milestones.

Under those assumptions, the earliest credible listener cutover is **April
2028**. The prudent planning range is **July through September 2028**. This is
not a commitment: a failed parallel-audio, recovery, or compliance acceptance
test must delay M9 rather than reduce its evidence threshold.

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

The published baseline is M0 at `2fa02a1`, followed by the published roadmap
commit `8fea092`. M1 exists only as local, uncommitted work. No migration,
Docker/Compose invocation, service startup, deployment, runtime/stream action,
or production-system action is authorized by this roadmap.

| Area                       | Evidence in the current worktree                                                                                                                               | State                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Live persistence direction | `PostgresPersistence`, `PostgresM1Repositories`, separate runtime/migrator URLs, loopback Compose asset, and `002_m1_control_plane.sql`                        | In progress; no migration has run                            |
| Identity and authorization | scrypt hashing, server-session primitives, owner/administrator/programmer/operator/observer helpers, bootstrap/login/logout adapters, and CSRF/session helpers | In progress; needs live-flow and adversarial coverage        |
| Programming model          | Station-scoped media, playlists, separation rules, rotations, clocks, program blocks, and scheduled events are represented in schema/repositories              | In progress                                                  |
| API boundary               | Injected protected programming adapter, safe error mapping, authenticated dry-run route, and route-level negative-path coverage exist                          | Backend pass complete; UI integration remains                |
| Update validation          | All seven entity families use scoped load/merge/validate/persist paths; retained and replacement references are SQL-scoped                                     | Backend pass complete                                        |
| UI                         | M1 state-rendering primitives exist, but the active browser UI is still the M0 status dashboard                                                                | Open M1 completion work                                      |
| Validation                 | `npm run check` currently builds, lints, typechecks, runs 29 tests, audits dependencies, and runs hygiene                                                      | Passing locally; UI and approved integration evidence remain |
| Automation                 | No `.github` workflow is present                                                                                                                               | Planned; local check remains the current gate                |

`m1-store` is a test double only and must never enter the live application
path. The test runner no longer requires Node's experimental SQLite flag, and
SQLite remains absent from the live M1 application path.

### Active M1 completion scope

M1 must finish the following before its gate:

1. Complete-state updates to playlists, separation rules, rotations, clocks,
   and scheduled events are complete locally:
   `load by id + station_id → merge permitted fields → validate full state →
validate same-station foreign keys in SQL → persist valid complete state`.
2. Protected-API and adapter coverage for CRUD, CSRF using
   `x-csrf-token`, RBAC/session handling, `not_found` isolation, content-free
   auditing, and deterministic dry runs.
3. The read-only proposal endpoint remains validated:
   `GET /api/v1/stations/:stationId/dry-run?separationMinutes=N`. It must be
   deterministic, station-scoped, and never change queue, schedule, runtime,
   or media state.
4. Replace the status-only browser surface with the authorized operator UI:
   bootstrap/login/logout, protected station context, library/programming
   views, clear proposed-preview semantics, and explicit loading, empty,
   forbidden, read-only, validation-error, and unavailable states. It must not
   add an execution control.

## Milestone forecast

The earliest-start column is an optimistic dependency boundary, not permission
to begin work. No milestone starts until its explicit gate is granted.

| Milestone                                                   | Status                  | Scope                                                                               | Estimated active effort       | Earliest start | Target completion range     | Explicit gate                                                                               |
| ----------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------- | ----------------------------- | -------------- | --------------------------- | ------------------------------------------------------------------------------------------- |
| M1 — Programming Control Plane and Security Baseline        | In progress, local only | Complete protected PostgreSQL control-plane behavior and operator UI; no operations | 4–6 weeks remaining           | Aug. 3, 2026   | Sep. 18–Oct. 16, 2026       | Approve M1 commit/push, then separately approve an M2 staging-execution plan                |
| M2 — Persistence Activation, Staging Infrastructure, and DR | Approval-gated          | Staging migration, role separation, Compose validation, backup/restore              | 3–5 weeks                     | Sep. 21, 2026  | Oct. 16–Nov. 20, 2026       | Approve the named staging migration, backup/restore, and no-public-exposure plan            |
| M3 — Media Ingestion, Metadata, and Asset Lifecycle         | Planned after M2        | Rights-controlled test assets and sandboxed metadata/import lifecycle               | 6–10 weeks                    | Oct. 19, 2026  | Dec. 4, 2026–Jan. 29, 2027  | Approve source rights manifest, authorized paths, sandbox, and retention policy             |
| M4 — Advanced Scheduling and Versioned Publication          | Planned after M3        | Deterministic schedule generation and versioned publication/rollback                | 6–9 weeks                     | Dec. 7, 2026   | Jan. 29–Mar. 12, 2027       | Approve publication semantics and schedule-version operational model                        |
| M5 — Playout Runtime, DSP, and Sandboxed Automation         | Planned after M4        | Isolated runtime feasibility, supervised playout, DSP, handoff, automation sandbox  | 12–18 weeks                   | Feb. 1, 2027   | May 21–Aug. 13, 2027        | Approve runtime technology decision and isolated audio-test plan                            |
| M6 — Listener Requests and Moderation                       | Planned after M5        | Eligibility, moderation, rate limiting, and proposed schedule insertion             | 4–7 weeks                     | May 24, 2027   | Jul. 16–Sep. 10, 2027       | Approve request threat model and any public-interface plan                                  |
| M7 — Source Encoding, Icecast, and Dynamic Metadata         | Planned after M6        | Encoder layer, private Icecast validation, failover, metadata synchronization       | 8–12 weeks                    | Jul. 19, 2027  | Oct. 15, 2027–Jan. 14, 2028 | Approve private output test, network/secrets design, and later public exposure separately   |
| M8 — Parallel Operations, Shadow Testing, and Parity        | Planned after M7        | Read-only legacy comparison, manual listening, failure drills, cutover readiness    | 10–16 weeks plus observation  | Oct. 18, 2027  | Jan. 14–Apr. 30, 2028       | Approve read-only shadow plan, comparison inputs, and operational test calendar             |
| M9 — Listener Cutover and Legacy Decommissioning            | Planned after M8        | Controlled cutover, rollback window, compliance export, legacy retirement           | 6–10 weeks plus stabilization | Jan. 17, 2028  | Apr. 2–Sep. 30, 2028        | Approve the exact cutover and rollback runbook; approve retirement only after stabilization |

The later dates in the table are deliberately longer than the initial
August-2026 forecast because this is a strictly sequential plan: each early
estimate is conditional on every preceding gate closing at its earliest date.
The overall calendar therefore has two useful interpretations: an optimistic
technical-path cutover after the M8 earliest boundary, and a prudent
approval/listening/recovery-aware target through late 2028. A new forecast
should be recorded after each milestone acceptance rather than compressing
future work to preserve a date.

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
- Replace/retire the residual SQLite test-runner path or constrain it as an
  explicitly non-runtime historical fixture; add migration-safe PostgreSQL
  adapter tests and no-migration HTTP/UI tests.
- Document the API, bootstrap procedure, local-only operation, and the
  unexecuted-migration boundary. Add CI only under a separate publication/
  workflow authorization.

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

The owner reviews the M1 evidence and explicitly authorizes the M1 commit and
push. After that, a separate approval must state:

> “Approve the M2 staging plan to execute the named PostgreSQL migration on
> the approved development environment, validate backup/restore, and keep all
> services non-public.”

Estimated remaining active effort: **4–6 weeks**. Estimated completion:
**September 18–October 16, 2026**, assuming no scope expansion and prompt
review.

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

Estimated active effort: **3–5 weeks**. Estimated completion:
**October 16–November 20, 2026**.

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

Estimated active effort: **6–10 weeks**. Estimated completion:
**December 4, 2026–January 29, 2027**.

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

### Out of scope

Direct queue writes, automatic playout, a time-triggered scheduler, runtime
commands, audio transitions, or listener-visible output.

### Acceptance evidence

- Repeating the same versioned inputs produces the same plan and explanation.
- A rejected/invalid plan cannot publish; a published plan cannot mutate in
  place; rollback is versioned and auditable.
- Human review confirms that dry-run and published views say "proposal" or
  "published artifact," never "on air" or "executing."

### Risks, dependencies, and next gate

Real programming rules contain editorial edge cases. Resolve them as explicit
policy/configuration and regression fixtures, rather than hidden selection
logic. DST and empty-library behavior require owner decisions on fallback
policy.

Next gate:

> “Approve the M5 runtime feasibility decision and an isolated audio-test
> plan. No public output, production media, or listener traffic is included.”

Estimated active effort: **6–9 weeks**. Estimated completion:
**January 29–March 12, 2027**.

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

### Risks, dependencies, and next gate

Audio quality and real-time reliability require more manual testing than
ordinary web work. Hardware/driver differences, Liquidsoap feature fit, and
script isolation may change the design. Keep the runtime offline and use fixed
assets until its error budget and observation contract are accepted.

Next gate:

> “Approve M6 request intake/moderation design and, if requested, the limited
> public-interface threat model. A public listener remains out of scope.”

Estimated active effort: **12–18 weeks**. Estimated completion:
**May 21–August 13, 2027**.

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

Estimated active effort: **4–7 weeks**. Estimated completion:
**July 16–September 10, 2027**.

## Phase 7 — M7: Source Encoding, Icecast, and Dynamic Metadata

### Objective

Build the encoder and listener-delivery planes as independent, observable,
recoverable services, starting with private test outputs only.

### In scope

- Explicit source-encoder contracts for AAC-LC and MP3, bitrate/profile
  selection, metadata injection, source health, reconnect/backoff, and bounded
  failure handling.
- Icecast 2.x primary/secondary architecture, private mount testing, source
  authentication stored outside the repository, listener/output metrics,
  log/retention policy, and active/passive failover design.
- Dynamic ICY and webhook metadata synchronization with station ID, sequence,
  freshness, deduplication, and stale/unavailable behavior.
- Failure drills for source loss, encoder crash, Icecast node loss, metadata
  lag, DNS/cache behavior, and recovery. The sub-500 ms failover objective is a
  measurement target to validate, not an assumption or automatic acceptance.

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

### Risks, dependencies, and next gate

Network topology, TLS/certificates, bandwidth, codec licensing/patent posture,
and listener compatibility need owner/provider decisions. Keep source encoders
and Icecast independently restartable so a listener-plane fault cannot alter
programming or runtime state.

Next gate:

> “Approve M8 read-only parallel shadow testing against the legacy system,
> including comparison inputs, manual listening windows, and failure drills.”

Estimated active effort: **8–12 weeks**. Estimated completion:
**October 15, 2027–January 14, 2028**.

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

### Risks, dependencies, and next gate

This milestone is calendar-heavy because it needs manual listening and enough
time to observe failures. Legacy behavior may be inconsistent or undocumented;
capture it as observed evidence, not as an invitation to import SAM/PAL
dependencies.

Next gate:

> “Approve the date-specific M9 listener cutover and rollback plan, including
> DNS, compliance, support, monitoring, and authority to abort.”

Estimated active effort: **10–16 weeks plus observation windows**. Estimated
completion: **January 14–April 30, 2028**.

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
must separately approve legacy retirement. Estimated active effort: **6–10
weeks plus a 4–12 week stabilization window**. Estimated completion:
**April 2–September 30, 2028**.

## Dependency and critical path

```text
M1 secure programming/API/UI
  → M2 applied PostgreSQL + recovery proof
  → M3 rights-cleared asset lifecycle
  → M4 approved, versioned schedules
  → M5 supervised offline runtime + listening acceptance
  → M6 moderated request proposals
  → M7 private encoder + Icecast resilience
  → M8 parallel evidence and cutover rehearsal
  → M9 staged listener cutover, stabilization, retirement
```

Some design, fixture, and documentation work can be prepared before later
gates, but it must not activate a service, create media, use credentials, or
perform an operational action early. The critical path is dominated by M1
security correctness, M2 recovery proof, M3 rights/manual curation, M5 audio
listening and failure behavior, M7 network/output validation, and M8's
observation time.

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
