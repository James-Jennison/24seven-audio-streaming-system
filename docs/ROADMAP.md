# 24Seven.FM Audio Streaming System Roadmap

**Last Updated:** August 5, 2026
**Status:** Authoritative Implementation Sequence (Planning Document)

---

## 1. Project Overview

### Purpose

Replace legacy **SAM Pro / SAM Broadcaster** and **SHOUTcast 1.9.8** with a Linux-native, self-hosted streaming system for five stations:

- StreamingSoundtracks
- 1980s.FM
- Adagio.FM
- Death.FM
- Entranced.FM

### Success Criteria

- **Decoupled Architecture:** Station-isolated system with a separately supervised playout path and recoverable outputs.
- **Observability & Parity:** Truthful runtime telemetry, compliant reporting, and documented operator handoffs.
- **Parallel Validation:** Demonstrate audio and metadata parity in a parallel testing period before cutover.

---

## 2. Governing Architecture Constraints

1. **Decoupled Planes:** Keep the **Programming Control Plane**, **Playout & Automation Runtime**, **Source Encoder Layer**, and **Listener-Facing Icecast Layer** strictly isolated and independently deployable.
2. **State Pipeline:** State transitions strictly follow:
   `Proposed / Preview (Dry-Run) → Approved → Published (Versioned) → Executed (Runtime)`.
3. **No Direct Mutations:** HTTP/UI mutations must never directly trigger audio hardware, playout engines, encoders, or stream mounts.
4. **Data & Streaming Platform:** **PostgreSQL** is the sole live persistence store. **Icecast 2.x** is the sole future listener-facing streaming platform.
5. **Prohibited Dependencies:** SQLite, PAL, SAM binaries, and legacy SHOUTcast dependencies must never enter the live path.
6. **Station Isolation:** All scoped queries, operations, and references must enforce both `id` and `station_id`. Cross-station access returns `station_reference_forbidden`; missing or out-of-scope items return `not_found`.
7. **Content-Free Audits:** Audit logs record only action types, entity/station/actor IDs, timestamps, and outcome metadata. Never store filenames, titles, credentials, or session tokens.
8. **Engineering Hygiene:** Codebase must pass `npm run check` (TypeScript, ESLint, dependency audits, and safe error handling).

### Approval and Completion Policy

- M1–M10 are sequential, primary approval gates. Completion of a milestone or
  internal work package never authorizes the next one, deployment,
  infrastructure activity, or runtime execution.
- Completed work is recorded with bounded evidence and an actual UTC completion
  date. Forecasts apply only to uncompleted, approval-gated work and are
  recalibrated at each approved boundary.
- M2 is formally accepted as of 2026-08-04 UTC. Its finalized M2.5
  decision-only packet requires a new, separately scoped owner authorization
  before any future staging action; it creates no standing operational
  approval. The later M3 local-only implementation remains pending
  commit/acceptance and creates no operational authority.

### M2 naming convention

To avoid treating a published plan as completed staging work, M2 uses these
terms consistently:

- **M2.x Plan** means a completed, documentation-only planning or decision
  artifact. It never authorizes an operational action.
- **M2.x Execution Gate** means the future, separately approved staging action
  described by that plan. It is incomplete until bounded operational evidence
  is accepted.

For example, an **M2.2 Migration Execution Plan** may be published while its
execution gate is unstarted; completed gates are recorded only with bounded,
content-free evidence. The same distinction applies to M2.3 topology, M2.4
backup/restore, and M2 acceptance gates.

---

## 3. Current Implementation State

The published baseline is **M0 (`2fa02a1`)**. **M1** was completed on
**2026-08-04 UTC**. M2.1–M2.5 planning and operational-authorization
preparation is complete and published through **`b07814d47668e85256dcbe03ac5f67d5c84b9d70`**.
The status correction recording that publication was committed as
**`ad2bbc5baa2e09e83f07692b179b6799a8614d61`**.
The approved M2.2 migration/seed and post-migration grant gate, and M2.3
topology-validation gate, have completed with content-free staging evidence.
M2.4 now has a versioned logical custom-archive backup contract and a separate
backup-authority artifact. Its approved staging backup/archive-parse/SHA-256/
retention evidence is `m2-backup-20260804T202301068Z-8a1a86fc408de506`; restore
rehearsal passed on an isolated disposable target with content-free evidence
`m2-restore-20260804T211341391Z-33b489dab2be47b7`. **M2 is formally
accepted** for staging persistence and DR readiness; see the
[M2 acceptance and staging-readiness decision](M2_ACCEPTANCE_AND_STAGING_READINESS_DECISION.md).
These M2 records authorize no application, audio/listener, or production work.
The later M3 local-only implementation is separately authorized and does not
alter the M2 staging boundary.

| Area                   | Current Worktree Status                                                                                                           | State                                 |
| :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------ |
| **Live Persistence**   | `PostgresPersistence`, `PostgresM1Repositories`, dual runtime/migrator URLs, loopback Compose, `002_m1_control_plane.sql`         | M2 Accepted (isolated staging)        |
| **Identity & Auth**    | scrypt hashing, server sessions, station-scoped grants, bootstrap/login adapters, CSRF protection                                 | M1.1 / M1.2 Complete                  |
| **Programming Model**  | Station-scoped media, playlists, separation rules, rotations, clocks, program blocks, scheduled events                            | M1.1 / M1.2 Complete                  |
| **M3 Asset Lifecycle** | Opaque import/job lifecycle, append-only provenance/analysis contracts, deterministic fixture boundary, protected status controls | M3 Accepted (isolated rehearsal only) |
| **API Boundary**       | Protected programming adapter, safe error mapping, authenticated dry-run route                                                    | M1.2 Complete                         |
| **Update Validation**  | Scoped load/merge/validate/persist paths across all 7 entity families                                                             | M1.2 Complete                         |
| **Operator UI**        | Station-scoped UI connected to protected APIs; explicit unavailable runtime status                                                | M1.3 Complete (`9772b69`)             |
| **Validation**         | `npm run check` passes (build, lint, typecheck, test, dependency audit)                                                           | M1 Complete                           |

---

## 4. Master Milestone Timeline

| Milestone | Focus Area                  | Focused Effort |               Elapsed Duration               |    Indicative Window     | Key Gate / Dependency                                             |
| :-------: | :-------------------------- | :------------: | :------------------------------------------: | :----------------------: | :---------------------------------------------------------------- |
|  **M1**   | Control Plane & Security    |    Complete    |                   Complete                   | **Completed 2026-08-04** | Formal M1 Local Acceptance                                        |
|  **M2**   | Staging, Migration & DR     |    Complete    |                   Complete                   | **Completed 2026-08-04** | M2 Acceptance Decision                                            |
|  **M3**   | Ingestion & Asset Lifecycle |    Complete    | Isolated deterministic-double rehearsal only | **Completed 2026-08-05** | M3 Operational Acceptance Decision (M4.1 owner approval received) |
|  **M4**   | Advanced Scheduling         |    7–12 wks    |                  10–20 wks                   |   Jul 2027 – Mar 2028    | Immutable Asset Handles                                           |
|  **M5**   | Playout Runtime & DSP       |   16–28 wks    |                  28–52 wks                   |   Feb 2028 – May 2029    | Published Schedule Artifacts                                      |
|  **M6**   | Requests & Moderation       |    5–9 wks     |                   8–18 wks                   |   May 2029 – Oct 2029    | Public Threat Model Approval                                      |
|  **M7**   | Encoders & Icecast          |   10–18 wks    |                  18–36 wks                   |   Oct 2029 – Jul 2030    | Private Infrastructure Approval                                   |
|  **M8**   | Shadow Testing & Parity     |    8–14 wks    |                  16–32 wks                   |   Aug 2030 – May 2031    | Parallel Listening & Failover Drills                              |
|  **M9**   | Cutover & Decommissioning   |    6–12 wks    |                  12–28 wks                   |   Jun 2031 – Mar 2032    | Compliance Review & Final Sign-off                                |
|  **M10**  | Ubuntu Appliance Delivery   |  Post-M9 only  |                 Not started                  | After M9 acceptance only | M3–M9 accepted + explicit M10 approval                            |

---

## 5. Milestone Breakdown & Objectives

### Phase 1: M1 — Programming Control Plane & Security Baseline

- **Status:** Complete (2026-08-04)
- **Delivered:** PostgreSQL-only repositories, role/station-scoped grants, content-free audits, station-scoped operator UI, dry-run routing, and complete test suites without live runtime dependencies.

### Phase 2: M2 — Persistence Activation, Staging & DR

- **Status:** Complete and formally accepted (2026-08-04) for isolated staging
  persistence and DR readiness. M2.1–M2.5 planning, M2.2 migration/seed and
  post-migration least-privilege validation, M2.3 topology validation, and
  M2.4 backup/integrity/restore rehearsal completed under independent,
  bounded approvals. The [M2 acceptance decision](M2_ACCEPTANCE_AND_STAGING_READINESS_DECISION.md)
  does not authorize application activation, runtime work, listener-facing
  work or production activity. The later M3 local-only implementation is
  separately authorized and remains non-operational.
- **Objective:** Validate PostgreSQL migrations and disaster recovery in an isolated, non-public staging environment.
- **Key Tasks:** Apply `002_m1_control_plane.sql` via dedicated migration role; verify least-privilege runtime access; establish backup/restore drills and recovery runbooks.
- **M2.1 Staging Activation Plan:** [Staging activation and migration-rehearsal plan](M2.1_STAGING_ACTIVATION_PLAN.md) is complete and published as `b7a51cd`; it authorizes no operational activity.
- **M2.2 Migration Execution Plan:** [Staging migration preflight and run plan](M2.2_STAGING_MIGRATION_PREFLIGHT_AND_RUN_PLAN.md) is complete and published as `2cd85c3`. The approved migration, idempotent five-station seed, and post-migration least-privilege validation completed with content-free evidence; application activation remains separately gated.
- **M2.2 Least-Privilege Role-and-Grant Artifact:** [Role-and-grant artifact](M2.2_STAGING_ROLE_AND_GRANT_ARTIFACT.sql) defines platform/bootstrap, migrator, runtime, backup, restore, and evidence-review boundaries and was applied only in approved M2.2 phases. It creates no runtime/audio authority.
- **M2.3 Topology Validation Plan:** [Staging topology validation plan](M2.3_STAGING_TOPOLOGY_VALIDATION_PLAN.md) is complete and published as `be6a242`; the approved topology observation validated the non-public PostgreSQL-only staging boundary without starting an application or runtime service.
- **M2.4 Backup, Restore, and DR Plan:** [Staging backup, restore, and DR rehearsal plan](M2.4_STAGING_BACKUP_RESTORE_DR_REHEARSAL_PLAN.md) is published as `c8d5904`. The versioned [logical-backup authority artifact](M2.4_STAGING_BACKUP_AUTHORITY.sql) and repository backup command made the approved custom-archive, integrity, manifest, and 14-successful-day retention contract executable. Backup creation and verification completed with content-free evidence `m2-backup-20260804T202301068Z-8a1a86fc408de506`; the isolated recovery-target rehearsal passed with `m2-restore-20260804T211341391Z-33b489dab2be47b7` and cleanup passed.
- **M2.5 Operational-Authorization Decision Packet:** [Operational-authorization decision packet](M2.5_OPERATIONAL_AUTHORIZATION_DECISION_PACKET.md) is finalized as a decision-only record. It records the accepted M2 posture and the exact future owner gates for any Compose/service, migration, runtime, backup/restore, topology, opaque-reference, or promotion action. It creates no standing approval and performed no operation. The later M3 local-only implementation does not authorize an executable staging action; that still requires an explicit owner authorization.

