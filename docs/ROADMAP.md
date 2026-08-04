# 24Seven.FM Audio Streaming System Roadmap

**Last Updated:** August 4, 2026
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

- M1–M9 are sequential, primary approval gates. Completion of a milestone or
  internal work package never authorizes the next one, deployment,
  infrastructure activity, or runtime execution.
- Completed work is recorded with bounded evidence and an actual UTC completion
  date. Forecasts apply only to uncompleted, approval-gated work and are
  recalibrated at each approved boundary.
- M2 is formally accepted as of 2026-08-04 UTC. Its finalized M2.5
  decision-only packet requires a new, separately scoped owner authorization
  before any future staging action; it creates no standing operational
  approval. M3.1 planning is the next project approval-gated sub-goal.

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
No application, audio/listener, production, or M3 work is authorized by these
records.

| Area                  | Current Worktree Status                                                                                                   | State                          |
| :-------------------- | :------------------------------------------------------------------------------------------------------------------------ | :----------------------------- |
| **Live Persistence**  | `PostgresPersistence`, `PostgresM1Repositories`, dual runtime/migrator URLs, loopback Compose, `002_m1_control_plane.sql` | M2 Accepted (isolated staging) |
| **Identity & Auth**   | scrypt hashing, server sessions, station-scoped grants, bootstrap/login adapters, CSRF protection                         | M1.1 / M1.2 Complete           |
| **Programming Model** | Station-scoped media, playlists, separation rules, rotations, clocks, program blocks, scheduled events                    | M1.1 / M1.2 Complete           |
| **API Boundary**      | Protected programming adapter, safe error mapping, authenticated dry-run route                                            | M1.2 Complete                  |
| **Update Validation** | Scoped load/merge/validate/persist paths across all 7 entity families                                                     | M1.2 Complete                  |
| **Operator UI**       | Station-scoped UI connected to protected APIs; explicit unavailable runtime status                                        | M1.3 Complete (`9772b69`)      |
| **Validation**        | `npm run check` passes (build, lint, typecheck, test, dependency audit)                                                   | M1 Complete                    |

---

## 4. Master Milestone Timeline

| Milestone | Focus Area                  | Focused Effort | Elapsed Duration |    Indicative Window     | Key Gate / Dependency                |
| :-------: | :-------------------------- | :------------: | :--------------: | :----------------------: | :----------------------------------- |
|  **M1**   | Control Plane & Security    |    Complete    |     Complete     | **Completed 2026-08-04** | Formal M1 Local Acceptance           |
|  **M2**   | Staging, Migration & DR     |    Complete    |     Complete     | **Completed 2026-08-04** | M2 Acceptance Decision               |
|  **M3**   | Ingestion & Asset Lifecycle |    8–14 wks    |    14–28 wks     |   Apr 2027 – Oct 2027    | Rights Manifest & Sandbox Policy     |
|  **M4**   | Advanced Scheduling         |    7–12 wks    |    10–20 wks     |   Jul 2027 – Mar 2028    | Immutable Asset Handles              |
|  **M5**   | Playout Runtime & DSP       |   16–28 wks    |    28–52 wks     |   Feb 2028 – May 2029    | Published Schedule Artifacts         |
|  **M6**   | Requests & Moderation       |    5–9 wks     |     8–18 wks     |   May 2029 – Oct 2029    | Public Threat Model Approval         |
|  **M7**   | Encoders & Icecast          |   10–18 wks    |    18–36 wks     |   Oct 2029 – Jul 2030    | Private Infrastructure Approval      |
|  **M8**   | Shadow Testing & Parity     |    8–14 wks    |    16–32 wks     |   Aug 2030 – May 2031    | Parallel Listening & Failover Drills |
|  **M9**   | Cutover & Decommissioning   |    6–12 wks    |    12–28 wks     |   Jun 2031 – Mar 2032    | Compliance Review & Final Sign-off   |

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
  work, production activity, or M3.
