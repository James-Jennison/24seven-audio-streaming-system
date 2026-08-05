# 24Seven Audio Streaming System

24Seven.FM is a Linux-first, web-administered audio-automation and streaming
system for five station-scoped services: StreamingSoundtracks, 1980s.FM,
Adagio.FM, Death.FM, and Entranced.FM.

## Current status

M1 is complete as a local-only Programming Control Plane milestone. M2 is
accepted for isolated, non-public PostgreSQL staging persistence and disaster-
recovery readiness; the M2.5 decision packet grants no standing operational
authority. M3.1–M3.12 are complete and accepted. They establish a
station-scoped asset lifecycle and isolated deterministic-double rehearsal
boundary while retaining the four-plane non-dispatch separation.

M3.8 remains a responsive, station-scoped visual shell for contract status
only. It labels its Media Workspace as fixture/example status and keeps the
playout, encoder, and listener-facing planes explicitly unavailable. M3.12
completed as a content-free, deterministic-double rehearsal; it did not
activate production, listener-facing, runtime, encoder, relay, Icecast, DNS,
or deployment capability. **M4.1 — Schedule-domain and versioning contract**
is complete as a local planning contract. **M4.2 — Catalog and asset-eligibility
boundary** is complete as a read-only, station-scoped Control Plane projection
with no schedule, publication, or runtime effect. **M4.3 — Deterministic
24-hour clock and template model** is complete as a civil-time-only, station-
scoped planning input. It has no live clock or runtime effect. **M4.4 remains
separately approval-gated**.

The future post-M9 delivery target is a bootable, customized Ubuntu Server
appliance with secure first-boot enrollment and LAN Operator Dashboard access.
It does not exist today, is not a forked operating system or an owner-data
image, and may use media-library intake only through separately approved M3
lifecycle capabilities.

## Architecture and safety boundary

The system keeps four independently deployable planes separate:

- Programming Control Plane
- Playout & Automation Runtime
- Source Encoder Layer
- Listener-Facing Icecast Layer

The current implementation belongs only to the non-executing control plane. No
API or UI action can directly initiate ingestion, processing, scheduling,
playout, DSP, encoding, relay, mount, dynamic stream metadata, or listener-
facing change. Asset readiness is not schedule publication, runtime execution,
encoding readiness, or listener availability.

PostgreSQL is the sole live persistence target. Icecast 2.x is the sole future
listener-facing platform direction. Every entity and reference is scoped by
`id + station_id`; cross-station references fail as
`station_reference_forbidden`, while missing or out-of-scope resources return
`not_found`. Audit and evidence records are content-free: they contain only
safe action, opaque entity ID, station ID, state/category, timing, and count
fields—never media content, names, tags, paths, credentials, tokens, CSRF
values, provider payloads, or raw SQL.

Real media ingestion/analysis, worker or persistence activation, provider
integration, playout, encoding, Icecast, deployment, and production action are
not implemented or authorized by these local contracts. Each requires its own
approved plan and evidence.

## Authoritative records and checks

The sequential authority and detailed gates are in
[the roadmap](docs/ROADMAP.md); the verified posture is in
[current state](docs/CURRENT_STATE.md). M3 decisions and boundaries are in the
dedicated `docs/M3.*` records.

```bash
npm run check
```

This runs formatting, linting, strict type checks, tests, dependency audit, and
repository hygiene. It does not start a service, migration, worker, or media
tool.

## License and non-affiliation

Licensed under [Apache-2.0](LICENSE). This project is independent and not
affiliated with, endorsed by, or sponsored by Spatial Audio, SAM Broadcaster,
or Streaming Audio Manager. Those names may be trademarks of their respective
owners and are used only as isolated historical or interoperability context.