### Phase 3: M3 — Media Ingestion, Metadata & Asset Lifecycle

**Status: complete and accepted 2026-08-05 UTC.** M3.1–M3.11 are complete and
accepted as a local-only, non-operational Control Plane milestone on `main`.
The narrowly bounded M3.12 post-acceptance exception completed both phases:
its readiness plan was accepted, and its isolated non-production rehearsal —
an in-memory deterministic double with no filesystem, database, network, or
provider adapter — was executed and accepted through eight separate one-action
approvals. See the [M3 operational acceptance
decision](M3_OPERATIONAL_ACCEPTANCE_DECISION.md) and the [M3.12 execution
acceptance decision](M3.12_EXECUTION_ACCEPTANCE_DECISION.md). No PostgreSQL
migration, worker, real media intake, or provider connection has occurred at
any point in M3.
`ready_for_schedule_use` is an asset eligibility state only: it is neither M4
publication, M5 execution, M7 encoding readiness, nor listener availability.
See [the M3 implementation and authorization
record](M3_IMPLEMENTATION_AND_AUTHORIZATION_RECORD.md), the [M3.11 acceptance
and handoff boundary](M3.11_M3_ACCEPTANCE_AND_HANDOFF_BOUNDARY.md), and the
[M3.12 operational staging activation authorization and isolated
media-lifecycle rehearsal](M3.12_OPERATIONAL_STAGING_ACTIVATION_READINESS_AND_AUTHORIZATION_PLAN.md).
M3 completion did not grant M4.1. Separate owner approvals have since accepted
M4.1–M4.10 as local-only Control Plane sub-milestones. M4 is complete and
accepted. M5.1 has since completed as a local-only, unavailable-only runtime
authority boundary; M5.2 remains separately approval-gated.

Every M3 sub-milestone remains station-scoped by `id + station_id`, uses
`station_reference_forbidden` for cross-station references and `not_found` for
missing/out-of-scope resources, and emits content-free audit/evidence only.
Completion never authorizes the next item, any other plane, or an operational
action without a new human approval.

#### M3.1 — Scope, authority, and asset-lifecycle contract

- **Authoritative record:**
  [M3.1 media intake and immutable asset-lifecycle contract](M3.1_MEDIA_INTAKE_AND_IMMUTABLE_ASSET_LIFECYCLE_CONTRACT.md)
  is the decision-oriented planning record for this sub-milestone.
- **Purpose / planes / mode / prerequisites:** Define the Programming Control
  Plane-only lifecycle and named owner authority; local-only, using accepted
  M1/M2 boundaries and the committed M3 contract as prerequisites.
- **Scope / exclusions:** Specify proposed, validated, approved-for-processing,
  processing, analyzed, metadata-pending, schedule-use-ready, rejection,
  quarantine, failure, retry, and supersession semantics. Exclude schedules,
  runtime dispatch, encoding, relays, and listener effects.
- **Controls / evidence / gate:** Prove typed transition legality, station
  isolation, and content-free audit vocabulary. An owner must approve M3.2
  after accepting the contract evidence.
- **Dependencies / stop:** Feeds M3.2–M3.9 and later M4 eligibility only; stop
  on an ambiguous state owner or a state that implies publication/execution.

#### M3.2 — Additive PostgreSQL persistence and migration design

- **Authoritative record:**
  [M3.2 additive PostgreSQL persistence and migration design](M3.2_ADDITIVE_POSTGRESQL_PERSISTENCE_AND_MIGRATION_DESIGN.md)
  is the decision-oriented planning record for this sub-milestone.
- **Purpose / planes / mode / prerequisites:** Define additive Control Plane
  tables for requests/jobs, immutable assets/revisions/provenance, results,
  candidates/resolutions, and failures; local-only and dependent on M3.1.
- **Scope / exclusions:** Require same-station foreign keys, idempotency,
  constrained transitions, append-only provenance, and least-privilege intent.
  Do not execute a migration, connect to a database, or introduce SQLite.
- **Controls / evidence / gate:** Review migration ordering/checksum behavior,
  station-scoped SQL, immutability, and content-free errors. A separate owner
  approval is required before M3.3; migration execution requires M3.10.
- **Dependencies / stop:** Supplies M3.8–M3.10; stop and forward-fix under the
  migration owner if an additive change threatens M1/M2 compatibility.

#### M3.3 — Safe source-reference, quarantine, and rejection model

- **Authoritative record:**
  [M3.3 safe source-reference and quarantine boundary](M3.3_SAFE_SOURCE_REFERENCE_AND_QUARANTINE_BOUNDARY.md)
  is the implementation and evidence record for this local-only sub-milestone.
- **Purpose / planes / mode / prerequisites:** Define opaque source-reference,
  validation, quarantine, rejection, and recovery contracts in the Control
  Plane; local-only, dependent on M3.1–M3.2.
- **Scope / exclusions:** Permit safe opaque handles and bounded categories
  only. Exclude paths, filenames, uploaded bytes, unrestricted filesystem
  access, real media intake, and any downstream signal.
- **Controls / evidence / gate:** Test out-of-scope handles, failure-category
  redaction, quarantine/retry transitions, and content-free evidence. Owner
  approval is required before M3.4.
- **Dependencies / stop:** Bounds M3.4 processing inputs; stop/quarantine on
  unknown ownership, limit breach, or a reference that could expose content.

#### M3.4 — Asynchronous processing-worker boundary

- **Authoritative record:**
  [M3.4 disabled async processing boundary](M3.4_DISABLED_ASYNC_PROCESSING_BOUNDARY.md)
  is the implementation and evidence record for this local-only sub-milestone.
- **Purpose / planes / mode / prerequisites:** Specify an injectable future
  worker boundary for approved station-scoped job references; local-only and
  disabled by default, dependent on M3.1–M3.3.
- **Scope / exclusions:** Define time, size, format, memory, concurrency, and
  resource-limit contracts plus safe failure behavior. Exclude worker launch,
  container/subprocess use, network access, and filesystem access by default.
- **Controls / evidence / gate:** Demonstrate deterministic fake adapters and
  prove dry-runs invoke no processing/runtime/encoder/relay adapter. Owner
  approval is required before M3.5.
- **Dependencies / stop:** Provides only a future boundary for M3.5–M3.7;
  sandbox owner stops and forward-fixes any limit or isolation failure.

#### M3.5 — EBU R128 measurement and normalization recommendation contract

- **Authoritative record:**
  [M3.5 EBU R128 normalization analysis contract](M3.5_EBU_R128_NORMALIZATION_ANALYSIS_CONTRACT.md)
  is the implementation and evidence record for this local-only sub-milestone.
- **Purpose / planes / mode / prerequisites:** Define Control Plane records for
  integrated loudness, loudness range, true peak, analysis version, and a
  derived gain recommendation; local-only, dependent on M3.4.
- **Scope / exclusions:** Separate measured facts, derived recommendation, and
  future operator-approved settings. Exclude file mutation, DSP, gain
  application, playout, and encoder configuration.
- **Controls / evidence / gate:** Validate ranges, impossible values,
  deterministic output, station isolation, and content-free audits. Owner
  approval is required before M3.6.
- **Dependencies / stop:** Supplies M5 design input only after later approval;
  stop/quarantine unsupported or invalid analysis rather than substituting data.

#### M3.6 — Cue, fade, duration, and quality-analysis contract

- **Authoritative record:**
  [M3.6 cue and fade analysis contract](M3.6_CUE_AND_FADE_ANALYSIS_CONTRACT.md)
  is the implementation and evidence record for this local-only sub-milestone.
- **Purpose / planes / mode / prerequisites:** Define deterministic Control
  Plane cue-in/out, fade-in/out, duration, confidence, quality, and analysis
  version contracts; local-only, dependent on M3.4–M3.5.
- **Scope / exclusions:** Use local deterministic fixtures only and retain the
  distinction between measured suggestions and future approved execution
  settings. Exclude media parsing and actual crossfade behavior.
- **Controls / evidence / gate:** Test ordering, bounds, confidence, quality,
  quarantine/retry, station isolation, and content-free evidence. Owner
  approval is required before M3.7.
- **Dependencies / stop:** Feeds later M5 cue/fade design; analysis owner stops
  on corrupt/ambiguous inputs and records only a safe category.

#### M3.7 — Provider-neutral metadata-candidate boundary

- **Authoritative record:**
  [M3.7 metadata enrichment and operator resolution contract](M3.7_METADATA_ENRICHMENT_AND_OPERATOR_RESOLUTION_CONTRACT.md)
  is the implementation and evidence record for this local-only sub-milestone.
- **Purpose / planes / mode / prerequisites:** Define a Control Plane
  candidate/provenance interface compatible with a future MusicBrainz adapter;
  local-only, dependent on M3.3–M3.6.
- **Scope / exclusions:** Use deterministic local providers and explicit
  operator resolution. Exclude credentials, scraping, outbound requests,
  background network behavior, and automatic overwrite of approved revisions.
- **Controls / evidence / gate:** Validate candidate confidence/provenance,
  station isolation, append-only resolution, and content-free audit records.
  Owner approval is required before M3.8.
- **Dependencies / stop:** Supports M3.8 review and future metadata work;
  provider owner stops on uncertain attribution rather than guessing or merging.

#### M3.8 — Visual Operator Dashboard shell

- **Authoritative record:** [M3.8 visual Operator Dashboard shell](M3.8_VISUAL_OPERATOR_DASHBOARD_SHELL.md)
  is the implementation and evidence record for this local-only sub-milestone.
- **Purpose / planes / mode / prerequisites:** Render a responsive,
  keyboard-accessible, station-scoped Programming Control Plane workspace that
  makes the four planes and the M3 fixture-only lifecycle contracts visible;
  local-only, dependent on M3.1–M3.7.
