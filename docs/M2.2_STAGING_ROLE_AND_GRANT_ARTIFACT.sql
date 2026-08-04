-- M2.2 staging least-privilege role-and-grant review artifact.
--
-- Status: LOCAL REVIEW ARTIFACT ONLY. This is not a migration and is not read
-- by src/migrate.ts. It must not be applied without a separately approved
-- platform-boundary action that names the reviewed commit, isolated staging
-- target, platform operator, change window, and content-free evidence record.
--
-- This artifact creates no password, secret, DSN, host setting, application
-- configuration, or principal binding. The platform authority supplies and
-- rotates credentials outside the repository, and records only safe pass/fail
-- evidence. Do not run it through npm run migrate.
--
-- Invocation contract for a future approved platform action:
--   psql -X -v ON_ERROR_STOP=1 -v m2_role_grant_phase=pre_migration \
--     -f docs/M2.2_STAGING_ROLE_AND_GRANT_ARTIFACT.sql
--
--   psql -X -v ON_ERROR_STOP=1 -v m2_role_grant_phase=post_migration \
--     -f docs/M2.2_STAGING_ROLE_AND_GRANT_ARTIFACT.sql
--
-- The pre_migration phase must be completed before the approved M2.2 migration
-- gate. The post_migration phase is separately approved, runs only after the
-- reviewed migration and safe postflight evidence, and does not start an
-- application. The artifact fails closed for any other phase.

\if :{?m2_role_grant_phase}
\else
  \quit
\endif

BEGIN;

SELECT set_config('m2.role_grant_phase', :'m2_role_grant_phase', true);

DO $$
DECLARE
  phase TEXT := current_setting('m2.role_grant_phase', true);
BEGIN
  IF phase NOT IN ('pre_migration', 'post_migration') THEN
    RAISE EXCEPTION 'm2 role/grant phase is not approved';
  END IF;
END;
$$;

-- The platform/bootstrap authority is an existing, externally controlled
-- identity. This artifact deliberately does not create, alter, or bind that
-- privileged identity. The remaining authority classes are named roles with
-- no credential material. Backup, restore, and evidence-review roles are
-- NOLOGIN groups; future identity membership needs its own approval.
DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'twentyfourseven_staging_migrator',
    'twentyfourseven_staging_runtime'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'CREATE ROLE %I LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD NULL',
        role_name
      );
    ELSE
      EXECUTE format(
        'ALTER ROLE %I NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
        role_name
      );
    END IF;
  END LOOP;

  FOREACH role_name IN ARRAY ARRAY[
    'twentyfourseven_staging_backup',
    'twentyfourseven_staging_restore',
    'twentyfourseven_staging_evidence_review'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
        role_name
      );
    ELSE
      EXECUTE format(
        'ALTER ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
        role_name
      );
    END IF;
  END LOOP;
END;
$$;

-- No authority class may inherit another authority class. Principal-to-role
-- bindings are approved external inputs and must also be one-to-one. Skip the
-- impossible self-membership case so the review artifact remains idempotent.
DO $$
DECLARE
  granted_role TEXT;
  member_role TEXT;
  authority_roles TEXT[] := ARRAY[
    'twentyfourseven_staging_migrator',
    'twentyfourseven_staging_runtime',
    'twentyfourseven_staging_backup',
    'twentyfourseven_staging_restore',
    'twentyfourseven_staging_evidence_review'
  ];
BEGIN
  FOREACH granted_role IN ARRAY authority_roles LOOP
    FOREACH member_role IN ARRAY authority_roles LOOP
      IF granted_role <> member_role THEN
        EXECUTE format('REVOKE %I FROM %I', granted_role, member_role);
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- The public role receives neither database nor public-schema authority. The
-- platform action grants only the minimum explicit rights below. Dynamic SQL is
-- used solely because the database identifier is intentionally not stored here.
DO $$
DECLARE
  database_name TEXT := current_database();
BEGIN
  EXECUTE format('REVOKE ALL PRIVILEGES ON DATABASE %I FROM PUBLIC', database_name);
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO twentyfourseven_staging_migrator', database_name);
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO twentyfourseven_staging_runtime', database_name);
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO twentyfourseven_staging_backup', database_name);
END;
$$;

REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO twentyfourseven_staging_migrator;
GRANT USAGE ON SCHEMA public TO twentyfourseven_staging_runtime;
GRANT USAGE ON SCHEMA public TO twentyfourseven_staging_backup;

