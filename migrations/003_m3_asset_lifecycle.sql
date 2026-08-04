-- M3 is a control-plane schema only. No storage locations, media bytes, or
-- provider payloads are persisted here; source references are opaque handles.
CREATE TABLE m3_import_requests (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  idempotency_key TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('operator_staged_reference','managed_source_reference')),
  source_opaque_id TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('proposed','validated','approved_for_processing','processing','analyzed','metadata_pending','ready_for_schedule_use','rejected','quarantined','failed','superseded')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (id, station_id),
  UNIQUE (station_id, idempotency_key)
);

CREATE TABLE m3_import_jobs (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  request_id TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('proposed','validated','approved_for_processing','processing','analyzed','metadata_pending','ready_for_schedule_use','rejected','quarantined','failed','superseded')),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (id, station_id),
  UNIQUE (station_id, request_id),
  FOREIGN KEY (request_id, station_id) REFERENCES m3_import_requests(id, station_id)
);

CREATE TABLE m3_assets (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('proposed','validated','approved_for_processing','processing','analyzed','metadata_pending','ready_for_schedule_use','rejected','quarantined','failed','superseded')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (id, station_id)
);

CREATE TABLE m3_asset_revisions (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  asset_id TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('operator_staged_reference','managed_source_reference')),
  source_opaque_id TEXT NOT NULL,
  provenance_reference TEXT NOT NULL,
  checksum_sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (id, station_id),
  UNIQUE (asset_id, station_id, revision),
  FOREIGN KEY (asset_id, station_id) REFERENCES m3_assets(id, station_id)
);

CREATE TABLE m3_processing_results (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  asset_revision_id TEXT NOT NULL,
  integrated_lufs DOUBLE PRECISION NOT NULL CHECK (integrated_lufs BETWEEN -70 AND 0),
  loudness_range_lu DOUBLE PRECISION NOT NULL CHECK (loudness_range_lu BETWEEN 0 AND 70),
  true_peak_dbtp DOUBLE PRECISION NOT NULL CHECK (true_peak_dbtp BETWEEN -120 AND 6),
  target_lufs DOUBLE PRECISION NOT NULL CHECK (target_lufs BETWEEN -70 AND 0),
  recommended_gain_db DOUBLE PRECISION NOT NULL CHECK (recommended_gain_db BETWEEN -40 AND 40),
  cue_in_milliseconds INTEGER NOT NULL CHECK (cue_in_milliseconds >= 0),
  cue_out_milliseconds INTEGER NOT NULL CHECK (cue_out_milliseconds > cue_in_milliseconds),
  fade_in_milliseconds INTEGER NOT NULL CHECK (fade_in_milliseconds >= 0),
  fade_out_milliseconds INTEGER NOT NULL CHECK (fade_out_milliseconds >= 0),
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  quality TEXT NOT NULL CHECK (quality IN ('low','medium','high')),
  analysis_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (id, station_id),
  FOREIGN KEY (asset_revision_id, station_id) REFERENCES m3_asset_revisions(id, station_id)
);

CREATE TABLE m3_metadata_candidates (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  asset_revision_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('musicbrainz_compatible','deterministic_fixture')),
  candidate_reference TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (id, station_id),
  FOREIGN KEY (asset_revision_id, station_id) REFERENCES m3_asset_revisions(id, station_id)
);

CREATE TABLE m3_metadata_resolutions (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  candidate_id TEXT NOT NULL,
  resolution_state TEXT NOT NULL CHECK (resolution_state IN ('approved','rejected')),
  actor_user_id TEXT REFERENCES users(id),
  resolved_at TIMESTAMPTZ NOT NULL,
  UNIQUE (candidate_id, station_id),
  FOREIGN KEY (candidate_id, station_id) REFERENCES m3_metadata_candidates(id, station_id)
);

CREATE TABLE m3_job_failures (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  job_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('validation','limits','unsupported_format','analysis','metadata','internal')),
  retryable BOOLEAN NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  FOREIGN KEY (job_id, station_id) REFERENCES m3_import_jobs(id, station_id)
);

CREATE OR REPLACE FUNCTION m3_assert_lifecycle_transition() RETURNS trigger AS $$
BEGIN
  IF OLD.lifecycle_state = NEW.lifecycle_state THEN RETURN NEW; END IF;
  IF (OLD.lifecycle_state = 'proposed' AND NEW.lifecycle_state IN ('validated','rejected'))
    OR (OLD.lifecycle_state = 'validated' AND NEW.lifecycle_state IN ('approved_for_processing','rejected'))
    OR (OLD.lifecycle_state = 'approved_for_processing' AND NEW.lifecycle_state IN ('processing','rejected'))
    OR (OLD.lifecycle_state = 'processing' AND NEW.lifecycle_state IN ('analyzed','quarantined','failed'))
    OR (OLD.lifecycle_state = 'analyzed' AND NEW.lifecycle_state IN ('metadata_pending','quarantined','failed'))
    OR (OLD.lifecycle_state = 'metadata_pending' AND NEW.lifecycle_state IN ('ready_for_schedule_use','quarantined','failed'))
    OR (OLD.lifecycle_state = 'ready_for_schedule_use' AND NEW.lifecycle_state = 'superseded')
    OR (OLD.lifecycle_state IN ('quarantined','failed') AND NEW.lifecycle_state IN ('validated','rejected'))
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'invalid_lifecycle_transition';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER m3_import_requests_transition_check BEFORE UPDATE OF lifecycle_state ON m3_import_requests
  FOR EACH ROW EXECUTE FUNCTION m3_assert_lifecycle_transition();
CREATE TRIGGER m3_import_jobs_transition_check BEFORE UPDATE OF lifecycle_state ON m3_import_jobs
  FOR EACH ROW EXECUTE FUNCTION m3_assert_lifecycle_transition();

CREATE OR REPLACE FUNCTION m3_reject_immutable_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'immutable_m3_record';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER m3_asset_revisions_immutable BEFORE UPDATE OR DELETE ON m3_asset_revisions
  FOR EACH ROW EXECUTE FUNCTION m3_reject_immutable_mutation();
CREATE TRIGGER m3_processing_results_immutable BEFORE UPDATE OR DELETE ON m3_processing_results
  FOR EACH ROW EXECUTE FUNCTION m3_reject_immutable_mutation();
CREATE TRIGGER m3_metadata_candidates_immutable BEFORE UPDATE OR DELETE ON m3_metadata_candidates
  FOR EACH ROW EXECUTE FUNCTION m3_reject_immutable_mutation();
CREATE TRIGGER m3_metadata_resolutions_immutable BEFORE UPDATE OR DELETE ON m3_metadata_resolutions
  FOR EACH ROW EXECUTE FUNCTION m3_reject_immutable_mutation();

CREATE INDEX m3_import_requests_station_idx ON m3_import_requests(station_id, created_at DESC);
CREATE INDEX m3_import_jobs_station_idx ON m3_import_jobs(station_id, lifecycle_state, created_at DESC);
CREATE INDEX m3_assets_station_idx ON m3_assets(station_id, lifecycle_state);
CREATE INDEX m3_job_failures_station_idx ON m3_job_failures(station_id, occurred_at DESC);