- **Scope / exclusions:** Provide system overview, Media Workspace,
  content-free evidence shape, and clearly unavailable future-plane views.
  Preserve session/RBAC station context, `not_found`, and
  `station_reference_forbidden` behavior without presenting fixtures as live
  data. Exclude uploads, media/source access, worker dispatch, M3 command
  controls, schedule publication, runtime execution, encoder/relay/Icecast
  control, provider lookup, persistence activation, and deployment.
- **Controls / evidence / gate:** Test semantic navigation, keyboard focus,
  station-context guard, fixture/unavailable labels, content-free output, and
  absence of any M3 or cross-plane operational route. Owner approval is
  required before M3.9.
- **Dependencies / stop:** Hands only the visual boundary and its focused
  evidence to M3.9. The Control Plane owner stops and forward-fixes any view
  that could disclose out-of-scope data or imply/control another plane.

#### M3.9 — Isolation, idempotency, failure, and recovery validation

- **Authoritative record:** [M3.9 isolation, idempotency, failure, and
  recovery validation](M3.9_ISOLATION_IDEMPOTENCY_FAILURE_AND_RECOVERY_VALIDATION.md)
  is the implementation and acceptance record for this local-only
  sub-milestone.
- **Purpose / planes / mode / prerequisites:** Consolidate local contract
  validation across the Control Plane and disabled worker boundary; dependent
  on M3.1–M3.8.
- **Scope / exclusions:** Exercise station isolation, duplicate requests,
  illegal transitions, immutable provenance, failures, quarantine, retry, and
  audit redaction. Exclude real input, database activation, and external calls.
- **Controls / evidence / gate:** Require focused test evidence, static route
  non-dispatch proof, and a content-free acceptance packet. Owner approval is
  required before any M3.10 staging proposal.
- **Dependencies / stop:** Establishes the M3.10 prerequisite set; stop on a
  missing test category and assign forward-fix ownership before proceeding.

#### M3.10 — Separately authorized staging activation/rehearsal proposal

- **Authoritative record:** [M3.10 staging activation/rehearsal
  proposal](M3.10_STAGING_ACTIVATION_REHEARSAL_PROPOSAL.md) is the
  implementation and acceptance record for this local-only, non-executable
  sub-milestone.
- **Purpose / planes / mode / prerequisites:** Define, but do not perform, a
  bounded staging-only rehearsal of the M3 persistence/worker boundary;
  dependent on M3.1–M3.9 and a new owner authorization.
- **Scope / exclusions:** Require reviewed commit/migration identity,
  least-privilege authority, isolated target, empty/non-production input,
  sandbox limits, rollback plan, and inactive M4/M5/M7 planes. Exclude media
  ingestion, network providers, listener access, and production.
- **Controls / evidence / gate:** Acceptance evidence must cover ledger/schema,
  station isolation, no-network/no-downstream dispatch, stop/cleanup result,
  and content-free logs. Completion does not authorize M3.11 or a repeat.
- **Dependencies / stop:** Change owner stops on target ambiguity, missing
  authority, unexpected input, or plane activation; only that owner can choose
  rollback or a separately approved forward-fix.

#### M3.11 — M3 acceptance and handoff boundary

- **Authoritative record:** [M3.11 M3 acceptance and handoff
  boundary](M3.11_M3_ACCEPTANCE_AND_HANDOFF_BOUNDARY.md) is the implementation
  and acceptance record for this local-only, decision-only sub-milestone.
- **Purpose / planes / mode / prerequisites:** Record a decision-only M3
  acceptance assessment for the Control Plane and disabled boundary; local-only
  or staging-evidence review only, dependent on all accepted prior M3 items.
- **Scope / exclusions:** Confirm that asset readiness is not scheduling,
  publication, runtime execution, encoding, or listener availability. Exclude
  activation of M4, M5, M7, or production.
- **Controls / evidence / gate:** Require content-free local/staging evidence,
  isolation results, open-risk ownership, and explicit M4/M5/M7 handoff
  boundaries. A new human approval is required for each later milestone.
- **Dependencies / stop:** Supplies M4 catalog eligibility and M5 design input
  only after M3.12 execution is completed and separately accepted; decision
  owner stops if acceptance language implies operational authority.

#### M3.12 — Operational Staging Activation Authorization and Isolated Media-Lifecycle Rehearsal

- **Authoritative record:** [M3.12 operational staging activation authorization
  and isolated media-lifecycle rehearsal](M3.12_OPERATIONAL_STAGING_ACTIVATION_READINESS_AND_AUTHORIZATION_PLAN.md)
  defines the sole narrowly bounded post-acceptance exception path; the
  [Phase 1 readiness-plan acceptance decision](M3.12_PHASE_1_READINESS_PLAN_ACCEPTANCE_DECISION.md)
  accepts its non-executable plan. The accepted [Phase 2 staging-target
  safe-classification decision](M3.12_PHASE_2_STAGING_TARGET_SAFE_CLASSIFICATION_DECISION.md)
  records an opaque `safely_classified` candidate from accepted governance
  evidence only, and the eight one-action gates in [Action
  1](M3.12_PHASE_2_ACTION_1_TARGET_VALIDATION_AUTHORIZATION.md) through
  [Action 8](M3.12_PHASE_2_ACTION_8_RECOVERY_DECISION.md), followed by the
  [M3.12 execution acceptance decision](M3.12_EXECUTION_ACCEPTANCE_DECISION.md),
  completed the isolated rehearsal.
- **Purpose / planes / mode / prerequisites:** Define two strictly ordered
  phases: a non-executable readiness/authorization plan, then an isolated
  non-production rehearsal only after plan acceptance and explicit one-action
  human approvals. It preserves accepted M3.1–M3.11 local-only scope and is
  dependent on M3.10/M3.11 and accepted M2 authorization/DR decisions. **Both
  Phase 1 and Phase 2 are complete and accepted** as of 2026-08-05 UTC; the
  Phase 2 rehearsal exercised only the in-memory `M3RehearsalAdapter`
  deterministic double defined in the [rehearsal adapter
  contract](M3.12_REHEARSAL_ADAPTER_CONTRACT.md).
- **Scope / exclusions:** The plan may define target/cohort classifications,
  authorities, gates, stop/recovery decisions, evidence, and future acceptance.
  A separately approved rehearsal may validate controlled M3 intake,
  quarantine, processing/analysis, review, cleanup, recovery/restore, and
  evidence only within each approved action. Until then, those activities are
  excluded. M3.12 always excludes production, listener impact, M4 scheduling/
  publication, M5 runtime/DSP, M7 encoding/Icecast, M9 cutover, M10 appliance
  work, deployment, DNS, and legacy-system changes.
- **Controls / evidence / gate:** Require `id + station_id`, `not_found`,
  `station_reference_forbidden`, content-free evidence, explicit
  rollback/forward-fix ownership, inactive downstream planes, and distinct
  human approvals for target validation, media access, intake, processing,
  review, cleanup, evidence review, recovery, and M3 operational acceptance.
  No approval creates standing authority. All nine gates (target validation
  through M3 operational acceptance) are complete; see [Action
  1](M3.12_PHASE_2_ACTION_1_TARGET_VALIDATION_AUTHORIZATION.md) through
  [Action 8](M3.12_PHASE_2_ACTION_8_RECOVERY_DECISION.md) and the [M3
  operational acceptance decision](M3_OPERATIONAL_ACCEPTANCE_DECISION.md).
  M3.12 completion did not itself grant M4.1; its separate owner approval has
  since been received. M4.1 remains local planning only and does not authorize
  M4.2.
- **Dependencies / stop:** Preserve strict plane separation and stop on target
  ambiguity, unapproved media, authority/scope gaps, protected evidence,
  cross-station mismatch, or any plane activation. Only the named recovery
  authority may choose rollback, deferral, or a separately approved forward-fix.

### Phase 4: M4 — Advanced Scheduling & Versioned Publication

**Objective:** Build a deterministic 24-hour planning engine that produces
immutable, station-scoped schedule artifacts. Publication is never runtime
execution. M4.1–M4.10 are accepted local Control Plane boundaries. M5 is the
next separately approval-gated phase.

#### M4.1 — Schedule-domain and versioning contract

- **Authoritative record:**
  [M4.1 schedule-domain and versioning contract](M4.1_SCHEDULE_DOMAIN_AND_VERSIONING_CONTRACT.md)
  and its [acceptance decision](M4.1_SCHEDULE_DOMAIN_AND_VERSIONING_ACCEPTANCE_DECISION.md)
  complete this decision-oriented planning sub-milestone. No M4.1 code,
  migration, or operational action exists.
- **Purpose / planes / mode / prerequisites:** Define Control Plane schedule,
  proposal, approval, publication, version, compatibility, and rollback
  contracts; local-only, dependent on accepted M1 and an explicit M4 approval.
- **Scope / exclusions:** Preserve `Proposed/Preview → Approved → Published`
  and immutable version identity. Exclude runtime queue mutation, playout,
  encoders, relays, and listener changes.
- **Controls / evidence / gate:** The accepted local review validates
  station-scoped IDs, legal state transitions, content-free audit vocabulary,
  and rollback semantics. Owner approval is required before M4.2.
- **Dependencies / stop:** Establishes all M4 interfaces and M5 consumption
  boundary; stop on any contract that treats publication as execution.

#### M4.2 — Catalog and asset-eligibility boundary

- **Authoritative record:** The [M4.2 catalog and asset-eligibility
  boundary](M4.2_CATALOG_AND_ASSET_ELIGIBILITY_BOUNDARY.md) and its
  [acceptance decision](M4.2_CATALOG_AND_ASSET_ELIGIBILITY_ACCEPTANCE_DECISION.md)
  complete this local-only Control Plane sub-milestone. It introduces no
  migration, persistence activation, schedule generation, or operational
  action.
- **Purpose / planes / mode / prerequisites:** Define the Control Plane query
  from M3 assets to M4 candidates; local-only, dependent on M4.1 and the M3
  handoff boundary.
- **Scope / exclusions:** Accept only station-scoped, non-superseded,
  schedule-use-eligible asset references and immutable revisions. Exclude media
  acquisition, metadata overwrite, and any change to asset lifecycle.
- **Controls / evidence / gate:** The accepted local boundary tests `id +
station_id`, `not_found`, `station_reference_forbidden`, immutable
  projections, content-free rejection evidence, and no operational adapter.
  Owner approval is required before M4.3.
- **Dependencies / stop:** Feeds deterministic planning only; stop and
  forward-fix under catalog ownership for ambiguous eligibility/provenance.

#### M4.3 — Deterministic 24-hour clock and template model

