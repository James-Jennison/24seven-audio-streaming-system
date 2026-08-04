import { randomUUID } from "node:crypto";

import {
  type ClockDefinition,
  type MediaLifecycle,
  type MediaMetadata,
  type MediaMetadataInput,
  type PlaylistDefinition,
  type ProgramBlockDefinition,
  type RotationDefinition,
  type ScheduledEventDefinition,
  type ScheduledEventKind,
  type SeparationRuleDefinition,
  type SeparationScope,
  validateClock,
  validateMedia,
  validatePlaylist,
  validateProgramBlock,
  validateRotation,
  validateScheduledEvent,
  validateSeparationRule,
} from "../domain/programming.js";

export interface SqlExecutor {
  query<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

export type ProgrammingKind =
  | "media"
  | "playlists"
  | "separation-rules"
  | "rotations"
  | "clocks"
  | "program-blocks"
  | "scheduled-events";

const tables: Record<ProgrammingKind, string> = {
  media: "media_assets",
  playlists: "playlists",
  "separation-rules": "separation_rules",
  rotations: "rotation_rules",
  clocks: "clocks",
  "program-blocks": "program_blocks",
  "scheduled-events": "scheduled_events",
};

const updateFields: Record<ProgrammingKind, readonly string[]> = {
  media: [
    "title",
    "artist",
    "album",
    "durationMilliseconds",
    "category",
    "genreTags",
    "tags",
    "sourceReference",
    "lifecycleState",
  ],
  playlists: ["name", "mediaIds"],
  "separation-rules": ["scope", "minimumMinutes"],
  rotations: ["playlistId", "name", "weight", "enabled"],
  clocks: ["name", "slots"],
  "program-blocks": [
    "clockId",
    "name",
    "timezone",
    "startsAtLocalTime",
    "daysOfWeek",
  ],
  "scheduled-events": ["scheduledFor", "kind", "payloadReference"],
};

function programmingKind(value: string): ProgrammingKind {
  if (Object.hasOwn(tables, value)) return value as ProgrammingKind;
  throw new Error("invalid_entity");
}

function assertPermittedFields(
  kind: ProgrammingKind,
  body: Record<string, unknown>,
): void {
  for (const key of Object.keys(body)) {
    if (!updateFields[kind].includes(key)) {
      if (["id", "stationId", "createdAt", "updatedAt"].includes(key))
        throw new Error("immutable_field");
      throw new Error("validation_error");
    }
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`invalid_${field}`);
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return requiredString(value, field);
}

function requiredInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new Error(`invalid_${field}`);
  return value;
}

function requiredBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`invalid_${field}`);
  return value;
}

function requiredStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error(`invalid_${field}`);
  return [...value] as string[];
}

function requiredArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`invalid_${field}`);
  return [...value];
}

function mediaInput(
  stationId: string,
  body: Record<string, unknown>,
  existing?: MediaMetadata,
): MediaMetadataInput {
  const lifecycle = body.lifecycleState ?? existing?.lifecycleState;
  if (!["draft", "available", "retired"].includes(String(lifecycle)))
    throw new Error("invalid_lifecycle_state");
  const value: MediaMetadataInput = {
    stationId,
    title: requiredString(body.title ?? existing?.title, "media_title"),
    artist: requiredString(body.artist ?? existing?.artist, "media_artist"),
    album: optionalString(body.album ?? existing?.album, "media_album"),
    durationMilliseconds:
      body.durationMilliseconds === undefined &&
      existing?.durationMilliseconds === undefined
        ? undefined
        : requiredInteger(
            body.durationMilliseconds ?? existing?.durationMilliseconds,
            "media_duration",
          ),
    category: requiredString(
      body.category ?? existing?.category,
      "media_category",
    ),
    genreTags: requiredStringArray(
      body.genreTags ?? existing?.genreTags,
      "media_genre_tags",
    ),
    tags: requiredStringArray(body.tags ?? existing?.tags, "media_tags"),
    sourceReference: requiredString(
      body.sourceReference ?? existing?.sourceReference,
      "media_source_reference",
    ),
    lifecycleState: lifecycle as MediaLifecycle,
  };
  validateMedia(value);
  return value;
}

