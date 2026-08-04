# Architecture

## M0 boundary

M0 contains only a local control-plane scaffold. It has no real-time audio process, no media library, no network output adapter, and no public listener. The HTTP server binds to loopback by default.

## Layered design

```text
Browser admin UI
       │ local HTTP / future authenticated API
Control plane ─── PostgreSQL (production) / SQLite (M0 development)
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

M0 uses SQLite through Node's built-in `node:sqlite` API to keep local setup small and make its SQL migration boundary tangible. Production is planned to use PostgreSQL: repository interfaces avoid SQLite-specific types, migrations are SQL assets, and no SQLite path or behavior is part of the public API contract. Before M1, choose a production migration runner and validate concurrent writer/locking semantics.

### Security posture

M0 has no authentication by design and is loopback-only. A future authenticated UI/API will enforce users, roles, station grants, audit records, credential references (not credential values), and least privilege. Configuration records and logs must never contain output passwords or other production secrets.

## Media migration path

The current library is not accessed in M0. A future migration will be an explicit, read-only inventory/export mapping into `MediaAsset` and metadata records, with immutable source identifiers, checksums where authorized, a dry-run report, and operator approval before any copy/import. The platform can operate with an empty library from the beginning.

## Future curated test-library policy

The test library is separately built and not committed in M0. It will contain exactly 50 unique, complete MP3s per station format, from a manually curated fixed manifest only—never a broad archive search at download time. Each track manifest entry must include source page, direct URL, attribution, license (CC0, CC-BY, or public domain only), and station-fit reason.

- StreamingSoundtracks: complete cinematic/instrumental scores, never stems, loops, or effects.
- 1980s.FM: authentic '80s-style synthpop, new wave, dreamwave, or melodic synthwave; not generic EDM.
- Adagio.FM: slow, lyrical classical or neo-classical; not fast movements.
- Death.FM: death metal, melodic death, technical death, or deathcore; not generic metal or noise.
- Entranced.FM: uplifting, progressive, melodic, or psytrance; not generic techno, house, dubstep, or DnB.
