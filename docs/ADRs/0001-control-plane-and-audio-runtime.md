# ADR 0001: Separate durable control plane from supervised audio runtime

- Status: accepted for M0; output-adapter wording superseded by the current roadmap
- Date: 2026-08-03

## Context

The platform needs durable programming, admin, audit, and station-management capabilities as well as low-latency playout, transitions, encoding, metadata injection, and output supervision. Building a custom real-time DSP/encoder/playout engine would make M0 unnecessarily risky and difficult to operate.

## Decision

Use a layered architecture. A database-backed control plane owns configuration, schedules, permissions, and audit history. A separately supervised audio runtime will be evaluated around Liquidsoap as the preferred Linux playout/transition/encoding engine. FFmpeg will be available for import analysis and bounded fallback jobs. The current authoritative roadmap supersedes this M0-era output-adapter wording: Icecast 2.x is the sole future listener-facing platform, and legacy SHOUTcast is excluded.

M0 implements neither Liquidsoap nor FFmpeg execution, nor an output service. The control-plane/runtime boundary is represented by versioned domain contracts and writer ownership only.

## Consequences

Benefits: mature audio runtime capabilities can be adopted without embedding real-time concerns into the web/API process; failures are independently supervised; and APIs can remain stable for future relay/dashboard integration.

Costs: process coordination, command idempotency, observation freshness, and handoff audit trails need explicit contracts. The control plane must not declare playback or output health from desired state. Runtime-originated observations must carry station ID, version, sequence/freshness, UTC timestamp, and runtime identity.

## Alternatives considered

- Custom engine: rejected; too much DSP, codec, timing, and operational work for the project’s objectives.
- FFmpeg-only graph: retained for analysis/fallback jobs but not selected as the durable programming/runtime core.
- Monolithic web process: rejected; couples lifecycle and failure modes of web administration and real-time audio.