function playlistDefinition(
  body: Record<string, unknown>,
  existing?: PlaylistDefinition,
): PlaylistDefinition {
  const value = {
    name: requiredString(body.name ?? existing?.name, "playlist_name"),
    mediaIds: requiredStringArray(
      body.mediaIds ?? existing?.mediaIds ?? [],
      "playlist_media",
    ),
  };
  validatePlaylist(value);
  return value;
}

function separationDefinition(
  body: Record<string, unknown>,
  existing?: SeparationRuleDefinition,
): SeparationRuleDefinition {
  const scope = body.scope ?? existing?.scope;
  const value: SeparationRuleDefinition = {
    scope: requiredString(scope, "separation_scope") as SeparationScope,
    minimumMinutes: requiredInteger(
      body.minimumMinutes ?? existing?.minimumMinutes,
      "separation_minutes",
    ),
  };
  validateSeparationRule(value);
  return value;
}

function rotationDefinition(
  body: Record<string, unknown>,
  existing?: RotationDefinition,
): RotationDefinition {
  const value: RotationDefinition = {
    playlistId: requiredString(
      body.playlistId ?? existing?.playlistId,
      "playlist_reference",
    ),
    name: requiredString(body.name ?? existing?.name, "rotation_name"),
    weight: requiredInteger(body.weight ?? existing?.weight, "rotation_weight"),
    enabled:
      body.enabled === undefined
        ? (existing?.enabled ?? true)
        : requiredBoolean(body.enabled, "rotation_enabled"),
  };
  validateRotation(value);
  return value;
}

function clockDefinition(
  body: Record<string, unknown>,
  existing?: ClockDefinition,
): ClockDefinition {
  const value: ClockDefinition = {
    name: requiredString(body.name ?? existing?.name, "clock_name"),
    slots: requiredArray(body.slots ?? existing?.slots ?? [], "clock_slots"),
  };
  validateClock(value);
  return value;
}

function programBlockDefinition(
  body: Record<string, unknown>,
  existing?: ProgramBlockDefinition,
): ProgramBlockDefinition {
  const value: ProgramBlockDefinition = {
    clockId: requiredString(
      body.clockId ?? existing?.clockId,
      "clock_reference",
    ),
    name: requiredString(body.name ?? existing?.name, "program_block_name"),
    timezone: requiredString(body.timezone ?? existing?.timezone, "timezone"),
    startsAtLocalTime: requiredString(
      body.startsAtLocalTime ?? existing?.startsAtLocalTime,
      "program_block_time",
    ),
    daysOfWeek: requiredArray(
      body.daysOfWeek ?? existing?.daysOfWeek,
      "program_block_days",
    ).map((day) => requiredInteger(day, "program_block_day")),
  };
  validateProgramBlock(value);
  return value;
}

function scheduledEventDefinition(
  body: Record<string, unknown>,
  existing?: ScheduledEventDefinition,
): ScheduledEventDefinition {
  const kind = body.kind ?? existing?.kind;
  const value: ScheduledEventDefinition = {
    scheduledFor: requiredString(
      body.scheduledFor ?? existing?.scheduledFor,
      "scheduled_event_time",
    ),
    kind: requiredString(kind, "scheduled_event_kind") as ScheduledEventKind,
    payloadReference: requiredString(
      body.payloadReference ?? existing?.payloadReference,
      "scheduled_event_reference",
    ),
  };
  validateScheduledEvent(value);
  return value;
}

function rotationIdsFromSlots(slots: readonly unknown[]): string[] {
  const ids: string[] = [];
  for (const slot of slots) {
    if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue;
    const rotationId = (slot as Record<string, unknown>).rotationId;
    if (rotationId === undefined) continue;
    ids.push(requiredString(rotationId, "clock_rotation_reference"));
  }
  return ids;
}

interface PlaylistRow {
  id: string;
  name: string;
  mediaIds: string[];
}

interface SeparationRow {
  scope: SeparationScope;
  minimumMinutes: number;
}

interface RotationRow {
  playlistId: string;
  name: string;
  weight: number;
  enabled: boolean;
}

interface ClockRow {
  name: string;
  slots: unknown[];
}

interface ProgramBlockRow {
  clockId: string;
  name: string;
  timezone: string;
  startsAtLocalTime: string;
  daysOfWeek: number[];
}

interface ScheduledEventRow {
  scheduledFor: string | Date;
  kind: ScheduledEventKind;
  payloadReference: string;
}

/** PostgreSQL M1 repository. Every station-bound SQL operation includes station_id. */
export class PostgresM1Repositories {
  public constructor(private readonly database: SqlExecutor) {}