- **Authoritative record:** The [M4.3 deterministic 24-hour clock and template
  model](M4.3_DETERMINISTIC_24_HOUR_CLOCK_AND_TEMPLATE_MODEL.md) and its
  [acceptance decision](M4.3_DETERMINISTIC_24_HOUR_CLOCK_AND_TEMPLATE_MODEL_ACCEPTANCE_DECISION.md)
  complete this local-only Control Plane sub-milestone. It introduces no live
  clock, persistence, schedule generation, or operational action.
- **Purpose / planes / mode / prerequisites:** Specify station-local clock
  templates, slots, timezone handling, and 24-hour planning input; local-only,
  dependent on M4.1–M4.2.
- **Scope / exclusions:** Define data and deterministic ordering only. Exclude
  live wall-clock control, queue mutation, media analysis, and runtime timing.
- **Controls / evidence / gate:** The accepted local boundary proves repeatable
  fixtures, civil-time timezone/DST cases, station isolation, content-free plan
  summaries, immutable input snapshots, and no operational adapter. Owner
  approval is required before M4.4.
- **Dependencies / stop:** Supplies M4.4–M4.5; stop on nondeterminism or a
  timezone ambiguity, with planning owner responsible for forward-fix.

#### M4.4 — Separation-policy model and evaluation engine

- **Authoritative record:** The [M4.4 separation-policy model and evaluation
  engine](M4.4_SEPARATION_POLICY_MODEL_AND_EVALUATION_ENGINE.md) and its
  [acceptance decision](M4.4_SEPARATION_POLICY_MODEL_AND_EVALUATION_ENGINE_ACCEPTANCE_DECISION.md)
  complete this local-only Control Plane sub-milestone. It introduces no
  schedule generation, metadata enrichment, persistence, or operational
  action.
- **Purpose / planes / mode / prerequisites:** Define deterministic artist,
  title, album, category, and policy separation evaluation; Control Plane,
  local-only, dependent on M4.2–M4.3.
- **Scope / exclusions:** Evaluate only approved policy inputs and candidate
  references. Exclude silent policy overrides, metadata enrichment, and runtime
  enforcement outside published artifacts.
- **Controls / evidence / gate:** The accepted local boundary tests conflicts,
  precedence, empty catalog, missing-key fail-closed behavior, station
  isolation, content-free reasons, and no operational adapter. Owner approval
  is required before M4.5.
- **Dependencies / stop:** Feeds preview generation; stop on unsatisfied policy
  and return a proposal rather than auto-publishing a degraded schedule.

#### M4.5 — Dry-run generation, conflict reporting, and preview

- **Authoritative record:** The [M4.5 dry-run generation, conflict reporting,
  and preview](M4.5_DRY_RUN_GENERATION_CONFLICT_REPORTING_AND_PREVIEW.md) and
  its [acceptance decision](M4.5_DRY_RUN_GENERATION_CONFLICT_REPORTING_AND_PREVIEW_ACCEPTANCE_DECISION.md)
  complete this local-only Control Plane sub-milestone. It introduces no
  persistence, approval, publication, execution, or operational action.
- **Purpose / planes / mode / prerequisites:** Generate deterministic,
  read-only station schedule previews and conflict reports; local-only,
  dependent on M4.1–M4.4.
- **Scope / exclusions:** Provide explainable, content-minimized preview and
  safe count/category evidence. Exclude approval, publication, execution, and
  external dispatch.
- **Controls / evidence / gate:** The accepted local boundary proves repeated
  output stability, incomplete-plan safe stop without retained partial
  assignments, no writes/downstream adapter calls, station isolation, and
  content-free evidence. Owner approval is required before M4.6.
- **Dependencies / stop:** Is the sole input to approval review; stop on an
  invalid or incomplete plan and retain no inferred replacement content.

#### M4.6 — Proposed-schedule approval workflow

- **Authoritative record:** The [M4.6 proposed-schedule approval
  workflow](M4.6_PROPOSED_SCHEDULE_APPROVAL_WORKFLOW.md) and its [acceptance
  decision](M4.6_PROPOSED_SCHEDULE_APPROVAL_WORKFLOW_ACCEPTANCE_DECISION.md)
  complete this local-only Control Plane sub-milestone. It introduces no
  API/UI route, persistence, publication, execution, or operational action.
- **Purpose / planes / mode / prerequisites:** Add explicit authorized review
  and approval for a named proposed schedule; Control Plane, local-only,
  dependent on M4.5.
- **Scope / exclusions:** Require CSRF/RBAC, station-scoped reviewer action,
  immutable reviewed inputs, and rejection/rework. Exclude publication,
  runtime signaling, and automatic approval.
- **Controls / evidence / gate:** The accepted local boundary tests
  unauthorized/out-of-scope behavior, legal immutable decisions, idempotency,
  rejection/rework, and content-free approval/rejection evidence. Owner
  approval is required before M4.7.
- **Dependencies / stop:** Produces only an Approved proposal; stop if a
  reviewed input changes and require a new proposal/approval.

#### M4.7 — Immutable versioned publication and atomic rollback design

- **Authoritative record:** The [M4.7 immutable versioned publication and
  atomic rollback design](M4.7_IMMUTABLE_VERSIONED_PUBLICATION_AND_ATOMIC_ROLLBACK_DESIGN.md)
  and its [acceptance decision](M4.7_IMMUTABLE_VERSIONED_PUBLICATION_AND_ATOMIC_ROLLBACK_DESIGN_ACCEPTANCE_DECISION.md)
  complete this local-only Control Plane sub-milestone. It introduces no
  API/UI route, persistence, runtime consumer, or operational action.
- **Purpose / planes / mode / prerequisites:** Define Control Plane publication
  of an approved schedule as an immutable versioned artifact; local-only,
  dependent on M4.6.
- **Scope / exclusions:** Specify atomic publish, compatibility checks,
  version identity, and rollback-to-prior-published artifact. Exclude direct
  runtime consumption, queue control, encoder/relay, and listener activity.
- **Controls / evidence / gate:** The accepted local boundary validates
  immutable artifacts, compatibility-before-pointer atomicity, non-destructive
  rollback, station isolation, and content-free publication/rollback evidence.
  Owner approval is required before M4.8.
- **Dependencies / stop:** M5 may later consume only these artifacts; stop on
  partial publication and let publication owner select rollback/forward-fix.

#### M4.8 — API/UI authorization and safe operator visibility

- **Authoritative record:** [M4.8 API/UI authorization and safe operator
  visibility](M4.8_API_UI_AUTHORIZATION_AND_SAFE_OPERATOR_VISIBILITY.md) and
  its [acceptance decision](M4.8_API_UI_AUTHORIZATION_AND_SAFE_OPERATOR_VISIBILITY_ACCEPTANCE_DECISION.md)
  complete this local-only visibility boundary.
- **Purpose / planes / mode / prerequisites:** Provide station-scoped Control
  Plane views/actions for preview, review, approval, publication status, and
  rollback proposal; local-only, dependent on M4.1–M4.7.
- **Scope / exclusions:** Preserve `not_found`, CSRF/RBAC, accessible pending/
  failed/unavailable states, and content-free audit. Exclude runtime/encoder/
  listener controls and direct schedule execution.
- **Controls / evidence / gate:** The accepted boundary tests each route for
  isolation, safe errors, CSRF/RBAC, non-dispatch, audit redaction, and
  accessible unavailable status. Owner approval is required before M4.9.
- **Dependencies / stop:** Feeds validation only; stop any UI/API path that can
  bypass proposed/approved/published state ownership.

#### M4.9 — Local validation and controlled staging rehearsal proposal

- **Authoritative record:** [M4.9 local validation and controlled staging
  rehearsal proposal](M4.9_LOCAL_VALIDATION_AND_CONTROLLED_STAGING_REHEARSAL_PROPOSAL.md)
  and its [acceptance decision](M4.9_LOCAL_VALIDATION_AND_CONTROLLED_STAGING_REHEARSAL_PROPOSAL_ACCEPTANCE_DECISION.md)
  complete local validation and proposal work only.
- **Purpose / planes / mode / prerequisites:** Complete static/local validation
  and define a separately authorized staging-only publication rehearsal;
  dependent on M4.1–M4.8.
- **Scope / exclusions:** Require reviewed artifact identity, isolated target,
  authority separation, rollback/cleanup, and inactive M5/M7 planes. Exclude
  runtime execution, audio output, public listeners, and production.
- **Controls / evidence / gate:** Accepted local evidence covers deterministic
  fixtures, station isolation, publication/rollback modeling, content-free
  results, and inactive later planes. Completion requires an owner decision
  before M4.10.
- **Dependencies / stop:** Operational rehearsal owner stops for any unexpected
  runtime path or target ambiguity and owns rollback/approved forward-fix.

#### M4.10 — M4 acceptance and M5 boundary

- **Authoritative record:** [M4.10 M4 acceptance and M5
  boundary](M4.10_M4_ACCEPTANCE_AND_M5_BOUNDARY.md) accepts all M4 Control
  Plane work as local-only, non-operational artifacts.
- **Purpose / planes / mode / prerequisites:** Record decision-only acceptance
  of M4 Control Plane artifacts and their versioned handoff; dependent on all
  accepted M4 sub-milestones.
- **Scope / exclusions:** State expressly that Published is not Executed and
  that no runtime, source encoder, Icecast, or listener control is authorized.
- **Controls / evidence / gate:** Require content-free acceptance evidence,
  station isolation, rollback posture, and compatibility/open-risk ownership.
  A separate human approval is required for M5.
- **Dependencies / stop:** Supplies M5.2 only; acceptance owner stops if a
  record implies runtime activation or unreviewed artifact consumption.

### Phase 5: M5 — Playout Runtime, DSP & Automation

**Objective:** Validate a supervised, separately deployable shadow runtime that
consumes only approved, published M4 artifacts. M5.1 is complete as a
local-only, unavailable-only authority contract; no M5 item authorizes source
encoding or listener-facing streaming.

#### M5.1 — Runtime architecture, authority, and control-plane boundary

- **Status / authoritative record:** Complete as a local-only, non-operational
  boundary. [M5.1 runtime architecture, authority, and Control Plane
  boundary](M5.1_RUNTIME_ARCHITECTURE_AUTHORITY_AND_CONTROL_PLANE_BOUNDARY.md)
  and its [acceptance decision](M5.1_RUNTIME_ARCHITECTURE_AUTHORITY_AND_CONTROL_PLANE_BOUNDARY_ACCEPTANCE_DECISION.md)
  are authoritative.
- **Purpose / planes / mode / prerequisites:** Define Playout & Automation
  Runtime ownership, supervisor/worker roles, and one-way Control Plane
  contracts; local-only, dependent on M4.10 and explicit M5 approval.
- **Scope / exclusions:** Control Plane writes programming; runtime writes
  playback/health observations through a versioned contract. Exclude direct
  HTTP/UI device/process/encoder/Icecast control and legacy runtime dependencies.