-- Backup is read-only. Its table-specific read access is granted only after
-- the reviewed M1 schema exists; this avoids relying on broad built-in role
-- inheritance. Restore has no source-database privilege: any restore target
-- grant is a later M2.4 decision on the isolated recovery target.

-- PRE-MIGRATION: pgcrypto is controlled by the platform authority. The
-- migrator receives no role-management, database-CREATE, or extension authority.
-- A missing extension is a stop condition, not a reason to broaden migrator or
-- runtime permissions.
DO $$
BEGIN
  IF current_setting('m2.role_grant_phase', true) = 'pre_migration' THEN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
      RAISE EXCEPTION 'pgcrypto prerequisite is not available';
    END IF;
  END IF;
END;
$$;

-- POST-MIGRATION: only the reviewed M1 tables receive runtime DML. The station
-- catalogue is read-only to runtime; the migration ledger remains inaccessible
-- to runtime. No grant creates a cross-station view, function, BYPASSRLS
-- capability, or alternate access path. Station isolation remains enforced by
-- the application's scoped id + station_id SQL, same-station references, and
-- safe not_found / station_reference_forbidden behavior.
-- This artifact does not invent a client-settable row-security context or a
-- SECURITY DEFINER bypass; neither exists in the reviewed M1 contract.
DO $$
DECLARE
  phase TEXT := current_setting('m2.role_grant_phase', true);
  table_name TEXT;
BEGIN
  IF phase = 'post_migration' THEN
    FOREACH table_name IN ARRAY ARRAY[
      'stations',
      'users',
      'user_roles',
      'sessions',
      'media_assets',
      'playlists',
      'playlist_items',
      'separation_rules',
      'rotation_rules',
      'clocks',
      'program_blocks',
      'scheduled_events',
      'audit_events',
      'schema_migrations'
    ] LOOP
      IF to_regclass(format('public.%I', table_name)) IS NULL THEN
        RAISE EXCEPTION 'required M1 relation is absent';
      END IF;
    END LOOP;

    GRANT SELECT ON stations TO twentyfourseven_staging_runtime;
    GRANT SELECT, INSERT ON users, user_roles TO twentyfourseven_staging_runtime;
    GRANT SELECT, INSERT, UPDATE ON sessions TO twentyfourseven_staging_runtime;
    GRANT INSERT ON audit_events TO twentyfourseven_staging_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON media_assets,
      playlists,
      playlist_items,
      separation_rules,
      rotation_rules,
      clocks,
      program_blocks,
      scheduled_events
      TO twentyfourseven_staging_runtime;

    GRANT SELECT ON stations,
      users,
      user_roles,
      sessions,
      media_assets,
      playlists,
      playlist_items,
      separation_rules,
      rotation_rules,
      clocks,
      program_blocks,
      scheduled_events,
      audit_events,
      schema_migrations
      TO twentyfourseven_staging_backup;

    REVOKE ALL PRIVILEGES ON schema_migrations FROM twentyfourseven_staging_runtime;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM twentyfourseven_staging_runtime;
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM twentyfourseven_staging_runtime;
    REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

    -- The migration role owns the reviewed schema objects. Disable its login
    -- after the approved run; a later approved migration gate may re-enable it
    -- briefly with a rotated external secret reference.
    ALTER ROLE twentyfourseven_staging_migrator NOLOGIN;
  END IF;
END;
$$;

COMMIT;

-- Content-free verification contract for the later platform action:
--   * platform, migrator, runtime, backup, restore, and evidence-review
--     authority classes are distinct, with no cross-membership;
--   * pgcrypto is available before the M2.2 migration is attempted;
--   * the migrator alone has pre-migration schema/ledger capability;
--     its short-lived credential is used only by the reviewed runner/artifact;
--   * runtime has no DDL, extension, role, ledger, backup, restore, or
--     evidence-review authority, and only post-migration DML listed above;
--   * backup has only the explicit M1 read set; restore has no source-database authority; and
--     evidence review has no database-login authority.
--
-- Report only authority class, UTC timestamp, reviewed artifact identity,
-- phase, pass/fail, and opaque evidence reference. Never report role names,
-- grants, query output, connection details, programming content, or secrets.
-- Stop rather than sharing a privileged identity, binding one principal to more
-- than one authority class, broadening runtime grants, or applying an
-- unreviewed artifact. Rotate/revoke an external credential immediately after
-- its approved short-lived window; do not store it in this artifact.