  async createMedia(
    actorUserId: string,
    input: MediaMetadataInput,
  ): Promise<MediaMetadata> {
    validateMedia(input);
    const id = randomUUID();
    const now = new Date().toISOString();
    const result = await this.database.query<MediaMetadata>(
      `INSERT INTO media_assets (id,station_id,title,artist,album,duration_milliseconds,category,genre_tags,tags,source_reference,lifecycle_state,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING id,station_id AS "stationId",title,artist,album,duration_milliseconds AS "durationMilliseconds",category,genre_tags AS "genreTags",tags,source_reference AS "sourceReference",lifecycle_state AS "lifecycleState",created_at AS "createdAt",updated_at AS "updatedAt"`,
      [
        id,
        input.stationId,
        input.title,
        input.artist,
        input.album ?? null,
        input.durationMilliseconds ?? null,
        input.category,
        input.genreTags,
        input.tags,
        input.sourceReference,
        input.lifecycleState,
        now,
      ],
    );
    await this.audit(
      actorUserId,
      input.stationId,
      "programming.media_created",
      "media_asset",
      id,
    );
    return result.rows[0]!;
  }

  async listMedia(stationId: string): Promise<readonly MediaMetadata[]> {
    const result = await this.database.query<MediaMetadata>(
      `SELECT id,station_id AS "stationId",title,artist,album,duration_milliseconds AS "durationMilliseconds",category,genre_tags AS "genreTags",tags,source_reference AS "sourceReference",lifecycle_state AS "lifecycleState",created_at AS "createdAt",updated_at AS "updatedAt" FROM media_assets WHERE station_id=$1 ORDER BY title,id`,
      [stationId],
    );
    return result.rows;
  }

  async createPlaylist(
    actor: string,
    stationId: string,
    input: string | PlaylistDefinition,
  ): Promise<string> {
    const definition =
      typeof input === "string"
        ? playlistDefinition({ name: input, mediaIds: [] })
        : input;
    validatePlaylist(definition);
    await this.assertMediaOwnership(stationId, definition.mediaIds);
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.database.query(
      `INSERT INTO playlists (id,station_id,name,created_at,updated_at) VALUES ($1,$2,$3,$4,$4)`,
      [id, stationId, definition.name, now],
    );
    await this.replacePlaylistItems(stationId, id, definition.mediaIds);
    await this.audit(
      actor,
      stationId,
      "programming.playlist_created",
      "playlist",
      id,
    );
    return id;
  }

  async addPlaylistItem(
    actor: string,
    stationId: string,
    playlistId: string,
    mediaId: string,
    position: number,
  ): Promise<void> {
    if (!Number.isInteger(position) || position < 0)
      throw new Error("validation_error");
    const check = await this.database.query(
      `SELECT 1 FROM playlists p JOIN media_assets m ON m.id=$2 AND m.station_id=p.station_id WHERE p.id=$1 AND p.station_id=$3`,
      [playlistId, mediaId, stationId],
    );
    if (!check.rowCount) throw new Error("station_reference_forbidden");
    await this.database.query(
      `INSERT INTO playlist_items (playlist_id,media_asset_id,position) VALUES ($1,$2,$3)`,
      [playlistId, mediaId, position],
    );
    await this.audit(
      actor,
      stationId,
      "programming.playlist_item_added",
      "playlist",
      playlistId,
    );
  }

  async createSeparationRule(
    actor: string,
    stationId: string,
    scope: string,
    minutes: number,
  ): Promise<string> {
    const definition = separationDefinition({ scope, minimumMinutes: minutes });
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.database.query(
      `INSERT INTO separation_rules (id,station_id,scope,minimum_minutes,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$5)`,
      [id, stationId, definition.scope, definition.minimumMinutes, now],
    );
    await this.audit(
      actor,
      stationId,
      "programming.separation_created",
      "separation_rule",
      id,
    );
    return id;
  }

