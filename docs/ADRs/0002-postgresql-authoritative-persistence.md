# ADR 0002: PostgreSQL is the authoritative M1 persistence target

- Status: accepted
- Date: 2026-08-03

## Decision

PostgreSQL is the only application runtime database for M1. Migrations execute through a dedicated migrator connection before the runtime starts; the runtime connection is intentionally separate so a future deployment can grant it ordinary data privileges but not schema authority.

SQLite is retired from the application path. It remains only in the historical M0 implementation until its removal is completed and must not be used as an M1 runtime fallback.

## Rationale

PostgreSQL provides transactional constraints, robust concurrent access, roles, operational tooling, and a portable container image for the Ubuntu workstation/VM model. The loopback-bound Compose service uses a pinned PostgreSQL image. No database port is exposed publicly.

## Migration path

M0 supplied only five seed stations and no operational data. M1 creates the authoritative schema, inserts the same stable station IDs idempotently, and has no production-library migration. This avoids touching any production system or media library.
