# Architecture

## Historical M0 boundary

This section records the superseded M0 scaffold for historical context only. It
has no authority over the live persistence or operational model. M0 contained
only a local control-plane scaffold, with no real-time audio process, media
library, network output adapter, or public listener. The HTTP server bound to
loopback by default.

## Layered design

```text
Browser admin UI
       │ local HTTP / future authenticated API
Control plane ─── PostgreSQL (sole live persistence store)
       │ versioned commands and observations
Supervised audio runtime (future Liquidsoap process)
       ├── FFmpeg analysis/fallback jobs (future)
       ├── Icecast adapter (future first target)
       └── SHOUTcast adapter (future)
```

### Control plane

The control plane owns station configuration, media metadata, programming configuration, schedules, users/roles, and audit events. It emits desired-state commands but must not fabricate runtime observations.

### Audio runtime

The future runtime is a separately supervised process. It owns the authoritative playback state and output health observations it creates, including handoff state. Liquidsoap is the preferred evaluated engine for source selection, transitions, encoding, and output. FFmpeg remains available for import analysis and bounded fallback work, not as a replacement for durable scheduling.

The contract must include a schema version, stable station ID, UTC observation timestamp, runtime instance ID, freshness/sequence fields, and an explicit unavailable/degraded state. The control plane persists received observations as history but must preserve their writer identity.

### Data and isolation

All station-scoped records have `stationId`; repositories and APIs must require it rather than infer a default station. IDs are opaque stable strings. Stored instants are UTC ISO-8601 values. Schedule display and calculation use an IANA timezone captured in the station/program block, never host-local time.

### Persistence decision

PostgreSQL is the sole live persistence store. The live application composition
uses PostgreSQL repositories and rejects SQLite fallback. Historical M0 tests
used Node's built-in `node:sqlite`; that test-only history is not a live-path
dependency, persistence option, or operational fallback. PostgreSQL migrations
remain approval-gated and have not been applied during M1.

### Security posture

M0 has no authentication by design and is loopback-only. A future authenticated UI/API will enforce users, roles, station grants, audit records, credential references (not credential values), and least privilege. Configuration records and logs must never contain output passwords or other production secrets.

## M1 authentication and programming boundary

M1 adds schema and application contracts for owner, administrator, programmer, operator, and observer roles. Every protected programming mutation must check both role capability and an explicit station grant; owners may manage all stations. Sessions are server-side records with expiry/revocation and a separate CSRF token. Passwords are stored only as scrypt hashes. Audit records capture actor, station, action, entity type/id, and timestamp; they never copy passwords, session tokens, or media content.

The M1 data model covers station-scoped media metadata, playlists/items, rotations, separation rules, clocks, program blocks, and scheduled events. The dry-run selector is deterministic, filters to the chosen station, and reports eligibility reasons. It is a planning aid only: it does not create a queue or audio output.

## Media migration path

The current library is not accessed in M0. A future migration will be an explicit, read-only inventory/export mapping into `MediaAsset` and metadata records, with immutable source identifiers, checksums where authorized, a dry-run report, and operator approval before any copy/import. The platform can operate with an empty library from the beginning.

## Future curated test-library policy

The test library is separately built and not committed in M0. It will contain exactly 50 unique, complete MP3s per station format, from a manually curated fixed manifest only—never a broad archive search at download time. Each track manifest entry must include source page, direct URL, attribution, license (CC0, CC-BY, or public domain only), and station-fit reason.

- StreamingSoundtracks: complete cinematic/instrumental scores, never stems, loops, or effects.
- 1980s.FM: authentic '80s-style synthpop, new wave, dreamwave, or melodic synthwave; not generic EDM.
- Adagio.FM: slow, lyrical classical or neo-classical; not fast movements.
- Death.FM: death metal, melodic death, technical death, or deathcore; not generic metal or noise.
- Entranced.FM: uplifting, progressive, melodic, or psytrance; not generic techno, house, dubstep, or DnB.