  async createRotation(
    actor: string,
    stationId: string,
    playlistId: string,
    name: string,
    weight: number,
    enabled = true,
  ): Promise<string> {
    const definition = rotationDefinition({
      playlistId,
      name,
      weight,
      enabled,
    });
    await this.assertOwned("playlists", stationId, definition.playlistId);
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.database.query(
      `INSERT INTO rotation_rules (id,station_id,playlist_id,name,weight,enabled,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
      [
        id,
        stationId,
        definition.playlistId,
        definition.name,
        definition.weight,
        definition.enabled,
        now,
      ],
    );
    await this.audit(
      actor,
      stationId,
      "programming.rotation_created",
      "rotation_rule",
      id,
    );
    return id;
  }

  async createClock(
    actor: string,
    stationId: string,
    name: string,
    slots: unknown[],
  ): Promise<string> {
    const definition = clockDefinition({ name, slots });
    await this.assertOwnedIds(
      "rotations",
      stationId,
      rotationIdsFromSlots(definition.slots),
    );
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.database.query(
      `INSERT INTO clocks (id,station_id,name,slots,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$5)`,
      [id, stationId, definition.name, JSON.stringify(definition.slots), now],
    );
    await this.audit(
      actor,
      stationId,
      "programming.clock_created",
      "clock",
      id,
    );
    return id;
  }

  async createProgramBlock(
    actor: string,
    stationId: string,
    clockId: string,
    name: string,
    timezone: string,
    startsAtLocalTime: string,
    daysOfWeek: number[],
  ): Promise<string> {
    const definition = programBlockDefinition({
      clockId,
      name,
      timezone,
      startsAtLocalTime,
      daysOfWeek,
    });
    await this.assertOwned("clocks", stationId, definition.clockId);
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.database.query(
      `INSERT INTO program_blocks (id,station_id,clock_id,name,timezone,starts_at_local_time,days_of_week,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
      [
        id,
        stationId,
        definition.clockId,
        definition.name,
        definition.timezone,
        definition.startsAtLocalTime,
        definition.daysOfWeek,
        now,
      ],
    );
    await this.audit(
      actor,
      stationId,
      "programming.program_block_created",
      "program_block",
      id,
    );
    return id;
  }

  async createScheduledEvent(
    actor: string,
    stationId: string,
    scheduledFor: string,
    kind: string,
    payloadReference: string,
  ): Promise<string> {
    const definition = scheduledEventDefinition({
      scheduledFor,
      kind,
      payloadReference,
    });
    await this.assertScheduledEventReference(stationId, definition);
    const id = randomUUID();
    const now = new Date().toISOString();
    await this.database.query(
      `INSERT INTO scheduled_events (id,station_id,scheduled_for,kind,payload_reference,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)`,
      [
        id,
        stationId,
        definition.scheduledFor,
        definition.kind,
        definition.payloadReference,
        now,
      ],
    );
    await this.audit(
      actor,
      stationId,
      "programming.scheduled_event_created",
      "scheduled_event",
      id,
    );
    return id;
  }

  async hasUsers(): Promise<boolean> {
    return Boolean(
      (await this.database.query(`SELECT 1 FROM users LIMIT 1`)).rowCount,
    );
  }

  async bootstrapUser(email: string, passwordHash: string): Promise<string> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const existing = await this.database.query(`SELECT 1 FROM users LIMIT 1`);
    if (existing.rowCount) throw new Error("bootstrap_unavailable");
    await this.database.query(
      `INSERT INTO users (id,email,display_name,password_hash,enabled,created_at,updated_at) VALUES ($1,$2,$3,$4,true,$5,$5)`,
      [id, email, "Owner", passwordHash, now],
    );
    await this.database.query(
      `INSERT INTO user_roles (user_id,role,station_id) VALUES ($1,'owner',NULL)`,
      [id],
    );
    await this.audit(id, undefined, "auth.bootstrap", "user", id);
    return id;
  }

  async bootstrap(email: string, passwordHash: string): Promise<string> {
    return this.bootstrapUser(email, passwordHash);
  }

  async findUserByEmail(email: string): Promise<
    | {
        id: string;
        passwordHash: string;
        enabled: boolean;
        role: string;
        stationIds: string[];
      }
    | undefined
  > {
    const result = await this.database.query<{
      id: string;
      passwordHash: string;
      enabled: boolean;
      role: string;
      stationIds: string[];
    }>(
      `SELECT u.id,u.password_hash AS "passwordHash",u.enabled,COALESCE((array_agg(ur.role ORDER BY CASE ur.role WHEN 'owner' THEN 1 WHEN 'administrator' THEN 2 WHEN 'programmer' THEN 3 WHEN 'operator' THEN 4 ELSE 5 END))[1],'observer') AS role,COALESCE(array_remove(array_agg(ur.station_id),NULL),'{}') AS "stationIds" FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.email=$1 GROUP BY u.id`,
      [email],
    );
    return result.rows[0];
  }

