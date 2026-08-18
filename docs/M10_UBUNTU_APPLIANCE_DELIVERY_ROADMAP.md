# M10 — Ubuntu Appliance Packaging, Enrollment, Upgrade, Backup, and Restore

## Status, purpose, and non-authority

**Status: future post-M9 delivery milestone; documentation only; not
authorized.** M10 defines the intended final delivery target after M3–M9 are
complete and accepted: a bootable, customized Ubuntu Server appliance that the
24Seven owner can install from USB, securely enroll on first boot, access the
Operator Dashboard on the LAN, and then use approved M3 lifecycle capabilities
to add an existing media library.

The appliance is Ubuntu-based, not a forked operating system, and it is not a
preconfigured image containing owner data. M10 does not authorize building an
installer image, packaging services, activating ingestion, importing real
media, deploying infrastructure, or operating a production appliance. Every
future M10 action needs a separately approved, bounded plan after all M3–M9
acceptance gates are met.

## Intended appliance boundary

The first release may run on one physical server, but its software components
must retain separate lifecycle and deployability boundaries:

| Independently bounded component                  | M10 appliance requirement                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Programming Control Plane and Operator Dashboard | LAN dashboard surface only after successful authorized installation; it never implicitly triggers another plane.   |
| PostgreSQL                                       | Sole live persistence store; no SQLite live path.                                                                  |
| Approved media-processing workers                | Remain separately authorized through the M3 lifecycle; no installer or dashboard action activates them implicitly. |
| Playout & Automation Runtime                     | Independent runtime lifecycle and authority boundary.                                                              |
| Source Encoder Layer                             | Independent encoder lifecycle and authority boundary.                                                              |
| Listener-Facing Icecast 2.x Layer                | Sole listener-facing streaming platform and an independent lifecycle boundary.                                     |

The all-in-one deployment must document component interfaces, data ownership,
least-privilege authorities, upgrade order, and recovery dependencies so a
future split into role- or plane-specific appliances is possible without
rewriting the system.

## Future acceptance scope

An M10 implementation is acceptable only when all of these are demonstrated
under separately approved M10 execution plans:

- a reproducible, versioned, bootable Ubuntu Server installer image with
  documented build provenance;
- signed or verifiably pinned application packages/images, dependency
  manifests, and provenance records;
- secure first-boot enrollment for hostname, networking, administrator access,
  station configuration, backup destination, and opaque secret references;
- an installer that contains no media library, credentials, private keys,
  database secrets, runtime tokens, or owner-specific configuration;
- least-privilege service accounts, firewalling, secure update, upgrade and
  rollback, backup and restore, recovery, and clean-install acceptance tests;
- LAN availability of the Operator Dashboard only after successful authorized
  installation;
- media-library intake readiness only through the approved M3 lifecycle and
  its separate authorization gates;
- content-free evidence for build provenance, installation, upgrade/rollback,
  backup/restore, and recovery; and
- documented all-in-one boundaries and a verified future path to separate
  role/plane appliances without a system rewrite.

## Preserved system constraints

M10 preserves PostgreSQL as the sole live persistence store and Icecast 2.x as
the sole listener-facing streaming platform. Every entity, reference, lookup,
mutation, fixture, outcome, and audit event remains scoped by `id +
station_id`; missing or out-of-scope records return `not_found`, while internal
cross-station references return `station_reference_forbidden`.

Audit and evidence records remain content-free. They must never contain
programming payloads, media contents, titles, filenames, paths, URLs, metadata
payloads, credentials, tokens, CSRF values, or raw SQL. Dashboard/API actions
must not implicitly trigger ingestion, processing, scheduling, publication,
playout, encoding, or Icecast activity. The appliance architecture does not
introduce Windows, SAM, PAL, legacy SHOUTcast, or arbitrary process control.

## Gate and explicit exclusions

M10 remains gated until M3–M9 are complete and accepted, including final M9
architecture acceptance. M9 completion does not grant an M10 implementation
approval. A future M10 approval must name the reviewed artifact, bounded
target/classification, authority, input category, security/update/recovery
scope, rollback or forward-fix owner, and content-free evidence boundary.

Until that approval, this record authorizes no ISO build, package/image build,
service activation, network exposure, media import, deployment, infrastructure
change, or production operation. It does not alter the current next milestone:
**M5.2 — Published-schedule consumption contract** is next after accepted
M5.1 and remains separately approval-gated implementation work.
