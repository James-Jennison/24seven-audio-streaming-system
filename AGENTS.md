# Repository Instructions

## Scope and safety

- M0 is local-only. Do not create or push a GitHub repository, deploy, contact providers, expose ports beyond loopback, or connect to production systems without a new explicit approval.
- Do not copy, inspect, move, or modify any production media library. Test media is not part of M0.
- Never commit credentials, tokens, private addresses/hostnames, media, recordings, database files, or local filesystem paths.
- Preserve unrelated working-tree changes. Do not reset, clean, stash, or overwrite them.

## Engineering

- Use TypeScript strict mode and explicit domain contracts. All persisted entities carry stable IDs and station-scoped records carry `stationId`.
- Store timestamps in UTC ISO-8601 form; store presentation/schedule zones as IANA timezone names.
- Treat the audio runtime as unavailable in M0. No endpoint or UI may imply actual playout, stream output, authentication, or monitoring.
- The control plane is the authoritative writer for programming configuration and audit events. The future runtime is the authoritative writer for playback state and output health through a versioned contract.
- Keep adapters explicit: Icecast first; SHOUTcast must remain a future adapter.

## Validation and commits

- Run `npm run check` before committing. If it cannot pass, report the exact failure and do not claim validation.
- Run `git status --short`, `git diff --check`, and `npm run hygiene` before committing.
- Use Conventional Commits. Keep `main` clean and do not publish or push.
- Update `docs/CURRENT_STATE.md` with meaningful implemented-state changes.

## Future operational gates

- Any database migration outside local development, identity/RBAC activation, network listener change, media import, runtime process, output target, or deployment requires a displayed plan and a separate explicit approval.