  async findUser(
    email: string,
  ): Promise<
    { id: string; passwordHash: string; enabled: boolean } | undefined
  > {
    const user = await this.findUserByEmail(email);
    return user
      ? { id: user.id, passwordHash: user.passwordHash, enabled: user.enabled }
      : undefined;
  }

  async createSession(
    userId: string,
    tokenHash: string,
    csrfHash: string,
    expiresAt: Date,
  ): Promise<string> {
    const id = randomUUID();
    await this.database.query(
      `INSERT INTO sessions (id,user_id,token_hash,csrf_token_hash,expires_at,created_at) VALUES ($1,$2,$3,$4,$5,now())`,
      [id, userId, tokenHash, csrfHash, expiresAt],
    );
    await this.audit(userId, undefined, "auth.login", "session", id);
    return id;
  }

  async createAuthSession(
    userId: string,
    tokenHash: string,
    csrfHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.createSession(userId, tokenHash, csrfHash, expiresAt);
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.database.query(
      `UPDATE sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL`,
      [tokenHash],
    );
  }

  async revoke(tokenHash: string): Promise<void> {
    await this.revokeSession(tokenHash);
  }

  async lookupSession(
    tokenHash: string,
  ): Promise<
    | { userId: string; role: string; stationIds: string[]; csrfHash: string }
    | undefined
  > {
    const result = await this.database.query<{
      userId: string;
      role: string;
      stationIds: string[];
      csrfHash: string;
    }>(
      `SELECT s.user_id AS "userId",COALESCE((array_agg(ur.role ORDER BY CASE ur.role WHEN 'owner' THEN 1 WHEN 'administrator' THEN 2 WHEN 'programmer' THEN 3 WHEN 'operator' THEN 4 ELSE 5 END))[1],'observer') AS role,COALESCE(array_remove(array_agg(ur.station_id),NULL),'{}') AS "stationIds",s.csrf_token_hash AS "csrfHash" FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.enabled=true GROUP BY s.id`,
      [tokenHash],
    );
    return result.rows[0];
  }