- **Objective:** Validate PostgreSQL migrations and disaster recovery in an isolated, non-public staging environment.
- **Key Tasks:** Apply `002_m1_control_plane.sql` via dedicated migration role; verify least-privilege runtime access; establish backup/restore drills and recovery runbooks.
- **M2.1 Staging Activation Plan:** [Staging activation and migration-rehearsal plan](M2.1_STAGING_ACTIVATION_PLAN.md) is complete and published as `b7a51cd`; it authorizes no operational activity.
- **M2.2 Migration Execution Plan:** [Staging migration preflight and run plan](M2.2_STAGING_MIGRATION_PREFLIGHT_AND_RUN_PLAN.md) is complete and published as `2cd85c3`. The approved migration, idempotent five-station seed, and post-migration least-privilege validation completed with content-free evidence; application activation remains separately gated.
- **M2.2 Least-Privilege Role-and-Grant Artifact:** [Role-and-grant artifact](M2.2_STAGING_ROLE_AND_GRANT_ARTIFACT.sql) defines platform/bootstrap, migrator, runtime, backup, restore, and evidence-review boundaries and was applied only in approved M2.2 phases. It creates no runtime/audio authority.
- **M2.3 Topology Validation Plan:** [Staging topology validation plan](M2.3_STAGING_TOPOLOGY_VALIDATION_PLAN.md) is complete and published as `be6a242`; the approved topology observation validated the non-public PostgreSQL-only staging boundary without starting an application or runtime service.
- **M2.4 Backup, Restore, and DR Plan:** [Staging backup, restore, and DR rehearsal plan](M2.4_STAGING_BACKUP_RESTORE_DR_REHEARSAL_PLAN.md) is published as `c8d5904`. The versioned [logical-backup authority artifact](M2.4_STAGING_BACKUP_AUTHORITY.sql) and repository backup command made the approved custom-archive, integrity, manifest, and 14-successful-day retention contract executable. Backup creation and verification completed with content-free evidence `m2-backup-20260804T202301068Z-8a1a86fc408de506`; the isolated recovery-target rehearsal passed with `m2-restore-20260804T211341391Z-33b489dab2be47b7` and cleanup passed.
- **M2.5 Operational-Authorization Decision Packet:** [Operational-authorization decision packet](M2.5_OPERATIONAL_AUTHORIZATION_DECISION_PACKET.md) is finalized as a decision-only record. It records the accepted M2 posture and the exact future owner gates for any Compose/service, migration, runtime, backup/restore, topology, opaque-reference, or promotion action. It creates no standing approval and performed no operation. **Next project approval gate: M3.1 media-intake and immutable asset-lifecycle contract planning only; any executable staging action separately requires an explicit owner authorization.**

### Phase 3: M3 — Media Ingestion, Metadata & Asset Lifecycle

- **Objective:** Establish a rights-cleared, sandboxed media intake pipeline operating on an empty-library baseline.
- **Key Tasks:** Curate 50 CC0/Public-Domain tracks per station (250 total); build an asynchronous worker for FFmpeg-based EBU R128 loudness measurement, true peak, and silence/fade candidates.

### Phase 4: M4 — Advanced Scheduling & Versioned Publication

- **Objective:** Build a deterministic 24-hour planning engine that outputs versioned, immutable schedule artifacts.
- **Key Tasks:** Clock/rotation compiler, gap/conflict resolution, atomic schedule versioning, and rollback capability.

### Phase 5: M5 — Playout Runtime, DSP & Automation

- **Objective:** Validate a supervised shadow runtime that consumes only verified published schedule artifacts.
- **Key Tasks:** Rust supervisor as authority for artifact consumption, health, recovery, and metadata events; replaceable, unprivileged Liquidsoap worker under a narrow local contract; 4-deck behavior and cueing; per-track gain plus shared program-bus processing; WASM-first sandbox (50 ms maximum execution and memory below the 64 MB external cap).

### Phase 6: M6 — Listener Requests & Moderation

- **Objective:** Process listener requests into proposed schedule slots via operator moderation.
- **Key Tasks:** Station-scoped rate limits, abuse prevention, anti-spam rules, moderation queue, and non-disruptive future-slot scheduling.

### Phase 7: M7 — Source Encoding, Icecast & Metadata

- **Objective:** Build private, recoverable encoding and distribution pipes.
- **Key Tasks:** Dual AAC-LC and MP3 encoders reading from the M5 processed PCM bus without independent re-mastering; primary/secondary Icecast topology; epoch-aware metadata distribution keyed by `(station_id, stream_epoch, sequence)`.

### Phase 8: M8 — Parallel Operations & Parity Verification

- **Objective:** Run read-only parallel playout alongside legacy systems to verify parity.
- **Key Tasks:** Audio continuity and transition metrics, failover drills (worker crash, media corruption, network loss), and manual operator listening evaluations.

### Phase 9: M9 — Listener Cutover & Legacy Decommissioning

- **Objective:** Execute a controlled cutover, maintain a temporary rollback window, and decommission legacy systems.
- **Key Tasks:** Phased DNS migration, SoundExchange compliance export validation, stability observation period, and formal retirement of SAM Pro / SHOUTcast 1.9.8.

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

## 8. Definition of Done (M9 Completion)

The project is officially complete when:

1. All four architectural planes operate independently with isolated permissions and supervisory control.
2. All 5 stations meet strict isolation, audio quality, and dynamic metadata standards across all tests.
3. Programming state strictly obeys `Proposed → Approved → Published → Executed`.
4. Database recovery procedures are verified, credentials are secure, and audit trails remain content-free.
5. Icecast streams, encoder failovers, dynamic metadata, and monitoring are fully validated.
6. Royalty/SoundExchange export logs reconcile accurately with historical data.
7. The system owner formally approves the listener cutover and subsequent retirement of legacy hardware and software.
