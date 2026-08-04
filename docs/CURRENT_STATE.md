# Current State

## Implemented in local M0

- Node 22 / TypeScript control-plane scaffold with strict type checking.
- SQLite development persistence with a versioned SQL migration and idempotent seed data for the five stations.
- Loopback-only HTTP server with liveness, readiness, version, and station-read endpoints.
- Minimal browser dashboard showing all five stations, unimplemented audio-runtime state, and version/build metadata.
- Versioned domain contracts and explicit writer ownership for configuration versus future runtime observations.
- Repository hygiene, dependency audit, formatting, lint, type, domain, API, and UI checks.

## Deliberately not implemented

- Media files, import/download tooling, media scanning, credentials, authentication, RBAC enforcement, public/browser exposure, containers, and production infrastructure.
- Liquidsoap/FFmpeg execution, playout, transitions, audio processing, encoders, Icecast/SHOUTcast, live-DJ audio, telemetry, listeners, relays, or current-system integration.

## Validation record

The M0 validation run on 2026-08-03 used Node v22.22.1 and npm 9.2.0:

```bash
npm run check
```

Result: passed. Prettier, ESLint, TypeScript strict checking, six Node tests (three domain, two API, one UI), `npm audit --audit-level=high` (0 vulnerabilities), and staged/trackable-file hygiene all passed.

An additional process-level smoke test started `npm run start` on `127.0.0.1:31987` with an ignored local SQLite file. `GET /readyz` returned `{"status":"ready"}` and `GET /api/v1/stations` returned five stations, each with runtime status `unavailable`.

This document intentionally makes no deployment or production-validity claim.
