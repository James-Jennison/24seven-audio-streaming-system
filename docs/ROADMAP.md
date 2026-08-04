# Roadmap

## Governing constraints

- Keep the Programming Control Plane, Playout & Automation Runtime, Source Encoder Layer, and Listener-Facing Icecast Layer strictly decoupled and separately deployable.
- Programming changes move explicitly through **Proposed/Preview (Dry-Run)**, **Approved**, **Published (Versioned)**, and **Executed (Runtime)** states. A control-plane action never implicitly ingests media, changes playout, or operates encoders, relays, or streams.
- PostgreSQL is the sole live persistence store. Icecast 2.x is the future listener-facing streaming platform. SQLite, PAL, SAM binaries, and legacy SHOUTcast dependencies are not live-path dependencies.
- Every station-scoped query, mutation, and reference uses both `id` and `station_id`. Cross-station references return `station_reference_forbidden`; absent or out-of-scope resources return `not_found`.
- Audit records are content-free: actions, entity IDs, and station IDs only—never programming payloads, credentials, session tokens, CSRF values, or raw SQL/database details.

## M1 — Programming Control Plane and Security Baseline (in progress, local only)

- Hardened API, PostgreSQL repository contracts, same-station SQL validation, content-free auditing, deterministic dry-run proposals, and operator UI.
- Current entities: media metadata, playlists, separation rules, rotations, clocks, program blocks, and scheduled events.
- Current work: complete-state update validation, broad protected API coverage, and a clear non-binding dry-run UI.
- Boundary: no migration execution, Compose/container start, deployment, stream, runtime, or production-system action.
- **Gate:** explicit approval to execute the first PostgreSQL migration in staging.

## M2 — Persistence Activation, Staging Infrastructure, and DR

- First PostgreSQL migration execution on `24seven-audio-dev`.
- Docker Compose staging setup plus backup/restore validation.
- **Gate:** explicit approval for media ingestion and asset-processing infrastructure.

## M3 — Media Ingestion, Metadata, and Asset Lifecycle

- Asynchronous import, EBU R128 loudness analysis, cue/fade detection, metadata enrichment, and sandboxed file processing.
- **Gate:** explicit approval for versioned scheduling publication.

## M4 — Advanced Scheduling and Versioned Publication

- Deterministic 24-hour clock generation, separation evaluation, versioned JSON schedule publication, and atomic rollback.
- **Gate:** explicit approval for playout runtime/DSP development and isolated execution.

## M5 — Playout Runtime, DSP, and Sandboxed Automation

- Decoupled playout daemon, four-deck routing, EBU R128 DSP chain, and isolated WASM/JS automation scripts (50 ms maximum execution, 64 MB maximum memory, no I/O or network access).
- **Gate:** explicit approval for public-request intake and moderation workflows.

## M6 — Listener Requests and Moderation

- Rate-limited request portal, automated eligibility checks, operator moderation, and safe insertion into future schedule slots.
- **Gate:** explicit approval for source encoding and Icecast architecture.

## M7 — Source Encoding, Icecast, and Dynamic Metadata

- Multi-bitrate AAC-LC/MP3 encoding, primary/secondary Icecast architecture, sub-500 ms failover target, and ICY/webhook metadata synchronization.
- **Gate:** explicit approval for parallel legacy shadow testing.

## M8 — Parallel Operations, Shadow Testing, and Parity

- Shadow playout against legacy SAM Pro, audio/metadata parity checks, and operational failure drills.
- **Gate:** explicit approval for listener cutover.

## M9 — Listener Cutover and Legacy Decommissioning

- DNS cutover to Icecast, royalty-compliance export, and graceful retirement of SAM Pro and SHOUTcast 1.9.8.

## Capability replacement targets

| Legacy capability           | Replacement                                 | Milestone |
| --------------------------- | ------------------------------------------- | --------- |
| Audio decks and cue routing | Decoupled playout daemon                    | M5        |
| AGC, crossfade, and DSP     | Modular EBU R128 DSP pipeline               | M5        |
| PAL scripting               | Sandboxed WASM/JS VM                        | M5        |
| Category and clock rules    | Deterministic scheduling engine             | M4        |
| Song-request queue          | Public API and operator moderation queue    | M6        |
| SHOUTcast encoders          | Icecast 2.x cluster, AAC-LC/MP3             | M7        |
| SoundExchange logging       | Content-free audit log and royalty exporter | M9        |

## Engineering implementation directives

- Scope every database query, update, and entity reference with `station_id`; enforce the same boundary in HTTP authorization and PostgreSQL.
- Keep logs and audit events content-free. They may include an action type, entity ID, and station ID, but never titles, filenames, user input, programming payloads, credentials, tokens, CSRF values, or SQL/database details.
- A `POST`, `PUT`, `PATCH`, or `DELETE` control-plane request must never directly signal an audio device, playout process, encoder, relay, or stream mount.
- Maintain strict TypeScript, ESLint, formatting, dependency-audit, and safe-error-handling standards through `npm run check`.
