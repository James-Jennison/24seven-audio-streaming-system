# M2 Acceptance and Staging-Readiness Decision

## Decision

**M2 — Persistence Activation, Staging Infrastructure, and Disaster Recovery is
formally accepted as of 2026-08-04 UTC.** The accepted scope is staging
persistence and disaster-recovery readiness only. This is an evidence decision,
not an operational authorization.

The decision accepts the bounded staging evidence recorded below. It does not
authorize application or control-plane activation, playout, source encoding,
Icecast, listener-facing work, production activity, deployment, or M3 work.
M3.1 planning remains the next separately approval-gated sub-goal.

## Evidence reviewed

| Acceptance area                             | Bounded evidence and outcome                                                                                                                                                                                                                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2.1–M2.5 planning and decision preparation | Published plans and decision packet establish the staged, independently approved execution sequence and content-free evidence boundary.                                                                                                                                                                                 |
| Migration and seed                          | The approved M2.2 migration and idempotent five-station seed completed; migration ledger, required schema, trusted extension, and stable station identities passed content-free verification.                                                                                                                           |
| Authority separation                        | Approved pre- and post-migration checks verified separate platform, migrator, runtime, backup, restore, and evidence-review duties without shared privileged identity or a station-isolation bypass.                                                                                                                    |
| Topology                                    | M2.3 confirmed the non-public, loopback-only PostgreSQL boundary, PostgreSQL-only active-service state, and four-plane decoupling without application or runtime activation. Evidence: `m2-topology-20260804T192235Z-71cd8b1ade217e5f`.                                                                                 |
| Backup and integrity                        | One staging logical custom archive passed archive-parse, SHA-256/manifest, and retention checks under the separate backup authority. Evidence: `m2-backup-20260804T202301068Z-8a1a86fc408de506`.                                                                                                                        |
| Restore rehearsal and cleanup               | One verified archive was restored only to a disposable, loopback-only recovery target. Archive attribution, trusted extension, ledger/schema, five stations, direct and reference-scoped station isolation, least privilege, RPO, RTO, and cleanup passed. Evidence: `m2-restore-20260804T211341391Z-33b489dab2be47b7`. |
| Repository validation                       | The M2.4 final revision at `1dd237b` passed `npm run check` (44 tests, formatting, lint, strict TypeScript, audit, and hygiene) and `git diff --check`.                                                                                                                                                                 |

## Acceptance criteria

| Criterion                                                                                                                          | Decision                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL is the sole live persistence store and the sole active staging service                                                  | Accepted from the bounded M2.2–M2.4 operational evidence.                                                              |
| Active staging is non-public and loopback-only                                                                                     | Accepted from M2.3 and M2.4 evidence.                                                                                  |
| Migration, seed, topology, authority separation, backup, integrity, restore, station isolation, RPO, RTO, and cleanup are complete | Accepted; each was performed only under its separate approval and recorded with content-free evidence.                 |
| No temporary recovery capability remains on active staging or production                                                           | Accepted; the target-only restore capability and temporary recovery authority were removed with the disposable target. |
| No temporary recovery target, listener, data boundary, or restore reference remains                                                | Accepted from the completed cleanup evidence.                                                                          |
| Evidence and audit records are content-free                                                                                        | Accepted; the reviewed records contain only bounded outcomes and opaque evidence references.                           |
| Four planes remain decoupled with no application or runtime activation                                                             | Accepted; M2 did not activate the control plane, playout runtime, source encoder, or listener-facing Icecast layer.    |

This decision relies on prior separately approved operational evidence; it does
not reopen, repeat, or perform a staging operation.

## Staging-readiness boundary

Staging persistence and DR readiness are accepted. The following remain
unapproved and unstarted: application/control-plane activation, browser or
listener exposure, runtime, media ingestion, playout, encoding, relays,
Icecast, production, and all M3 implementation work. Acceptance of M2 does
not imply an approval for any of them.

## Next approval gate

The only next milestone gate is **M3.1 — media-intake and immutable
asset-lifecycle contract planning**. It requires a separate explicit approval
and does not authorize operational media handling or application activation.