- **Controls / evidence / gate:** The accepted local coverage validates the
  authority matrix, station isolation, content-free telemetry/audit, and safe
  unavailable state. Owner approval is required before M5.2.
- **Dependencies / stop:** Bounds every M5 sub-milestone; stop on shared writer
  authority or a cross-plane command path and assign runtime owner forward-fix.

#### M5.2 — Published-schedule consumption contract

- **Status:** Unstarted and paused by the owner while [ADR 0003's AzuraCast
  product evaluation](ADRs/0003-azuracast-product-evaluation.md) remains
  deferred. This creates no approval to begin M5.2.
- **Purpose / planes / mode / prerequisites:** Define Runtime retrieval and
  verification of an approved M4 Published version only; local/static,
  dependent on M4.10 and M5.1.
- **Scope / exclusions:** Require version, station, integrity, compatibility,
  epoch, and read-only consumption checks. Exclude Proposed/Approved-only
  plans, automatic publication, queue mutation from UI, and external outputs.
- **Controls / evidence / gate:** Test stale/invalid/cross-station artifact
  rejection, offline safe-stop, and content-free evidence. Owner approval is
  required before M5.3.
- **Dependencies / stop:** Supplies M5 playout input only; runtime owner stops
  on verification failure and never substitutes an inferred schedule.

#### M5.3 — Playout daemon, isolated deck, and routing model

- **Purpose / planes / mode / prerequisites:** Specify an unprivileged runtime
  daemon, deck responsibilities, local IPC, and per-station routing isolation;
  local/synthetic only, dependent on M5.1–M5.2.
- **Scope / exclusions:** Define deck state and supervised routing without
  exposing ambient host authority. Exclude live hardware action, source
  encoders, mounts, public listeners, and production processes.
- **Controls / evidence / gate:** Validate process/IPC boundaries, station
  separation, synthetic state transitions, and content-free runtime records.
  Owner approval is required before M5.4.
- **Dependencies / stop:** Feeds M5.4–M5.6; watchdog owner safely stops an
  isolated daemon on invalid routing or unsafe resource behavior.

#### M5.4 — Asset access, provenance, and integrity boundary

- **Purpose / planes / mode / prerequisites:** Define Runtime access to only
  approved immutable M3 asset revisions via a constrained reference mechanism;
  local/synthetic, dependent on M3.11 and M5.2–M5.3.
- **Scope / exclusions:** Require station, revision, rights/provenance, and
  integrity checks before decode. Exclude arbitrary paths, user uploads,
  mutation, metadata overwrite, and filesystem traversal.
- **Controls / evidence / gate:** Test missing/cross-station/corrupt references,
  safe stop, quarantine handoff, and content-free audit. Owner approval is
  required before M5.5.
- **Dependencies / stop:** Provides bounded input to DSP; runtime owner stops
  rather than playing or repairing unverified assets.

#### M5.5 — EBU R128 DSP-chain design

- **Purpose / planes / mode / prerequisites:** Design station Runtime DSP order:
  approved gain application, EQ, multiband compression, limiter, and shared
  program-bus processing; local/synthetic, dependent on M3.5 and M5.3–M5.4.
- **Scope / exclusions:** Use M3 measurements/recommendations only after a
  future approved setting is present. Exclude source-file modification,
  uncontrolled AGC, independent encoder remastering, and live output.
- **Controls / evidence / gate:** Define level/peak/headroom, bypass, overload,
  failure, station-isolation, and content-free measurement evidence. Owner
  approval is required before M5.6.
- **Dependencies / stop:** Feeds future synthetic DSP validation; DSP owner
  safe-stops on missing approved settings or violated processing limits.

#### M5.6 — Cue, fade, and crossfade execution model

- **Purpose / planes / mode / prerequisites:** Define Runtime use of approved
  M3 cue/fade settings and M4 artifact ordering; local/synthetic, dependent on
  M3.6 and M5.2–M5.5.
- **Scope / exclusions:** Specify deterministic transitions, fallbacks, and
  safe silence behavior. Exclude automatic asset-analysis approval, source
  mutation, encoder control, and listener output.
- **Controls / evidence / gate:** Validate synthetic boundary/quality cases,
  invalid-setting rejection, station isolation, and content-free evidence.
  Owner approval is required before M5.7.
- **Dependencies / stop:** Supplies the shadow runtime model; transition owner
  stops/forward-fixes unsafe fallbacks rather than silently changing settings.

#### M5.7 — Sandboxed automation contract

- **Purpose / planes / mode / prerequisites:** Define WASM-first, optionally
  separately approved JS automation for Runtime-local decisions; local/static,
  dependent on M5.1–M5.6.
- **Scope / exclusions:** Enforce 50 ms maximum execution, 64 MB maximum
  memory, no filesystem, network, process, arbitrary host I/O, WASI, or
  ambient capability; allow only bounded allowlisted calls.
- **Controls / evidence / gate:** Require fuel/watchdog limits, escape and
  regression tests, station isolation, content-free logs, and safe termination.
  Owner approval is required before M5.8.
- **Dependencies / stop:** No script can gain new authority; sandbox owner stops
  on limit/capability breach and requires a new decision for any JS expansion.

#### M5.8 — Runtime observability, fault containment, and safe stop

- **Purpose / planes / mode / prerequisites:** Define Runtime health, playback
  observations, watchdogs, fault categories, and containment; local/synthetic,
  dependent on M5.1–M5.7.
- **Scope / exclusions:** Use content-free station/epoch/sequence/status/timing
  evidence only. Exclude secrets, media metadata, raw paths, automatic
  cross-plane remediation, and public monitoring claims.
- **Controls / evidence / gate:** Test crash, decoder, silence, disk, CPU,
  IPC, and watchdog safe-stop behavior plus station isolation. Owner approval
  is required before M5.9.
- **Dependencies / stop:** Feeds shadow validation; runtime owner owns safe-stop
  and a separately approved rollback/forward-fix decision.

#### M5.9 — Local synthetic and staging/shadow validation proposal

- **Purpose / planes / mode / prerequisites:** Complete local/synthetic
  validation and define a separately authorized staging/shadow-runtime run;
  dependent on M5.1–M5.8.
- **Scope / exclusions:** Require reviewed code/config, isolated target,
  synthetic/authorized inputs, capacity limits, failure drills, and inactive
  M7/listener planes until separately approved. Exclude public output and prod.
- **Controls / evidence / gate:** Require artifact verification, station
  isolation, safe-stop/cleanup, observability, and content-free outcomes. A
  human owner must approve any run and M5.10 separately.
- **Dependencies / stop:** Run owner stops on unexpected output/network path or
  resource breach and owns rollback/approved forward-fix.

#### M5.10 — M5 acceptance and M7 boundary

- **Purpose / planes / mode / prerequisites:** Record decision-only acceptance
  of the shadow-runtime contract/evidence; dependent on accepted M5.1–M5.9.
- **Scope / exclusions:** Confirm no source encoder, Icecast mount, relay, or
  listener-facing control has been authorized by M5 acceptance.
- **Controls / evidence / gate:** Require content-free validation, fault and
  station-isolation evidence, unresolved-risk ownership, and published-artifact
  consumption proof. A separate human approval is required for M7.
- **Dependencies / stop:** Supplies M7.3 only; acceptance owner stops if M5
  language would imply network output or listener availability.

### Phase 6: M6 — Listener Requests & Moderation

**Objective:** Accept listener requests into a station-scoped moderation process
that can create future M4 proposals only. M6 is unstarted and never directly
dispatches runtime, encoder, relay, stream, or listener-facing changes.

#### M6.1 — Public-intake threat model, privacy, abuse, and station routing

- **Purpose / planes / mode / prerequisites:** Define public-facing Control
  Plane threat model, privacy minimization, abuse controls, and station routing;
  local/static, dependent on explicit M6 approval.
- **Scope / exclusions:** Identify data minimization, rate limits, bot controls,
  retention, and safe error categories. Exclude public activation, data
  collection, runtime dispatch, and legacy service integration.
- **Controls / evidence / gate:** Review threat model, station isolation,
  content-free audit/evidence boundaries, and owner/accountability matrix.
  Owner approval is required before M6.2.
- **Dependencies / stop:** Bounds all M6 work; privacy owner stops on an
  unreviewed personal-data flow or cross-station routing ambiguity.

#### M6.2 — Request-domain and content-minimizing audit model

- **Purpose / planes / mode / prerequisites:** Define station-scoped request,
  status, moderation, expiration, and appeal references; local-only, dependent
  on M6.1 and M1 authorization patterns.
- **Scope / exclusions:** Persist only necessary opaque/content-minimized
  references and safe categories. Exclude media content, title/artist/path,
  credentials, raw request bodies in audit, and schedule mutation.
- **Controls / evidence / gate:** Validate `id + station_id`, `not_found`,
  `station_reference_forbidden`, redaction, and lifecycle transitions. Owner
  approval is required before M6.3.
- **Dependencies / stop:** Supplies M6.3–M6.7; stop and forward-fix under the
  privacy owner if an audit field can reveal protected content.

#### M6.3 — Public request API/UI and abuse controls

- **Purpose / planes / mode / prerequisites:** Design/request local test API/UI
  with station routing, rate limits, bot/abuse controls, and safe errors;
  local/static, dependent on M6.1–M6.2.
- **Scope / exclusions:** Require no direct access to catalog internals or
  downstream adapters. Exclude live public exposure, runtime signaling,
  automatic approval, and any external provider call without a new approval.
- **Controls / evidence / gate:** Test limits, malformed requests, tenant
  boundaries, accessible errors, and content-free audit. Owner approval is
  required before M6.4.
- **Dependencies / stop:** Produces proposals only; service owner stops on
  abuse-control failure and uses separately approved mitigation/forward-fix.

#### M6.4 — Eligibility and deduplication rules

- **Purpose / planes / mode / prerequisites:** Define deterministic request
  eligibility/deduplication against approved catalog and schedule information;
  Control Plane, local-only, dependent on M3/M4 boundaries and M6.3.
- **Scope / exclusions:** Use station-scoped opaque references and policy
  results only. Exclude hidden catalog disclosure, media lookup, schedule
  publication, and any runtime action.
- **Controls / evidence / gate:** Test duplicate/expired/ineligible paths,
  `not_found`, isolation, and content-free reasons. Owner approval is required
  before M6.5.
- **Dependencies / stop:** Feeds moderation; stop on ambiguous matching rather
  than selecting a presumed asset or schedule slot.

#### M6.5 — Operator moderation queue and review actions

- **Purpose / planes / mode / prerequisites:** Provide Control Plane operator
  queue, review, approve/reject/defer, and safe status views; local-only,
  dependent on M6.2–M6.4.
