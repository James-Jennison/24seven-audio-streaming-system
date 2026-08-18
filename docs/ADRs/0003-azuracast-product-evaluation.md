# ADR 0003: AzuraCast Product Evaluation and Architecture Fit

- Status: deferred by owner — M5.2 paused
- Date: 2026-08-05

## Context

The project was initially planned as a Linux-native replacement for legacy
radio tooling. ADR 0001 rejected a monolithic web/runtime process but did not
evaluate named turnkey platforms. Before further M5 investment, the project
must explicitly assess AzuraCast as either a replacement, an integration
candidate, or an independent reference system.

The authoritative project constraints remain unchanged: the Programming
Control Plane, Playout & Automation Runtime, Source Encoder Layer, and
Listener-Facing Icecast 2.x Layer are separately deployable; PostgreSQL is the
sole live persistence store; station scope requires `id + station_id`; and
Control Plane UI/API actions must not command runtime or listener operations.

## Product facts evaluated

The evaluation is based on AzuraCast's public documentation as reviewed on
2026-08-05 UTC:

- AzuraCast is an all-in-one, self-hosted radio-management suite. Its bundled
  stack includes a Liquidsoap AutoDJ, Icecast-KH frontend, MariaDB, and other
  supporting services.
- Its station interface and API can manage media, playlists, mounts, relays,
  AutoDJ, and station lifecycle; the documented API includes start, stop, and
  restart operations.
- Its normal media-management paths include browser upload, SFTP, and optional
  object storage. Its backups can include station data and media.
- It is distributed under AGPL-3.0.

The source links are retained only as external design references:
[AzuraCast overview](https://www.azuracast.com/docs/), [station
management](https://www.azuracast.com/docs/user-guide/station-management/),
[media management](https://www.azuracast.com/docs/user-guide/media-management/),
[API](https://azuracast.com/docs/developers/apis/), and its
[source repository](https://github.com/AzuraCast/AzuraCast).

## Options and fit

| Option                                                  | Benefits                                                                                                                                    | Material mismatch or cost                                                                                                                                                                                  | Fit with current project                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Adopt AzuraCast as the product                          | Fastest route to a turnkey web radio deployment, with mature station administration, AutoDJ, media, streaming, and backup features.         | Requires a deliberate replacement decision: accept its integrated control/runtime model, MariaDB, bundled operational services, API command surface, AGPL obligations, and its supported frontend choices. | Not compatible without retiring or materially revising current architecture and roadmap constraints. |
| Integrate AzuraCast into the current Control Plane      | Could reuse a mature operational stack.                                                                                                     | Creates conflicting writers, direct Control Plane-to-runtime command paths, different persistence ownership, media/storage authority, and listener-facing coupling.                                        | Rejected: it violates the four-plane, PostgreSQL-only, and no-direct-command boundaries.             |
| Use AzuraCast as an independent shadow/reference system | Can inform future parity and operator-experience validation without making it authoritative.                                                | Requires a separately approved future observation-only contract, legal/operational review, and strict physical/logical isolation. It cannot share databases, media paths, credentials, or control APIs.    | Potentially compatible only as a future, separately approved M8-style comparison environment.        |
| Continue the bespoke 24Seven architecture               | Preserves approved station isolation, writer ownership, PostgreSQL, content-free evidence, decoupled deployment, and Icecast 2.x direction. | Higher implementation and operational-validation cost; M5–M9 remain substantial work.                                                                                                                      | Compatible with the current roadmap.                                                                 |

## Evaluation recommendation

Retain the bespoke 24Seven architecture and do not integrate AzuraCast into any
of its four planes. AzuraCast may be reconsidered only as an independent,
non-authoritative shadow/reference system under a new future milestone decision
that defines legal review, isolated infrastructure, no shared state, and a
content-free one-way observation boundary.

This proposal does not authorize installation, containers, services, media
access, API access, runtime control, listener output, infrastructure, or a
change to M5. It does not select AzuraCast as a product replacement.

## Owner decision

On 2026-08-05, the owner selected deferral. M5.2 remains unstarted and paused;
this ADR makes no product-selection decision and authorizes no further M5 work.

Before M5.2 can begin, the owner must select one of these outcomes:

1. Accept the proposed decision and continue the bespoke roadmap.
2. Authorize a separate product-replacement decision that retires or revises
   the current roadmap before any AzuraCast adoption work.
3. Defer the selection and keep M5.2 unstarted.
