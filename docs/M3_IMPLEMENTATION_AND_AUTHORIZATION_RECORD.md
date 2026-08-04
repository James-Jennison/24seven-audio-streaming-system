# M3 Implementation and Authorization Record

## Status

**Local implementation committed; owner acceptance and operational activation
remain pending. Non-operational.** This record documents the narrow M3 approval
and implementation evidence. It creates no standing authority for a
migration, database connection, container, worker, media handling, provider
access, playout, encoding, Icecast, deployment, or production action.

## Implemented boundary

- Typed station-scoped import request/job, asset/revision/provenance,
  analysis, metadata-candidate/resolution, quarantine/failure/retry contracts.
- Explicit lifecycle with legal transitions and terminal/recovery branches.
- Additive `003_m3_asset_lifecycle.sql` PostgreSQL contract, including
  same-station references, idempotency, lifecycle checks, and append-only
  revision/result/candidate/resolution records. It is registered but unrun.
- Deterministic fixture-only normalization, cue/fade, and metadata adapters;
  no adapter receives a path, media bytes, or provider credentials.
- Protected station-scoped preview/status/validate/approve/reject API/UI
  controls. Approval records control-plane state only and never dispatches a
  worker or any other plane.

## Deliberately disabled

No media object was accepted, inspected, copied, parsed, transformed, or
played. No worker, process, container, FFmpeg, parser, network call,
MusicBrainz request, database migration, stream, encoder, relay, Icecast
mount, listener service, or deployment was started. M3 has no route or adapter
to M4 schedules, M5 runtime/DSP, or M7 encoder/Icecast work.

## Required future owner gate

Any staging activation requires a new, specific approval that identifies the
reviewed artifact, target classification, authority boundary, input class,
sandbox limits, rollback/stop conditions, and content-free evidence. Required
evidence includes migration identity/ledger state, least-privilege grant
validation, station-isolation results, worker-disabled or sandbox-bound state,
no-network/no-downstream-plane confirmation, and final cleanup or inactive
state. This record cannot authorize a retry or any later milestone.