- **Scope / exclusions:** Preserve RBAC/CSRF, station scope, explicit human
  decisions, and accessibility. Exclude auto-moderation execution, schedule
  publication, playout, encoder, relay, and listener control.
- **Controls / evidence / gate:** Test authorization, out-of-scope IDs,
  content-free audit, and no downstream dispatch. Owner approval is required
  before M6.6.
- **Dependencies / stop:** An approved request remains a proposal; moderation
  owner stops/reviews conflicts before any schedule-proposal action.

#### M6.6 — Approved insertion proposal into future schedule slots

- **Purpose / planes / mode / prerequisites:** Define a moderated request’s
  conversion into an M4 Proposed schedule change; Control Plane, local-only,
  dependent on M4.1–M4.6 and M6.5.
- **Scope / exclusions:** Preserve M4 `Proposed → Approved → Published` state
  transitions and station isolation. Exclude slot auto-publication, runtime
  execution, queue insertion, and listener feedback claims.
- **Controls / evidence / gate:** Test deterministic conflict handling,
  immutable references, safe errors, and content-free linkage audit. Owner
  approval is required before M6.7.
- **Dependencies / stop:** Hands to M4 approval only; stop on conflict and let
  programming owner choose reject, defer, or separately approved forward-fix.

#### M6.7 — Rejection, expiration, appeal, and misuse handling

- **Purpose / planes / mode / prerequisites:** Define safe request closure,
  expiration, appeal/recovery, and abuse escalation workflows; local-only,
  dependent on M6.1–M6.6.
- **Scope / exclusions:** Use bounded statuses and non-disclosing user-facing
  messages. Exclude punitive automation, personal-data disclosure, and
  downstream service actions.
- **Controls / evidence / gate:** Test invalid transitions, retention/expiry,
  station isolation, audit redaction, and accessible unavailable states. Owner
  approval is required before M6.8.
- **Dependencies / stop:** Feeds validation; privacy/moderation owners stop on
  policy ambiguity and define any forward-fix under new approval.

#### M6.8 — Local/static and staging validation proposal

- **Purpose / planes / mode / prerequisites:** Complete local/static validation
  and define separately approved staging checks; dependent on M6.1–M6.7.
- **Scope / exclusions:** Require isolated target, threat-model acceptance,
  rate-limit/bot test evidence, station isolation, rollback/cleanup, and no
  direct runtime dispatch. Exclude public rollout and production.
- **Controls / evidence / gate:** Record content-free validation evidence and
  assigned stop/rollback owner. Completion requires a separate owner decision
  before M6.9.
- **Dependencies / stop:** Staging owner stops for unexpected data exposure,
  public reachability, or downstream signal; no automatic retry is authorized.

#### M6.9 — M6 acceptance and M4/M5 handoff boundary

- **Purpose / planes / mode / prerequisites:** Record decision-only acceptance
  of moderation-to-proposal behavior; dependent on all accepted M6 items.
- **Scope / exclusions:** Confirm M6 can only feed M4 proposals and does not
  publish schedules or execute M5 runtime work.
- **Controls / evidence / gate:** Require content-free isolation/abuse/privacy
  evidence and open-risk ownership. Any M4 publication or M5 execution needs
  its own human approval.
- **Dependencies / stop:** Supplies future M4 review only; acceptance owner
  stops if a request path bypasses programming state ownership.

### Phase 7: M7 — Source Encoding, Icecast & Metadata

**Objective:** Design and validate private, recoverable source encoding and
Icecast 2.x distribution from approved M5 Runtime output only. M7 is
unstarted; no item authorizes listener-facing activation without a separate
explicit decision.

#### M7.1 — Encoding/Icecast architecture decision and authority record

- **Purpose / planes / mode / prerequisites:** Define Source Encoder and
  Listener-Facing Icecast plane ownership, interfaces, and decision authority;
  documentation/local-only, dependent on M5.10 and explicit M7 approval.
- **Scope / exclusions:** Icecast 2.x is the sole future listener platform;
  encoders consume approved M5 output only. Exclude SAM, PAL, SHOUTcast, direct
  Control Plane output control, listeners, and production.
- **Controls / evidence / gate:** Review plane boundaries, authority matrix,
  station isolation, and content-free evidence categories. Owner approval is
  required before M7.2.
- **Dependencies / stop:** Governs M7.2–M7.10; stop on shared credentials or
  any unbounded cross-plane path and assign architecture-owner forward-fix.

#### M7.2 — Network segmentation, mount isolation, and secret lifecycle design

- **Purpose / planes / mode / prerequisites:** Define private network segments,
  per-station mount boundaries, purpose-limited secret/reference lifecycle, and
  least privilege; documentation/local-only, dependent on M7.1.
- **Scope / exclusions:** Use opaque secret references and service identities.
  Exclude actual secret values, host details, DNS, firewall changes, public
  exposure, and shared cross-station mounts.
- **Controls / evidence / gate:** Require design review for `id + station_id`,
  rotation/expiry owner, `not_found` behavior, and content-free logs. Owner
  approval is required before M7.3.
- **Dependencies / stop:** Prerequisite for all activation; security owner stops
  on ambiguous network/secret ownership and approves rollback/forward-fix.

#### M7.3 — Source-encoder input contract

- **Purpose / planes / mode / prerequisites:** Define source encoder receipt of
  approved M5 processed PCM/output contract only; local/synthetic, dependent
  on M5.10 and M7.1–M7.2.
- **Scope / exclusions:** Require station, epoch, sequence, format, integrity,
  and backpressure boundaries. Exclude independent media decode/DSP,
  Control Plane commands, raw asset access, and listener mounts.
- **Controls / evidence / gate:** Test stale/cross-station input rejection,
  safe no-output state, and content-free telemetry. Owner approval is required
  before M7.4.
- **Dependencies / stop:** Supplies encoding profiles only; encoder owner stops
  on invalid runtime output and never invents/reprocesses program material.

#### M7.4 — AAC-LC and MP3 multi-bitrate profile validation

- **Purpose / planes / mode / prerequisites:** Define AAC-LC and MP3 profiles,
  bitrate ladder, quality/resource criteria, and station-scoped configuration;
  local/synthetic, dependent on M7.3.
- **Scope / exclusions:** Validate codec behavior and capacity without
  independent remastering. Exclude legacy codec/platform dependencies, public
  streams, and production encoder operation.
- **Controls / evidence / gate:** Require synthetic quality, CPU/memory,
  latency, failure, and configuration-isolation evidence. Owner approval is
  required before M7.5.
- **Dependencies / stop:** Feeds topology validation; codec owner safe-stops on
  resource/quality breach and owns approved profile rollback/forward-fix.

#### M7.5 — Primary/secondary Icecast 2.x topology and failover design

- **Purpose / planes / mode / prerequisites:** Define private primary/secondary
  Icecast 2.x topology, per-station mount isolation, failover target of less
  than 500 ms, and evidence methodology; staging design, dependent on M7.1–M7.4.
- **Scope / exclusions:** Measure source continuity and metadata convergence
  separately. Exclude public listener activation, untested automatic DNS
  changes, SHOUTcast/SAM dependencies, and production failover.
- **Controls / evidence / gate:** Specify clock source, probe placement,
  percentile/sample methodology, fault injection, station isolation, and
  content-free evidence. Owner approval is required before M7.6.
- **Dependencies / stop:** Supplies staging drills; topology owner stops on
  unknown exposure or missed objective and owns rollback/forward-fix decision.

#### M7.6 — Mount lifecycle, health checks, and safe observability

- **Purpose / planes / mode / prerequisites:** Define mount state, health,
  readiness, alerting, and listener-safe observability across Encoder/Icecast;
  local/staging design, dependent on M7.2–M7.5.
- **Scope / exclusions:** Report only safe station/mount/status/timing counts.
  Exclude media/title/artist content, listener identifiers, secrets, raw paths,
  and automatic cross-plane remediation.
- **Controls / evidence / gate:** Validate disabled/failing/recovering states,
  station/mount isolation, and content-free audit. Owner approval is required
  before M7.7.
- **Dependencies / stop:** Feeds drills and pilot evidence; observability owner
  stops on data leakage or a health check that can control output.

#### M7.7 — Dynamic ICY/webhook metadata synchronization boundary

- **Purpose / planes / mode / prerequisites:** Define runtime-owned metadata
  events keyed by `(station_id, stream_epoch, sequence)` for Encoder/Icecast
  adapters; local/synthetic, dependent on M5.8 and M7.3–M7.6.
- **Scope / exclusions:** Reject stale epochs, expose synchronizing state, and
  limit operational logs to safe event status/timing. Exclude provider scraping,
  listener tracking, raw metadata in logs, and Control Plane overwrite.
- **Controls / evidence / gate:** Test ordering, duplicate/stale rejection,
  failover reconciliation, station isolation, and content-free evidence. Owner
  approval is required before M7.8.
- **Dependencies / stop:** Supports staged metadata parity only; metadata owner
  stops on epoch ambiguity rather than publishing uncertain data.

#### M7.8 — Controlled staging activation, drills, rollback, and recovery

- **Purpose / planes / mode / prerequisites:** Define a separately authorized
  staging-only Encoder/Icecast activation and failure-drill run; dependent on
  M7.1–M7.7 plus a new owner approval.
- **Scope / exclusions:** Require reviewed configuration, purpose-limited
  authority, private target, synthetic/authorized source, failover/recovery
  plan, and cleanup. Exclude listener-facing/public traffic and production.
- **Controls / evidence / gate:** Capture content-free topology, latency,
  failover, metadata, isolation, rollback, and final inactive-state evidence.
  Completion does not authorize M7.9.
- **Dependencies / stop:** Run owner stops on exposure, secret anomaly, missed
  recovery target, or unexpected plane action; owner controls rollback/forward-fix.

#### M7.9 — Listener-facing pilot/cutover eligibility decision

- **Purpose / planes / mode / prerequisites:** Assemble a decision packet for a
  separately approved, bounded listener-facing pilot/cutover; documentation
  only, dependent on M7.8 evidence and explicit owner review.
- **Scope / exclusions:** Include capacity, security, monitoring, support,
  rollback, and listener-impact criteria. Exclude actual listener activation,
  DNS/traffic change, and production authorization.
- **Controls / evidence / gate:** Require content-free evidence references,
  accountable cutover/rollback owner, stop conditions, and independent approval
  before any pilot. Owner approval is required before M7.10.
- **Dependencies / stop:** Supplies M8 input only; decision owner stops if
  staging evidence is incomplete or mixes encoder and listener authority.

#### M7.10 — M7 acceptance and M8 boundary

- **Purpose / planes / mode / prerequisites:** Record decision-only acceptance
  of M7 design/staging evidence and its shadow-test handoff; dependent on all
  accepted M7 sub-milestones.
