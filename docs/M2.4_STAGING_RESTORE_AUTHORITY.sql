-- M2.4 staging recovery-target restore authority artifact.
--
-- Staging-only, fail-closed artifact. It is applied only inside the temporary,
-- isolated recovery target by its platform/bootstrap authority. It never
-- changes active staging and never grants source-database access.
--
-- The provision phase creates one temporary restore login with only CONNECT
-- plus CREATE on the recovery target database and USAGE/CREATE on its public
-- schema. Database CREATE is required only so the custom archive can create
-- and own its trusted pgcrypto extension. The target is
-- destroyed after successful validation, which destroys this authority too.
-- Password input is protected operator material and must never be logged.

\if :{?m2_restore_authority_phase}
\else
  \quit
\endif

\getenv m2_restore_authority_password M2_RESTORE_AUTHORITY_PASSWORD

\if :{?m2_restore_authority_password}
\else
  \quit
\endif

BEGIN;

SELECT set_config(
  'm2.restore_authority_phase',
  :'m2_restore_authority_phase',
  true
);
SELECT set_config(
  'm2.restore_authority_password',
  :'m2_restore_authority_password',
  true
);

DO $$
DECLARE
  restore_login CONSTANT TEXT := 'twentyfourseven_recovery_restore';
  restore_password TEXT := current_setting('m2.restore_authority_password', true);
  database_name TEXT := current_database();
BEGIN
  IF current_setting('m2.restore_authority_phase', true) <> 'provision' THEN
    RAISE EXCEPTION 'm2 restore authority phase is not approved';
  END IF;
  IF restore_password IS NULL OR restore_password = '' THEN
    RAISE EXCEPTION 'restore authority password is absent';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = restore_login) THEN
    RAISE EXCEPTION 'restore authority already exists; target is not clean';
  END IF;

  EXECUTE format(
    'CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1 PASSWORD %L',
    restore_login,
    restore_password
  );
  EXECUTE format('GRANT CONNECT, CREATE ON DATABASE %I TO %I', database_name, restore_login);
  EXECUTE format('GRANT USAGE, CREATE ON SCHEMA public TO %I', restore_login);
END;
$$;

COMMIT;

-- Content-free verification contract: the restore login is distinct from all
-- active-staging authority classes; it has no superuser, role-management,
-- cluster/database-creation, replication, bypass-row-security, source-database,
-- or application/runtime authority. Its target-database CREATE capability is
-- confined to the disposable target and exists only for archive-owned pgcrypto.
