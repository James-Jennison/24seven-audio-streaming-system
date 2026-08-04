# 24Seven Audio Streaming System

A Linux-first, web-administered audio automation and streaming platform for the five 24Seven.FM stations:

- StreamingSoundtracks
- 1980s.FM
- Adagio.FM
- Death.FM
- Entranced.FM

## Status

M1 is an in-progress, local-only control-plane implementation. PostgreSQL is the required runtime persistence target; Compose binds it only to loopback. Audio runtime, media import, output services, and public listeners remain deliberately unavailable.

The current UI makes this explicit: every station reports that the audio runtime is not implemented. No mocked audio path is presented as working.

## Architecture direction

The project separates a durable control plane from a supervised audio runtime. The control plane owns configuration, scheduling, permissions, and audit history. A future Liquidsoap-based runtime will own real-time playout, transitions, encoding, and runtime-originated health/playback observations; FFmpeg is planned for media analysis and fallback jobs. See [the architecture](docs/ARCHITECTURE.md) and [ADR 0001](docs/ADRs/0001-control-plane-and-audio-runtime.md).

## Local run

Requires Node 22.5–22.x and Docker Compose for PostgreSQL integration.

```bash
npm install
cp .env.example .env # replace placeholders locally; never commit .env
docker compose up -d postgres
npm run migrate      # migration authority only; not the application runtime role
npm run dev
```

The server listens only on `127.0.0.1:3100` by default. Visit `http://127.0.0.1:3100/`. API endpoints are `/healthz`, `/readyz`, `/api/v1/version`, and `/api/v1/stations`.

`DATABASE_RUNTIME_URL` and `DATABASE_MIGRATOR_URL` are deliberately separate. The application refuses to use SQLite as an M1 fallback. `.env.example` contains placeholders only and no default account/password exists.

## Checks

```bash
npm run check
```

This runs formatting, linting, strict type checking, unit/API/UI tests, dependency auditing, and tracked-file hygiene checks. Detailed validation evidence is maintained in [CURRENT_STATE.md](docs/CURRENT_STATE.md).

## Licensing and non-affiliation

Licensed under [Apache-2.0](LICENSE). Apache-2.0 was chosen as a permissive license with an explicit patent grant; no concrete compatibility reason currently warrants a different permissive license.

This project is independent and is not affiliated with, endorsed by, or sponsored by Spatial Audio or SAM Broadcaster / Streaming Audio Manager. Those names may be trademarks of their respective owners and are used only to describe interoperability and replacement goals.