- **Scope / exclusions:** Confirm no standing listener-facing or production
  authority and no dependence on SHOUTcast, SAM, or PAL.
- **Controls / evidence / gate:** Require content-free station/mount/failover/
  metadata evidence, risk ownership, and M8 prerequisites. A new human
  approval is required for each M8 shadow period.
- **Dependencies / stop:** Feeds M8.1 only; acceptance owner stops if criteria
  imply public availability or bypass separate pilot/cutover approval.

### Phase 8: M8 — Parallel Operations & Parity Verification

**Objective:** Run explicitly authorized, isolated shadow operations to verify
parity without listener impact. M8 is unstarted; each shadow period is a
separate approval and never authorizes M9 promotion.

#### M8.1 — Shadow-operation authority, isolation, and safety

- **Purpose / planes / mode / prerequisites:** Define shadow authority,
  isolated topology, no-listener-impact controls, and accountable stop owner
  across all four planes; shadow-only, dependent on M7.10.
- **Scope / exclusions:** Require separated source/monitoring paths, no public
  mounts/traffic, and no production mutation. Exclude listener exposure, DNS,
  legacy shutdown, and autonomous failover promotion.
- **Controls / evidence / gate:** Review isolation proof, permissions, station
  scope, content-free telemetry, and safe-stop test. Owner approval is required
  before M8.2 and each shadow run.
- **Dependencies / stop:** Bounds all M8 activity; shadow owner stops on any
  listener impact/unknown exposure and owns rollback/forward-fix choice.

#### M8.2 — Parallel schedule/runtime input and time-alignment design

- **Purpose / planes / mode / prerequisites:** Define station-scoped parallel
  M4 artifact/M5 runtime input, reference clocks, epochs, and alignment model;
  shadow-only, dependent on M8.1 and M4/M5 handoffs.
- **Scope / exclusions:** Compare equivalent approved artifacts without shared
  writable state. Exclude schedule publication, active queue control, and
  input from unapproved/legacy control paths.
- **Controls / evidence / gate:** Validate deterministic alignment, stale
  artifact/epoch rejection, station isolation, and content-free timing data.
  Owner approval is required before M8.3.
- **Dependencies / stop:** Feeds parity measurements; time owner stops on drift
  or ambiguous source of truth and assigns an approved forward-fix.

#### M8.3 — Audio-parity measurement methodology

- **Purpose / planes / mode / prerequisites:** Define synthetic/authorized
  shadow audio-continuity, transition, loudness, headroom, and listening
  evaluation methodology; shadow-only, dependent on M8.2.
- **Scope / exclusions:** Separate measured signal properties from subjective
  review and document intended differences. Exclude listener telemetry,
  publishing measurement content, and production output.
- **Controls / evidence / gate:** Specify samples, thresholds, calibration,
  reviewer roles, station isolation, and content-free evidence references.
  Owner approval is required before M8.4.
- **Dependencies / stop:** Feeds discrepancy triage; measurement owner stops on
  invalid instrumentation or unapproved input.

#### M8.4 — Metadata-parity measurement methodology

- **Purpose / planes / mode / prerequisites:** Define shadow comparison of
  runtime/encoder/Icecast metadata epochs, sequence, convergence, and intended
  availability behavior; shadow-only, dependent on M7.7 and M8.2.
- **Scope / exclusions:** Measure timing/status without retaining titles,
  artists, payloads, listener identifiers, or provider data in operational logs.
- **Controls / evidence / gate:** Test stale/duplicate event handling,
  synchronization, station isolation, and content-free results. Owner approval
  is required before M8.5.
- **Dependencies / stop:** Feeds parity decision; metadata owner stops on event
  leakage or source ambiguity and uses an approved forward-fix.

#### M8.5 — Operational telemetry, drift detection, and evidence collection

- **Purpose / planes / mode / prerequisites:** Define cross-plane shadow
  telemetry, drift thresholds, retention, and evidence correlation; shadow-only,
  dependent on M8.1–M8.4.
- **Scope / exclusions:** Use station/epoch/sequence/status/timing/count fields
  only. Exclude media content, raw SQL, credentials, tokens, CSRF, paths, and
  listener-identifying telemetry.
- **Controls / evidence / gate:** Validate collection isolation, clock drift,
  alerting, redaction, and safe unavailable states. Owner approval is required
  before M8.6.
- **Dependencies / stop:** Provides drill/triage evidence; observability owner
  stops any collector that expands authority or content retention.

#### M8.6 — Cross-plane failure-drill plan

- **Purpose / planes / mode / prerequisites:** Specify controlled drills for
  Control Plane, Runtime, Encoder, Icecast, metadata, and rollback paths;
  shadow-only, dependent on M8.1–M8.5.
- **Scope / exclusions:** Define injection, containment, recovery, listener-
  impact guard, and cleanup per plane. Exclude public disruption, production
  drills, and automatic promotion.
- **Controls / evidence / gate:** Require content-free pass/fail timing,
  station-isolation, safe-stop, rollback, and residual-risk evidence. Owner
  approval is required before M8.7 and each drill.
- **Dependencies / stop:** Drill owner immediately stops on impact boundary
  breach; rollback/forward-fix remains an explicit owner decision.

#### M8.7 — Thresholds, discrepancy triage, and forward-fix ownership

- **Purpose / planes / mode / prerequisites:** Set audio, metadata, recovery,
  capacity, and operator-review thresholds plus discrepancy classification;
  shadow-only, dependent on M8.3–M8.6.
- **Scope / exclusions:** Distinguish accepted intended differences from defects
  and require per-plane ownership. Exclude quiet acceptance, scope expansion,
  or automatic production promotion.
- **Controls / evidence / gate:** Validate reproducibility, station isolation,
  content-free issue evidence, and bounded forward-fix plans. Owner approval is
  required before M8.8.
- **Dependencies / stop:** No unresolved critical discrepancy proceeds; assigned
  owner chooses stop, rollback, or separately approved forward-fix.

#### M8.8 — Controlled shadow periods and readiness decisions

- **Purpose / planes / mode / prerequisites:** Define duration, observation,
  signoff, restart, and decision gates for controlled shadow periods;
  shadow-only, dependent on M8.1–M8.7.
- **Scope / exclusions:** Each period has an explicit start/stop, target,
  authority, evidence boundary, and listener-impact guard. Exclude standing
  shadow authorization, public cutover, and legacy decommission.
- **Controls / evidence / gate:** Require accepted threshold results, drill
  outcomes, operator signoff, station isolation, and content-free readiness
  evidence. Owner approval is required before M8.9.
- **Dependencies / stop:** Shadow owner stops any period on threshold/impact
  breach and records only safe evidence for rollback/forward-fix review.

#### M8.9 — M8 acceptance and M9 promotion eligibility

- **Purpose / planes / mode / prerequisites:** Produce a decision-only M9
  promotion-eligibility packet; dependent on accepted M8.1–M8.8.
- **Scope / exclusions:** State readiness conditions, remaining risk, rollback
  window design, and evidence references. Exclude production approval, DNS/
  traffic changes, listener cutover, and legacy shutdown.
- **Controls / evidence / gate:** Require content-free parity, fault, capacity,
  metadata, and station-isolation evidence with named owners. A new explicit
  production approval is required for every M9 action.
- **Dependencies / stop:** Feeds M9.1 only; decision owner stops if shadow
  evidence is incomplete, stale, or cannot prove no listener impact.

### Phase 9: M9 — Listener Cutover & Legacy Decommissioning

**Objective:** Execute a separately approved production cutover only after M8
evidence is accepted, maintain an explicit rollback window, and decommission
legacy SAM Pro/SHOUTcast 1.9.8 only after separately approved stabilization.
M9 is unstarted; no section creates standing production authority.

#### M9.1 — Production-promotion decision packet

- **Purpose / planes / mode / prerequisites:** Assemble the owner decision
  packet for a named production action across all four planes; documentation
  only, dependent on M8.9.
- **Scope / exclusions:** Identify reviewed artifact, target, window, authority,
  listener-impact analysis, rollback owner, and evidence boundary. Exclude
  approval-by-document, production changes, and legacy shutdown.
- **Controls / evidence / gate:** Require content-free M8 evidence, station
  isolation, capacity/security review, and explicit stop criteria. A human owner
  must separately approve M9.2; completion authorizes nothing itself.
- **Dependencies / stop:** Governs all M9 actions; decision owner stops on
  missing evidence or ambiguous rollback authority.

#### M9.2 — Listener-impact, communications, monitoring, and support readiness

- **Purpose / planes / mode / prerequisites:** Define listener-impact analysis,
  communication/support ownership, incident contacts, and safe monitoring;
  production-planning only, dependent on M9.1.
- **Scope / exclusions:** Plan messaging, escalation, status categories, and
  content-minimized monitoring. Exclude unapproved listener notifications,
  traffic changes, public identifiers in evidence, and runtime control.
- **Controls / evidence / gate:** Review station/mount isolation, support runbook,
  privacy/audit boundary, and readiness criteria. Owner approval is required
  before M9.3.
- **Dependencies / stop:** Feeds cutover plan; support owner stops if monitoring
  cannot distinguish safe availability from a listener-impacting failure.

#### M9.3 — Production Icecast capacity, resilience, security, and rollback validation

- **Purpose / planes / mode / prerequisites:** Define an explicitly approved
  production validation plan for Encoder/Icecast capacity, resilience, security,
  and rollback; production-eligible planning, dependent on M9.1–M9.2.
- **Scope / exclusions:** Require isolated station/mount limits, secret lifecycle,
  failover, observability, and rollback validation. Exclude execution without a
  named change approval, DNS/traffic changes, and legacy shutdown.
- **Controls / evidence / gate:** Require content-free capacity/failover/security
  evidence, rollback timing, and owner signoff. Owner approval is required
  before M9.4.
- **Dependencies / stop:** Production change owner stops on capacity/security
  failure and selects rollback or separately approved forward-fix.

#### M9.4 — Controlled DNS/traffic cutover plan

- **Purpose / planes / mode / prerequisites:** Define the exact staged
  DNS/traffic cutover, observation, stop, and rollback sequence; eligible only
  for a separately approved production action, dependent on M9.1–M9.3.
- **Scope / exclusions:** Name authoritative DNS/traffic decision, immutable
  configuration/artifact, station/mount order, and rollback window. Exclude
  standing approval, automatic failover promotion, and legacy decommission.
- **Controls / evidence / gate:** Require preflight, change-window, safe probes,
  content-free evidence, and explicit cutover/rollback authority. A fresh owner
  approval is required immediately before execution.
- **Dependencies / stop:** Cutover owner stops on any defined threshold or
  ambiguity; only the named authority can order rollback/forward-fix.

#### M9.5 — Post-cutover monitoring, incident response, and stabilization evidence

