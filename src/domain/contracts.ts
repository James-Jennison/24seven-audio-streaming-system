/** Versioned contracts shared across the control plane and future runtime adapters. */
export const DOMAIN_CONTRACT_VERSION = "v1" as const;

export type StableId = string;
export type UtcTimestamp = string;
export type IanaTimezone = string;
export type StationSlug =
  | "streamingsoundtracks"
  | "1980s-fm"
  | "adagio-fm"
  | "death-fm"
  | "entranced-fm";

export interface VersionedRecord {
  id: StableId;
  contractVersion: typeof DOMAIN_CONTRACT_VERSION;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
}

export interface Station extends VersionedRecord {
  slug: StationSlug;
  name: string;
  timezone: IanaTimezone;
  enabled: boolean;
}

export interface MediaAsset extends VersionedRecord {
  stationId: StableId;
  sourceKind: "curated-test-library" | "future-migration" | "operator-import";
  storageReference: string;
  checksumSha256?: string;
  durationMilliseconds?: number;
  rights: MediaRights;
  metadataId: StableId;
}

export interface MediaRights {
  license: "CC0" | "CC-BY" | "public-domain";
  sourcePageUrl: string;
  directUrl: string;
  attribution: string;
  stationFitReason: string;
}

export interface Artist extends VersionedRecord {
  stationId: StableId;
  name: string;
  normalizedName: string;
}

export interface Album extends VersionedRecord {
  stationId: StableId;
  artistId: StableId;
  title: string;
  releaseYear?: number;
}

export interface TrackMetadata extends VersionedRecord {
  stationId: StableId;
  artistId?: StableId;
  albumId?: StableId;
  title: string;
  category: string;
  genreTags: string[];
}

export interface Playlist extends VersionedRecord {
  stationId: StableId;
  name: string;
  itemIds: StableId[];
}

export interface RotationRule extends VersionedRecord {
  stationId: StableId;
  name: string;
  playlistId: StableId;
  weight: number;
  enabled: boolean;
}

export interface SeparationRule extends VersionedRecord {
  stationId: StableId;
  scope: "artist" | "title" | "album" | "category";
  minimumMinutes: number;
}

export interface Clock extends VersionedRecord {
  stationId: StableId;
  name: string;
  slots: ClockSlot[];
}

export interface ClockSlot {
  position: number;
  category: string;
  rotationRuleId?: StableId;
}

export interface ProgramBlock extends VersionedRecord {
  stationId: StableId;
  name: string;
  timezone: IanaTimezone;
  startsAtLocalTime: string;
  daysOfWeek: number[];
  clockId: StableId;
}

export interface ScheduledEvent extends VersionedRecord {
  stationId: StableId;
  scheduledFor: UtcTimestamp;
  kind: "program-block" | "announcement" | "maintenance";
  payloadReference: string;
}

export interface QueueItem extends VersionedRecord {
  stationId: StableId;
  mediaAssetId: StableId;
  position: number;
  origin: "rotation" | "operator" | "scheduled-event";
}

export interface PlaybackState extends VersionedRecord {
  stationId: StableId;
  writer: "audio-runtime";
  runtimeInstanceId: StableId;
  observedAt: UtcTimestamp;
  sequence: number;
  status: "unavailable" | "idle" | "playing" | "live-input" | "degraded";
  currentQueueItemId?: StableId;
}

export interface OutputTarget extends VersionedRecord {
  stationId: StableId;
  adapter: "icecast" | "shoutcast-v1" | "shoutcast-v2";
  name: string;
  credentialReference?: string;
  enabled: boolean;
}

export interface LiveInput extends VersionedRecord {
  stationId: StableId;
  name: string;
  priority: number;
  enabled: boolean;
}

export interface LiveSession extends VersionedRecord {
  stationId: StableId;
  liveInputId: StableId;
  writer: "audio-runtime";
  startedAt: UtcTimestamp;
  endedAt?: UtcTimestamp;
  handoffReason: string;
}

export interface Incident extends VersionedRecord {
  stationId?: StableId;
  openedAt: UtcTimestamp;
  severity: "info" | "warning" | "critical";
  summary: string;
  status: "open" | "acknowledged" | "resolved";
}

export interface HealthState extends VersionedRecord {
  stationId?: StableId;
  writer: "audio-runtime" | "control-plane";
  observedAt: UtcTimestamp;
  status: "unavailable" | "healthy" | "degraded" | "failed";
  detail: string;
}

export interface PlaybackHistory extends VersionedRecord {
  stationId: StableId;
  writer: "audio-runtime";
  mediaAssetId?: StableId;
  startedAt: UtcTimestamp;
  endedAt?: UtcTimestamp;
  source: "automation" | "live-input";
}

export interface User extends VersionedRecord {
  email: string;
  displayName: string;
  enabled: boolean;
}

export interface Role extends VersionedRecord {
  name: "administrator" | "programmer" | "operator" | "viewer";
  stationIds: StableId[];
}

export interface AuditEvent extends VersionedRecord {
  actorUserId?: StableId;
  stationId?: StableId;
  occurredAt: UtcTimestamp;
  action: string;
  entityType: string;
  entityId: StableId;
  detail: string;
}

export function assertStation(station: Station): void {
  if (!station.id || !station.name || !station.slug) {
    throw new Error("Station requires stable id, name, and slug.");
  }
  if (
    !isUtcTimestamp(station.createdAt) ||
    !isUtcTimestamp(station.updatedAt)
  ) {
    throw new Error("Station timestamps must be valid UTC ISO-8601 strings.");
  }
  try {
    Intl.DateTimeFormat("en-US", { timeZone: station.timezone });
  } catch {
    throw new Error("Station timezone must be an IANA timezone.");
  }
}

export function isUtcTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed) && value.endsWith("Z");
}