  async audit(
    actorUserId: string | undefined,
    stationId: string | undefined,
    action: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO audit_events (id,actor_user_id,station_id,occurred_at,action,entity_type,entity_id,detail) VALUES ($1,$2,$3,now(),$4,$5,$6,$7)`,
      [
        randomUUID(),
        actorUserId ?? null,
        stationId ?? null,
        action,
        entityType,
        entityId,
        "M1 control-plane event",
      ],
    );
  }

  async auditRejection(
    actor: string | undefined,
    stationId: string,
    kind: string,
    id = "request",
  ): Promise<void> {
    const entityType = kind === "dry-run" ? "dry_run" : programmingKind(kind);
    await this.audit(
      actor,
      stationId,
      "programming.request_rejected",
      entityType,
      id,
    );
  }

  async list(kindValue: string, stationId: string): Promise<unknown[]> {
    const kind = programmingKind(kindValue);
    if (kind === "media") return [...(await this.listMedia(stationId))];
    if (kind === "playlists") {
      return (
        await this.database.query(
          `SELECT p.id,p.station_id AS "stationId",p.name,COALESCE(array_agg(pi.media_asset_id ORDER BY pi.position) FILTER (WHERE pi.media_asset_id IS NOT NULL),'{}') AS "mediaIds",p.created_at AS "createdAt",p.updated_at AS "updatedAt" FROM playlists p LEFT JOIN playlist_items pi ON pi.playlist_id=p.id WHERE p.station_id=$1 GROUP BY p.id ORDER BY p.id`,
          [stationId],
        )
      ).rows;
    }
    return (
      await this.database.query(
        `SELECT * FROM ${tables[kind]} WHERE station_id=$1 ORDER BY id`,
        [stationId],
      )
    ).rows;
  }

  async read(
    kindValue: string,
    stationId: string,
    id: string,
  ): Promise<unknown> {
    const kind = programmingKind(kindValue);
    const result =
      kind === "playlists"
        ? await this.database.query(
            `SELECT p.id,p.station_id AS "stationId",p.name,COALESCE(array_agg(pi.media_asset_id ORDER BY pi.position) FILTER (WHERE pi.media_asset_id IS NOT NULL),'{}') AS "mediaIds",p.created_at AS "createdAt",p.updated_at AS "updatedAt" FROM playlists p LEFT JOIN playlist_items pi ON pi.playlist_id=p.id WHERE p.id=$1 AND p.station_id=$2 GROUP BY p.id`,
            [id, stationId],
          )
        : await this.database.query(
            `SELECT * FROM ${tables[kind]} WHERE id=$1 AND station_id=$2`,
            [id, stationId],
          );
    if (!result.rows[0]) throw new Error("not_found");
    return result.rows[0];
  }

  async create(
    kindValue: string,
    actor: string,
    stationId: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const kind = programmingKind(kindValue);
    assertPermittedFields(kind, body);
    if (kind === "media")
      return this.createMedia(actor, mediaInput(stationId, body));
    if (kind === "playlists")
      return {
        id: await this.createPlaylist(
          actor,
          stationId,
          playlistDefinition(body),
        ),
      };
    if (kind === "separation-rules") {
      const definition = separationDefinition(body);
      return {
        id: await this.createSeparationRule(
          actor,
          stationId,
          definition.scope,
          definition.minimumMinutes,
        ),
      };
    }
    if (kind === "rotations") {
      const definition = rotationDefinition(body);
      return {
        id: await this.createRotation(
          actor,
          stationId,
          definition.playlistId,
          definition.name,
          definition.weight,
          definition.enabled,
        ),
      };
    }
    if (kind === "clocks") {
      const definition = clockDefinition(body);
      return {
        id: await this.createClock(actor, stationId, definition.name, [
          ...definition.slots,
        ]),
      };
    }
    if (kind === "program-blocks") {
      const definition = programBlockDefinition(body);
      return {
        id: await this.createProgramBlock(
          actor,
          stationId,
          definition.clockId,
          definition.name,
          definition.timezone,
          definition.startsAtLocalTime,
          [...definition.daysOfWeek],
        ),
      };
    }
    const definition = scheduledEventDefinition(body);
    return {
      id: await this.createScheduledEvent(
        actor,
        stationId,
        definition.scheduledFor,
        definition.kind,
        definition.payloadReference,
      ),
    };
  }

  async delete(
    kindValue: string,
    actor: string,
    stationId: string,
    id: string,
  ): Promise<void> {
    const kind = programmingKind(kindValue);
    const result = await this.database.query(
      `DELETE FROM ${tables[kind]} WHERE id=$1 AND station_id=$2`,
      [id, stationId],
    );
    if (!result.rowCount) throw new Error("not_found");
    await this.audit(actor, stationId, `programming.${kind}_deleted`, kind, id);
  }

  async update(
    kindValue: string,
    actor: string,
    stationId: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const kind = programmingKind(kindValue);
    assertPermittedFields(kind, body);
    if (!Object.keys(body).length) throw new Error("validation_error");
    if (kind === "media") return this.updateMedia(actor, stationId, id, body);
    if (kind === "playlists")
      return this.updatePlaylist(actor, stationId, id, body);
    if (kind === "separation-rules")
      return this.updateSeparationRule(actor, stationId, id, body);
    if (kind === "rotations")
      return this.updateRotation(actor, stationId, id, body);
    if (kind === "clocks") return this.updateClock(actor, stationId, id, body);
    if (kind === "program-blocks")
      return this.updateProgramBlock(actor, stationId, id, body);
    return this.updateScheduledEvent(actor, stationId, id, body);
  }

  private async updateMedia(
    actor: string,
    stationId: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const existing = (
      await this.database.query<MediaMetadata>(
        `SELECT id,station_id AS "stationId",title,artist,album,duration_milliseconds AS "durationMilliseconds",category,genre_tags AS "genreTags",tags,source_reference AS "sourceReference",lifecycle_state AS "lifecycleState",created_at AS "createdAt",updated_at AS "updatedAt" FROM media_assets WHERE id=$1 AND station_id=$2`,
        [id, stationId],
      )
    ).rows[0];
    if (!existing) throw new Error("not_found");
    const merged = mediaInput(stationId, body, existing);
    const result = await this.database.query(
      `UPDATE media_assets SET title=$1,artist=$2,album=$3,duration_milliseconds=$4,category=$5,genre_tags=$6,tags=$7,source_reference=$8,lifecycle_state=$9,updated_at=now() WHERE id=$10 AND station_id=$11 RETURNING *`,
      [
        merged.title,
        merged.artist,
        merged.album ?? null,
        merged.durationMilliseconds ?? null,
        merged.category,
        merged.genreTags,
        merged.tags,
        merged.sourceReference,
        merged.lifecycleState,
        id,
        stationId,
      ],
    );
    await this.audit(
      actor,
      stationId,
      "programming.media_updated",
      "media",
      id,
    );
    return result.rows[0];
  }

  private async updatePlaylist(
    actor: string,
    stationId: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const existing = (
      await this.database.query<PlaylistRow>(
        `SELECT p.id,p.name,COALESCE(array_agg(pi.media_asset_id ORDER BY pi.position) FILTER (WHERE pi.media_asset_id IS NOT NULL),'{}') AS "mediaIds" FROM playlists p LEFT JOIN playlist_items pi ON pi.playlist_id=p.id WHERE p.id=$1 AND p.station_id=$2 GROUP BY p.id`,
        [id, stationId],
      )
    ).rows[0];
    if (!existing) throw new Error("not_found");
    const merged = playlistDefinition(body, existing);
    await this.assertMediaOwnership(stationId, merged.mediaIds);
    const result = await this.database.query(
      `UPDATE playlists SET name=$1,updated_at=now() WHERE id=$2 AND station_id=$3 RETURNING *`,
      [merged.name, id, stationId],
    );
    await this.replacePlaylistItems(stationId, id, merged.mediaIds);
    await this.audit(
      actor,
      stationId,
      "programming.playlists_updated",
      "playlist",
      id,
    );
    return result.rows[0];
  }

  private async updateSeparationRule(
    actor: string,
    stationId: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const existing = (
      await this.database.query<SeparationRow>(
        `SELECT scope,minimum_minutes AS "minimumMinutes" FROM separation_rules WHERE id=$1 AND station_id=$2`,
        [id, stationId],
      )
    ).rows[0];
    if (!existing) throw new Error("not_found");
    const merged = separationDefinition(body, existing);
    const result = await this.database.query(
      `UPDATE separation_rules SET scope=$1,minimum_minutes=$2,updated_at=now() WHERE id=$3 AND station_id=$4 RETURNING *`,
      [merged.scope, merged.minimumMinutes, id, stationId],
    );
    await this.audit(
      actor,
      stationId,
      "programming.separation-rules_updated",
      "separation_rule",
      id,
    );
    return result.rows[0];
  }

  private async updateRotation(
    actor: string,
    stationId: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const existing = (
      await this.database.query<RotationRow>(
        `SELECT playlist_id AS "playlistId",name,weight,enabled FROM rotation_rules WHERE id=$1 AND station_id=$2`,
        [id, stationId],
      )
    ).rows[0];
    if (!existing) throw new Error("not_found");
    const merged = rotationDefinition(body, existing);
    await this.assertOwned("playlists", stationId, merged.playlistId);
    const result = await this.database.query(
      `UPDATE rotation_rules SET playlist_id=$1,name=$2,weight=$3,enabled=$4,updated_at=now() WHERE id=$5 AND station_id=$6 RETURNING *`,
      [
        merged.playlistId,
        merged.name,
        merged.weight,
        merged.enabled,
        id,
        stationId,
      ],
    );
    await this.audit(
      actor,
      stationId,
      "programming.rotations_updated",
      "rotation_rule",
      id,
    );
    return result.rows[0];
  }

  private async updateClock(
    actor: string,
    stationId: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const existing = (
      await this.database.query<ClockRow>(
        `SELECT name,slots FROM clocks WHERE id=$1 AND station_id=$2`,
        [id, stationId],
      )
    ).rows[0];
    if (!existing) throw new Error("not_found");
    const merged = clockDefinition(body, existing);
    await this.assertOwnedIds(
      "rotations",
      stationId,
      rotationIdsFromSlots(merged.slots),
    );
    const result = await this.database.query(
      `UPDATE clocks SET name=$1,slots=$2,updated_at=now() WHERE id=$3 AND station_id=$4 RETURNING *`,
      [merged.name, JSON.stringify(merged.slots), id, stationId],
    );
    await this.audit(
      actor,
      stationId,
      "programming.clocks_updated",
      "clock",
      id,
    );
    return result.rows[0];
  }

  private async updateProgramBlock(
    actor: string,
    stationId: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const existing = (
      await this.database.query<ProgramBlockRow>(
        `SELECT clock_id AS "clockId",name,timezone,starts_at_local_time AS "startsAtLocalTime",days_of_week AS "daysOfWeek" FROM program_blocks WHERE id=$1 AND station_id=$2`,
        [id, stationId],
      )
    ).rows[0];
    if (!existing) throw new Error("not_found");
    const merged = programBlockDefinition(body, existing);
    await this.assertOwned("clocks", stationId, merged.clockId);
    const result = await this.database.query(
      `UPDATE program_blocks SET clock_id=$1,name=$2,timezone=$3,starts_at_local_time=$4,days_of_week=$5,updated_at=now() WHERE id=$6 AND station_id=$7 RETURNING *`,
      [
        merged.clockId,
        merged.name,
        merged.timezone,
        merged.startsAtLocalTime,
        merged.daysOfWeek,
        id,
        stationId,
      ],
    );
    await this.audit(
      actor,
      stationId,
      "programming.program-blocks_updated",
      "program_block",
      id,
    );
    return result.rows[0];
  }

  private async updateScheduledEvent(
    actor: string,
    stationId: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const existing = (
      await this.database.query<ScheduledEventRow>(
        `SELECT scheduled_for AS "scheduledFor",kind,payload_reference AS "payloadReference" FROM scheduled_events WHERE id=$1 AND station_id=$2`,
        [id, stationId],
      )
    ).rows[0];
    if (!existing) throw new Error("not_found");
    const merged = scheduledEventDefinition(body, {
      ...existing,
      scheduledFor:
        existing.scheduledFor instanceof Date
          ? existing.scheduledFor.toISOString()
          : existing.scheduledFor,
    });
    await this.assertScheduledEventReference(stationId, merged);
    const result = await this.database.query(
      `UPDATE scheduled_events SET scheduled_for=$1,kind=$2,payload_reference=$3,updated_at=now() WHERE id=$4 AND station_id=$5 RETURNING *`,
      [
        merged.scheduledFor,
        merged.kind,
        merged.payloadReference,
        id,
        stationId,
      ],
    );
    await this.audit(
      actor,
      stationId,
      "programming.scheduled-events_updated",
      "scheduled_event",
      id,
    );
    return result.rows[0];
  }

  private async assertMediaOwnership(
    stationId: string,
    mediaIds: readonly string[],
  ): Promise<void> {
    await this.assertOwnedIds("media", stationId, mediaIds);
  }

  private async assertScheduledEventReference(
    stationId: string,
    definition: ScheduledEventDefinition,
  ): Promise<void> {
    if (definition.kind === "program-block")
      await this.assertOwned(
        "program-blocks",
        stationId,
        definition.payloadReference,
      );
  }

  private async assertOwned(
    kind: ProgrammingKind,
    stationId: string,
    id: string,
  ): Promise<void> {
    const result = await this.database.query(
      `SELECT 1 FROM ${tables[kind]} WHERE id=$1 AND station_id=$2`,
      [id, stationId],
    );
    if (!result.rowCount) throw new Error("station_reference_forbidden");
  }

  private async assertOwnedIds(
    kind: ProgrammingKind,
    stationId: string,
    ids: readonly string[],
  ): Promise<void> {
    if (!ids.length) return;
    if (new Set(ids).size !== ids.length) throw new Error("validation_error");
    const result = await this.database.query<{ id: string }>(
      `SELECT id FROM ${tables[kind]} WHERE station_id=$1 AND id = ANY($2::text[])`,
      [stationId, ids],
    );
    if (result.rows.length !== ids.length)
      throw new Error("station_reference_forbidden");
  }

  private async replacePlaylistItems(
    stationId: string,
    playlistId: string,
    mediaIds: readonly string[],
  ): Promise<void> {
    await this.database.query(
      `DELETE FROM playlist_items WHERE playlist_id=(SELECT id FROM playlists WHERE id=$1 AND station_id=$2)`,
      [playlistId, stationId],
    );
    if (!mediaIds.length) return;
    await this.database.query(
      `INSERT INTO playlist_items (playlist_id,media_asset_id,position) SELECT $1,media_asset_id,ordinality-1 FROM unnest($2::text[]) WITH ORDINALITY AS selection(media_asset_id,ordinality)`,
      [playlistId, mediaIds],
    );
  }
}