- **Purpose / planes / mode / prerequisites:** Define post-cutover observation,
  incident response, recovery, and stabilization evidence; production-eligible
  only after an approved M9.4 execution.
- **Scope / exclusions:** Monitor safe station/mount/health/latency/count
  signals with explicit duration and rollback window. Exclude content-bearing
  logs, listener tracking, automatic legacy shutdown, and scope expansion.
- **Controls / evidence / gate:** Require content-free stability/fault/rollback
  evidence, station isolation, and incident ownership. Owner approval is
  required before M9.6.
- **Dependencies / stop:** Incident owner stops/rolls back within the approved
  window on threshold breach; forward-fix needs separate authorization.

#### M9.6 — Royalty-compliance reporting and export boundary

- **Purpose / planes / mode / prerequisites:** Define compliant reporting/export
  capability, data minimization, retention, and access control; production-
  planning/local validation, dependent on M5/M7 observation contracts and M9.5.
- **Scope / exclusions:** Protect reportable playback data with purpose-limited
  access and content-free operational audit. Exclude public exports, raw data in
  logs, credential exposure, and any unapproved external submission.
- **Controls / evidence / gate:** Validate reconciliation, access, retention,
  station attribution, failure handling, and audit redaction. Owner approval is
  required before M9.7.
- **Dependencies / stop:** Compliance owner stops on incomplete reconciliation
  or data-protection failure and owns separately approved remediation.

#### M9.7 — Legacy dependency inventory and decommission plan

- **Purpose / planes / mode / prerequisites:** Inventory legacy SAM Pro and
  SHOUTcast 1.9.8 dependencies strictly as comparison/decommission scope and
  plan their retirement; documentation only, dependent on M9.5–M9.6.
- **Scope / exclusions:** Identify dependency, owner, consumer, rollback-window,
  and retention obligations. Do not introduce legacy components into the future
  Control Plane/Runtime or operate/shut them down.
- **Controls / evidence / gate:** Require content-free inventory evidence,
  replacement verification, station impact, and explicit shutdown criteria.
  Owner approval is required before M9.8.
- **Dependencies / stop:** Decommission owner stops on unresolved consumer,
  reporting duty, or rollback need; no inferred removal is authorized.

#### M9.8 — Verified legacy shutdown after stabilization

- **Purpose / planes / mode / prerequisites:** Execute a named legacy shutdown
  only after separately approved stabilization criteria and rollback-window
  closure conditions; production-eligible, dependent on M9.1–M9.7.
- **Scope / exclusions:** Require evidence that replacement planes are stable,
  support/compliance obligations are met, and no station remains dependent.
  Exclude automatic shutdown, destructive cleanup, and broader decommission.
- **Controls / evidence / gate:** Capture content-free shutdown/verification,
  station-isolation, recovery, and retained-evidence outcomes. A fresh owner
  approval is required for each shutdown action.
- **Dependencies / stop:** Shutdown owner stops on any dependency/incident and
  follows the approved rollback or separately approved forward-fix path.

#### M9.9 — Final architecture acceptance, evidence retention, and handoff

- **Purpose / planes / mode / prerequisites:** Record final multi-plane
  architecture acceptance, evidence retention, rollback-window closure, and
  operational documentation handoff; decision-only, dependent on accepted
  M9.1–M9.8.
- **Scope / exclusions:** Confirm independent deployability, station isolation,
  Icecast 2.x future platform, content protection, support/compliance ownership,
  and retired legacy dependencies. Exclude any new production change.
- **Controls / evidence / gate:** Require content-free final evidence index,
  residual-risk/retention owners, and explicit owner acceptance. Future changes
  remain separately approved work, not a consequence of M9 completion.
- **Dependencies / stop:** Closes this roadmap sequence only when all named
  acceptance criteria are met; decision owner stops if evidence or ownership is
  incomplete.

### Phase 10: M10 — Ubuntu Appliance Packaging, Enrollment, Upgrade, Backup, and Restore

**Objective:** After M3–M9 are complete and accepted, provide the final
delivery target as a bootable, customized Ubuntu Server appliance. The owner
would install it from USB, complete secure first-boot enrollment, access the
Operator Dashboard on the LAN, and use only approved M3 lifecycle capabilities
to add an existing media library. M10 is unstarted, documentation-only, and
does not authorize any appliance operation now.

#### M10 — Ubuntu Appliance Packaging, Enrollment, Upgrade, Backup, and Restore

- **Authoritative record:** [M10 Ubuntu Appliance delivery
  roadmap](M10_UBUNTU_APPLIANCE_DELIVERY_ROADMAP.md) defines this future,
  post-M9 delivery gate.
- **Purpose / planes / mode / prerequisites:** Define a customized Ubuntu
  Server appliance, not a forked operating system or owner-data image. It may
  initially run on one physical server while preserving separate software
  lifecycle/deployability boundaries for the Programming Control Plane and
  Operator Dashboard, PostgreSQL, approved media-processing workers, Playout
  & Automation Runtime, Source Encoder Layer, and Listener-Facing Icecast 2.x
  Layer. It is documentation-only and dependent on accepted M3–M9 plus a new
  explicit M10 approval.
- **Scope / exclusions:** Specify reproducible versioned bootable installer
  images; signed or verifiably pinned packages/images, dependency manifests,
  and build provenance; secure first-boot enrollment; least privilege,
  firewalling, secure updates, upgrade/rollback, backup/restore, recovery, and
  clean-install acceptance. The installer must exclude media, credentials,
  private keys, database secrets, runtime tokens, and owner-specific
  configuration. Exclude building an installer, packaging services, activating
  ingestion, importing real media, deployment, and production operation.
- **Controls / evidence / gate:** Require content-free build-provenance,
  installation, upgrade/rollback, backup/restore, and recovery evidence; LAN
  dashboard availability only after successful authorized installation; and
  media-library intake only through approved M3 lifecycle gates. Preserve
  PostgreSQL-only persistence, Icecast 2.x-only listener delivery, `id +
station_id`, `not_found`, `station_reference_forbidden`, content-free audit,
  and no implicit cross-plane dashboard/API action. Every M10 execution action
  requires its own new human approval.
- **Dependencies / stop:** Document all-in-one boundaries and the future path
  to role/plane-specific appliances without a rewrite. Stop on a requirement
  that collapses a plane boundary, embeds owner data, implies implementation
  authority, or makes an M3 readiness decision operational.

---

## 6. Future Architecture Gates

These are approval-gated design and acceptance requirements for future work,
not authorization to implement or operate those capabilities now.

- **M4 — Published schedule artifacts:** deterministic, versioned artifacts
  with compatibility and integrity checks, immutable resolved media handles,
  atomic activation/rollback, offline-runtime behavior, and runtime read-only
  consumption only after `Published → Executed`.
- **M5 — Runtime, fault model, DSP, and automation:** define four-deck
  responsibilities, idempotent IPC, measurable crash/decoder/silence/disk/CPU
  recovery, and target-codec benchmarks before implementation. Ingestion
  analyzes loudness/cue data; playout applies stored gain and transition-aware
  handling; one shared station processor precedes codec fan-out. Components
  remain replaceable pending capacity, license, and structured listening
  evidence. The automation sandbox is WASM-first: no WASI or ambient host
  access, bounded allowlisted calls, fuel plus watchdog limits, isolated
  execution, and security regression evidence. Arbitrary JavaScript requires
  a separate decision and OS-level isolation design.
- **M7 — Metadata and failover:** a runtime-owned, epoch-aware metadata event
  path fans out to Icecast adapters, WebSocket/SSE, and dashboard/player APIs.
  It must reject stale epochs, expose `synchronizing` during reconciliation,
  and measure audio continuity separately from metadata convergence and
  listener-perceived alignment.
- **M8 — Shadow and parity:** connectivity alone is insufficient. Acceptance
  requires measured transition/listening quality, capacity headroom, restart
  and rollback recovery, corrupt-media/silence handling, source failover,
  metadata correctness, and operator signoff on intended SAM differences.
- **M10 — Ubuntu Appliance delivery:** after accepted M3–M9 only, a
  reproducible Ubuntu Server installer must preserve independently deployable
  plane boundaries, secure enrollment, least privilege, updates, recovery, and
  content-free evidence. It is not an authorization to build, install, or
  operate an appliance before a separate M10 approval.

---

## 7. Capability Replacement Matrix

| Legacy Component (SAM/SHOUTcast) | Modern Replacement System              | Architectural Layer     | Target Milestone |
| :------------------------------- | :------------------------------------- | :---------------------- | :--------------: |
| **Media Library & Ingest**       | PostgreSQL Metadata + Sandboxed Ingest | Control Plane           |        M3        |
| **Rotations, Clocks & Rules**    | Deterministic Schedule Planner         | Control Plane           |      M1–M4       |
| **Queue / Dry-Run Preview**      | Versioned Published Schedules          | Control Plane           |      M1–M4       |
| **Audio Decks & Cueing**         | Supervised Liquidsoap Playout Runtime  | Playout Runtime         |        M5        |
| **DSP, Crossfade & AGC**         | EBU R128 Processing + Station Bus DSP  | Playout Runtime         |        M5        |
| **PAL Scripting**                | Sandboxed WASM/JS Engine               | Playout Runtime         |        M5        |
| **Live-DJ Takeover**             | Explicit Live-Input State Machine      | Playout Runtime         |        M5        |
| **Source Encoders**              | Decoupled AAC-LC / MP3 Encoders        | Source Encoder          |        M7        |
| **Listener Distribution**        | Icecast 2.x Primary/Secondary Relays   | Icecast Layer           |        M7        |
| **Dynamic Metadata**             | Epoch-Aware ICY / Webhook Bridge       | Encoder + Icecast       |        M7        |
| **Song Requests**                | Moderated Request Pipeline             | Control Plane           |        M6        |
| **SoundExchange Reporting**      | History-Derived Exporter               | Control Plane / Runtime |        M9        |

---

## 8. Definition of Done (M10 Appliance Delivery)

The project is officially complete when:

1. All four architectural planes operate independently with isolated permissions and supervisory control.
2. All 5 stations meet strict isolation, audio quality, and dynamic metadata standards across all tests.
3. Programming state strictly obeys `Proposed → Approved → Published → Executed`.
4. Database recovery procedures are verified, credentials are secure, and audit trails remain content-free.
5. Icecast streams, encoder failovers, dynamic metadata, and monitoring are fully validated.
6. Royalty/SoundExchange export logs reconcile accurately with historical data.
7. The system owner formally approves the listener cutover and subsequent retirement of legacy hardware and software.
8. M10 acceptance verifies a reproducible Ubuntu Server appliance installer,
   secure enrollment without embedded owner data, independent plane lifecycle
   boundaries, secure upgrade/rollback and backup/restore/recovery, and a
   future role/plane-appliance split path.
