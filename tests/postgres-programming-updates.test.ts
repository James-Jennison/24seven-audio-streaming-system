import assert from "node:assert/strict";
import test from "node:test";

import {
  PostgresM1Repositories,
  type SqlExecutor,
} from "../src/db/m1-repositories.js";

interface QueryCall {
  text: string;
  values: readonly unknown[] | undefined;
}

function adapter(
  existing: Record<string, unknown>,
  options: { referencesPresent?: boolean } = {},
): { db: SqlExecutor; calls: QueryCall[] } {
  const calls: QueryCall[] = [];
  const referencesPresent = options.referencesPresent ?? true;
  return {
    calls,
    db: {
      async query<T>(text: string, values?: readonly unknown[]) {
        calls.push({ text, values });
        if (
          !text.startsWith("SELECT 1 ") &&
          (text.includes("FROM media_assets WHERE id=") ||
            text.includes("FROM playlists p LEFT JOIN") ||
            text.includes("FROM separation_rules WHERE id=") ||
            text.includes("FROM rotation_rules WHERE id=") ||
            text.includes("FROM clocks WHERE id=") ||
            text.includes("FROM program_blocks WHERE id=") ||
            text.includes("FROM scheduled_events WHERE id="))
        )
          return { rows: [existing] as T[], rowCount: 1 };
        if (
          text.includes("SELECT 1 FROM playlists") ||
          text.includes("SELECT 1 FROM clocks") ||
          text.includes("SELECT 1 FROM program_blocks")
        )
          return { rows: [] as T[], rowCount: referencesPresent ? 1 : 0 };
        if (text.includes("id = ANY($2::text[])"))
          return {
            rows: (referencesPresent ? [{ id: "same-station" }] : []) as T[],
            rowCount: referencesPresent ? 1 : 0,
          };
        return { rows: [{}] as T[], rowCount: 1 };
      },
    },
  };
}

const media = {
  id: "media-a",
  stationId: "station-a",
  title: "Title",
  artist: "Artist",
  category: "Category",
  genreTags: [],
  tags: [],
  sourceReference: "safe-reference",
  lifecycleState: "draft" as const,
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
};

test("every programming update first loads by id and station, persists scoped state, and writes a content-free audit", async () => {
  const cases: Array<{
    kind:
      | "media"
      | "playlists"
      | "separation-rules"
      | "rotations"
      | "clocks"
      | "program-blocks"
      | "scheduled-events";
    existing: Record<string, unknown>;
    patch: Record<string, unknown>;
  }> = [
    { kind: "media", existing: media, patch: { title: "Updated" } },
    {
      kind: "playlists",
      existing: { id: "playlist-a", name: "Playlist", mediaIds: ["media-a"] },
      patch: { name: "Updated" },
    },
    {
      kind: "separation-rules",
      existing: { scope: "artist", minimumMinutes: 30 },
      patch: { minimumMinutes: 45 },
    },
    {
      kind: "rotations",
      existing: {
        playlistId: "playlist-a",
        name: "Rotation",
        weight: 1,
        enabled: true,
      },
      patch: { name: "Updated" },
    },
    {
      kind: "clocks",
      existing: { name: "Clock", slots: [{ rotationId: "rotation-a" }] },
      patch: { name: "Updated" },
    },
    {
      kind: "program-blocks",
      existing: {
        clockId: "clock-a",
        name: "Block",
        timezone: "UTC",
        startsAtLocalTime: "09:00",
        daysOfWeek: [1],
      },
      patch: { name: "Updated" },
    },
    {
      kind: "scheduled-events",
      existing: {
        scheduledFor: "2026-08-03T12:00:00.000Z",
        kind: "program-block",
        payloadReference: "block-a",
      },
      patch: { scheduledFor: "2026-08-03T13:00:00.000Z" },
    },
  ];

  for (const current of cases) {
    const { db, calls } = adapter(current.existing);
    await new PostgresM1Repositories(db).update(
      current.kind,
      "actor-a",
      "station-a",
      "record-a",
      current.patch,
    );
    assert.match(
      calls[0]!.text,
      /WHERE (?:[a-z]+\.)?id=\$1 AND (?:[a-z]+\.)?station_id=\$2/,
    );
    assert.ok(
      calls.some(
        (call) =>
          call.text.startsWith("UPDATE") && call.text.includes("station_id=$"),
      ),
      `${current.kind} update must remain station scoped`,
    );
    const audit = calls.find((call) =>
      call.text.includes("INSERT INTO audit_events"),
    );
    assert.ok(audit, `${current.kind} update must audit`);
    assert.doesNotMatch(
      JSON.stringify(audit.values),
      /Updated|safe-reference|Title/,
    );
  }
});

