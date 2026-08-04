CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  contract_version TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','administrator','programmer','operator','observer')),
  station_id TEXT REFERENCES stations(id) ON DELETE CASCADE,
  CHECK (
    (role = 'owner' AND station_id IS NULL)
    OR (role <> 'owner' AND station_id IS NOT NULL)
  ),
  UNIQUE NULLS NOT DISTINCT (user_id, role, station_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  duration_milliseconds INTEGER CHECK (duration_milliseconds > 0),
  category TEXT NOT NULL,
  genre_tags TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  source_reference TEXT NOT NULL,
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('draft','available','retired')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (station_id, source_reference)
);

CREATE TABLE playlists (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (station_id, name)
);
CREATE TABLE playlist_items (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  media_asset_id TEXT NOT NULL REFERENCES media_assets(id),
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (playlist_id, media_asset_id),
  UNIQUE (playlist_id, position)
);
CREATE TABLE separation_rules (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  scope TEXT NOT NULL CHECK (scope IN ('artist','title','album','category')),
  minimum_minutes INTEGER NOT NULL CHECK (minimum_minutes >= 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE rotation_rules (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  playlist_id TEXT NOT NULL REFERENCES playlists(id),
  name TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight > 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (station_id, name)
);
CREATE TABLE clocks (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  name TEXT NOT NULL,
  slots JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (station_id, name)
);
CREATE TABLE program_blocks (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  clock_id TEXT NOT NULL REFERENCES clocks(id),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  starts_at_local_time TIME NOT NULL,
  days_of_week SMALLINT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (station_id, name)
);
CREATE TABLE scheduled_events (
  id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL REFERENCES stations(id),
  scheduled_for TIMESTAMPTZ NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('program-block','announcement','maintenance')),
  payload_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  station_id TEXT REFERENCES stations(id),
  occurred_at TIMESTAMPTZ NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  detail TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS media_assets_station_idx ON media_assets(station_id);
CREATE INDEX IF NOT EXISTS audit_events_station_idx ON audit_events(station_id, occurred_at DESC);
