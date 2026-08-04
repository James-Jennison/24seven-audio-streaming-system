# Roadmap and Approval Gates

## M0 — foundation (complete locally; not published)

- Repository governance, architecture, ADR, parity matrix, and test-library policy.
- Versioned TypeScript contracts, SQLite development persistence, five seeded stations, loopback API, and explicitly unavailable-runtime dashboard.
- **Gate:** explicit approval to create the public GitHub repository and push the validated M0 commit.

## M1 — programming MVP (requires post-publication approval)

- PostgreSQL production adapter and migration workflow.
- Authenticated administration with least-privilege roles, station isolation tests, library metadata ingestion, playlists, rotations, clocks, program blocks, and audited scheduling changes.
- Curated, rights-documented test library only after its separate approval and review.
- **Gate:** approve an isolated development runtime and test-media import plan; no production connection or public output.

## M2 — supervised audio-runtime integration (requires separate approval)

- Evaluate and integrate Liquidsoap in an isolated local/development environment.
- Versioned control-plane/runtime commands and observations, simulated/isolated outputs, playback history, and health supervision.
- **Gate:** approve any outbound output adapter, Icecast test service, or exposed network listener.

## M3 — operations and integrations (requires separate approval)

- Icecast adapter, SHOUTcast compatibility adapter, relay/dashboard integration API, listener metrics, incident workflows, and live-DJ handoff.
- **Gate:** production infrastructure, credentials, firewall, DNS, media migration, and public-stream changes require individually displayed plans and explicit approvals.
