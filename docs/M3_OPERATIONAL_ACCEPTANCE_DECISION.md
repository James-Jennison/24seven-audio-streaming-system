# M3 Operational Acceptance Decision

## Decision and strict non-authority

**Status: accepted 2026-08-05 UTC by the repository owner
(codeframe@gmail.com); documentation-only.** This is the
`m3_operational_acceptance_authority` decision confirming that every
separately authorized bounded M3.12 action has the evidence required by the
[M3.12 plan](M3.12_OPERATIONAL_STAGING_ACTIVATION_READINESS_AND_AUTHORIZATION_PLAN.md),
and that M3 as a whole — M3.1 through M3.12 — is complete.

This decision does not grant M4, M5, M7, M9, M10, or production authority.
Each later milestone still requires its own new, separate human approval,
exactly as stated throughout M3.1–M3.11 and the M3.12 plan.

## What is now complete

| Sub-milestone | Status                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M3.1–M3.9     | Complete and accepted (local-only Control Plane contracts)                                                                                                                                                                                       |
| M3.10         | Complete and accepted (non-executable rehearsal proposal)                                                                                                                                                                                        |
| M3.11         | Complete and accepted (decision-only M3 acceptance and handoff boundary)                                                                                                                                                                         |
| M3.12 Phase 1 | Complete and accepted ([readiness-plan acceptance](M3.12_PHASE_1_READINESS_PLAN_ACCEPTANCE_DECISION.md))                                                                                                                                         |
| M3.12 Phase 2 | Complete and accepted ([classification](M3.12_PHASE_2_STAGING_TARGET_SAFE_CLASSIFICATION_DECISION.md), [Actions 1–8](M3.12_PHASE_2_ACTION_1_TARGET_VALIDATION_AUTHORIZATION.md), [execution acceptance](M3.12_EXECUTION_ACCEPTANCE_DECISION.md)) |

## What M3 acceptance means and does not mean

M3 delivers a station-scoped asset lifecycle in the Programming Control
Plane, an isolated deterministic-double rehearsal boundary, and content-free
evidence throughout. `ready_for_schedule_use` remains an asset-eligibility
state only — it is not M4 publication, M5 execution, M7 encoding readiness,
or listener availability, exactly as M3.11 already established.

The Playout & Automation Runtime, Source Encoder Layer, and Listener-Facing
Icecast Layer remain `unavailable` and untouched. No PostgreSQL connection,
migration, media access, worker, container, subprocess, network call, or
provider call occurred at any point in M3.1–M3.12; the M3.12 Phase 2
rehearsal exercised only the in-memory `M3RehearsalAdapter` deterministic
double.

## Open risks and ownership

Consistent with M3.11's requirement for at least one owned open risk, two
remain open at M3 acceptance:

- **Later-milestone approval is required.** At M3 acceptance, M4.1 was
  deferred pending its own new, separate human approval. That approval has
  since been received and M4.1 is now accepted as local planning only; M4.2
  and later work remain separately approval-gated. Owner: repository owner
  (codeframe@gmail.com).
- **Operational authority beyond this isolated rehearsal has not been
  granted.** Nothing in M3 authorizes real PostgreSQL activation, real media
  intake, or any production/staging action beyond the deterministic-double
  rehearsal already completed. Owner: repository owner (codeframe@gmail.com).

## Next milestone

M4.1 — Schedule-domain and versioning contract was unblocked in sequence but
not authorized by this decision. Its separate owner approval has since been
received and M4.1 is now accepted as local planning only. This decision still
does not authorize M4.2, deployment, infrastructure activity, or runtime
execution.
