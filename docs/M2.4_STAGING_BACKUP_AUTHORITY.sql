-- M2.4 staging logical-backup authority artifact.
--
-- Status: staging-only, fail-closed platform artifact. It is not a migration,
-- restore procedure, or application configuration. Apply only through the
-- separately approved platform/bootstrap authority after M2.2 post_migration
-- has succeeded. It creates one credentialed login whose only effective
-- database authority is membership in the already reviewed backup group.
--
-- Invoke only with both variables supplied from protected operator inputs:
--   psql -X -v ON_ERROR_STOP=1 \
--     -v m2_backup_authority_phase=provision-or-rotate \
--     -v m2_backup_authority_password=... \
--     -f docs/M2.4_STAGING_BACKUP_AUTHORITY.sql
--
-- The password variable is never logged, committed, copied into evidence, or
-- reused for platform, migrator, runtime, restore, or evidence-review access.

\if :{?m2_backup_authority_phase}
\else
  \quit
\endif

\if :{?m2_backup_authority_password}
\else
  \quit
\endif

BEGIN;

SELECT set_config(
  'm2.backup_authority_phase',
  :'m2_backup_authority_phase',
  true
);

SELECT set_config(
  'm2.backup_authority_password',
  :'m2_backup_authority_password',
  true
);

DO $$
DECLARE
  backup_group CONSTANT TEXT := 'twentyfourseven_staging_backup';
  backup_login CONSTANT TEXT := 'twentyfourseven_staging_backup_export';
  backup_password TEXT := current_setting('m2.backup_authority_password', true);
  conflicting_group TEXT;
BEGIN
  IF current_setting('m2.backup_authority_phase', true) NOT IN ('provision', 'rotate') THEN
    RAISE EXCEPTION 'm2 backup authority phase is not approved';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = backup_group) THEN
    RAISE EXCEPTION 'reviewed backup group is absent';
  END IF;

  IF backup_password IS NULL OR backup_password = '' THEN
    RAISE EXCEPTION 'backup authority password is absent';
  END IF;

  IF current_setting('m2.backup_authority_phase', true) = 'provision' THEN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = backup_login) THEN
      RAISE EXCEPTION 'backup export login already exists; use separately approved rotation';
    END IF;
    EXECUTE format(
      'CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1 PASSWORD %L',
      backup_login,
      backup_password
    );
  ELSIF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = backup_login) THEN
    RAISE EXCEPTION 'backup export login is absent; use separately approved provisioning';
  ELSE
    EXECUTE format(
      'ALTER ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 1 PASSWORD %L',
      backup_login,
      backup_password
    );
  END IF;

  IF NOT pg_has_role(backup_login, backup_group, 'member') THEN
    EXECUTE format('GRANT %I TO %I', backup_group, backup_login);
  END IF;

  FOREACH conflicting_group IN ARRAY ARRAY[
    'twentyfourseven_staging_migrator',
    'twentyfourseven_staging_runtime',
    'twentyfourseven_staging_restore',
    'twentyfourseven_staging_evidence_review'
  ] LOOP
    IF pg_has_role(backup_login, conflicting_group, 'member') THEN
      EXECUTE format('REVOKE %I FROM %I', conflicting_group, backup_login);
    END IF;
  END LOOP;
END;
$$;

COMMIT;

-- Content-free verification contract for a later approved platform action:
-- pass only if the export login has exactly the reviewed backup-group
-- membership; has no membership in migrator, runtime, restore, or
-- evidence-review groups; and has no superuser, role-management, replication,
-- bypass-row-security, ownership, or schema-create capability. Report only
-- pass/fail by authority class and an opaque evidence reference.