test("complete-state validators reject immutable, invalid, and cross-station update references", async () => {
  const immutable = adapter(media);
  await assert.rejects(
    () =>
      new PostgresM1Repositories(immutable.db).update(
        "media",
        "actor-a",
        "station-a",
        "media-a",
        { stationId: "station-b" },
      ),
    /immutable_field/,
  );
  assert.equal(immutable.calls.length, 0);

  const invalidSeparation = adapter({ scope: "artist", minimumMinutes: 30 });
  await assert.rejects(
    () =>
      new PostgresM1Repositories(invalidSeparation.db).update(
        "separation-rules",
        "actor-a",
        "station-a",
        "rule-a",
        { minimumMinutes: -1 },
      ),
    /invalid_separation/,
  );

  const references = [
    {
      kind: "playlists" as const,
      existing: { id: "playlist-a", name: "Playlist", mediaIds: ["media-a"] },
      patch: { mediaIds: ["media-b"] },
    },
    {
      kind: "rotations" as const,
      existing: {
        playlistId: "playlist-a",
        name: "Rotation",
        weight: 1,
        enabled: true,
      },
      patch: { playlistId: "playlist-b" },
    },
    {
      kind: "clocks" as const,
      existing: { name: "Clock", slots: [{ rotationId: "rotation-a" }] },
      patch: { slots: [{ rotationId: "rotation-b" }] },
    },
    {
      kind: "program-blocks" as const,
      existing: {
        clockId: "clock-a",
        name: "Block",
        timezone: "UTC",
        startsAtLocalTime: "09:00",
        daysOfWeek: [1],
      },
      patch: { clockId: "clock-b" },
    },
    {
      kind: "scheduled-events" as const,
      existing: {
        scheduledFor: "2026-08-03T12:00:00.000Z",
        kind: "program-block",
        payloadReference: "block-a",
      },
      patch: { payloadReference: "block-b" },
    },
  ];
  for (const current of references) {
    const scoped = adapter(current.existing, { referencesPresent: false });
    await assert.rejects(
      () =>
        new PostgresM1Repositories(scoped.db).update(
          current.kind,
          "actor-a",
          "station-a",
          "record-a",
          current.patch,
        ),
      /station_reference_forbidden/,
    );
    assert.ok(
      scoped.calls.some((call) => call.text.includes("station_id=$")),
      `${current.kind} must scope its reference query`,
    );
    assert.equal(
      scoped.calls.some((call) => call.text.startsWith("UPDATE")),
      false,
      `${current.kind} must not persist an invalid reference`,
    );
  }
});

test("creation validates same-station references before persistence", async () => {
  const { db, calls } = adapter({}, { referencesPresent: false });
  const repo = new PostgresM1Repositories(db);
  await assert.rejects(
    () =>
      repo.createRotation("actor-a", "station-a", "playlist-b", "Rotation", 1),
    /station_reference_forbidden/,
  );
  await assert.rejects(
    () =>
      repo.createClock("actor-a", "station-a", "Clock", [
        { rotationId: "rotation-b" },
      ]),
    /station_reference_forbidden/,
  );
  await assert.rejects(
    () =>
      repo.createScheduledEvent(
        "actor-a",
        "station-a",
        "2026-08-03T12:00:00.000Z",
        "program-block",
        "block-b",
      ),
    /station_reference_forbidden/,
  );
  assert.equal(
    calls.some((call) => call.text.startsWith("INSERT INTO rotation_rules")),
    false,
  );
  assert.equal(
    calls.some((call) => call.text.startsWith("INSERT INTO clocks")),
    false,
  );
  assert.equal(
    calls.some((call) => call.text.startsWith("INSERT INTO scheduled_events")),
    false,
  );
});

test("rejected programming requests write only content-free audit fields", async () => {
  const { db, calls } = adapter({});
  await new PostgresM1Repositories(db).auditRejection(
    "actor-a",
    "station-a",
    "rotations",
    "record-a",
  );
  const audit = calls.find((call) =>
    call.text.includes("INSERT INTO audit_events"),
  );
  assert.ok(audit);
  assert.match(JSON.stringify(audit.values), /programming.request_rejected/);
  assert.doesNotMatch(
    JSON.stringify(audit.values),
    /playlist|title|payload|token/i,
  );
});
