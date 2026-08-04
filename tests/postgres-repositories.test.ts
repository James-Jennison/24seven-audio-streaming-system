import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  PostgresM1Repositories,
  type SqlExecutor,
} from "../src/db/m1-repositories.js";
test("PostgreSQL repository scopes media and playlist references by station in SQL", async () => {
  const calls: string[] = [];
  const db: SqlExecutor = {
    async query<T>(text: string) {
      calls.push(text);
      return {
        rows: [
          {
            id: "m",
            stationId: "a",
            title: "T",
            artist: "A",
            category: "c",
            genreTags: [],
            tags: [],
            sourceReference: "r",
            lifecycleState: "draft",
            createdAt: "x",
            updatedAt: "x",
          },
        ] as unknown as T[],
        rowCount: 1,
      };
    },
  };
  const repo = new PostgresM1Repositories(db);
  await repo.listMedia("a");
  await repo.addPlaylistItem("u", "a", "p", "m", 0);
  assert.match(calls[0]!, /WHERE station_id=\$1/);
  assert.match(calls[1]!, /m\.station_id=p\.station_id/);
});

test("PostgreSQL repository scopes program-block clock references and identity writes", async () => {
  const calls: string[] = [];
  const db: SqlExecutor = {
    async query<T>(text: string) {
      calls.push(text);
      return { rows: [] as T[], rowCount: text.includes("FROM users") ? 0 : 1 };
    },
  };
  const repo = new PostgresM1Repositories(db);
  await repo.bootstrapUser("owner@example.test", "scrypt$hash");
  await repo.createProgramBlock(
    "owner",
    "station_a",
    "clock_a",
    "Morning",
    "UTC",
    "09:00",
    [1],
  );
  assert.match(calls.join("\n"), /FROM clocks WHERE id=\$1 AND station_id=\$2/);
  assert.match(calls.join("\n"), /INSERT INTO sessions|INSERT INTO users/);
  assert.match(calls.join("\n"), /INSERT INTO audit_events/);
});

test("media update loads and writes within station scope before validation", async () => {
  const calls: string[] = [];
  const db: SqlExecutor = {
    async query<T>(text: string) {
      calls.push(text);
      return {
        rows: [
          {
            id: "m",
            stationId: "station_a",
            title: "Title",
            artist: "Artist",
            category: "music",
            genreTags: [],
            tags: [],
            sourceReference: "source",
            lifecycleState: "draft",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ] as unknown as T[],
        rowCount: 1,
      };
    },
  };
  await new PostgresM1Repositories(db).update(
    "media",
    "owner",
    "station_a",
    "m",
    { title: "Updated" },
  );
  assert.match(calls[0]!, /WHERE id=\$1 AND station_id=\$2/);
  assert.match(calls[1]!, /UPDATE media_assets/);
});

test("program block creation rejects a clock outside the station scope", async () => {
  const db: SqlExecutor = {
    async query<T>(text: string) {
      return {
        rows: [] as T[],
        rowCount: text.includes("FROM clocks") ? 0 : 1,
      };
    },
  };
  await assert.rejects(
    () =>
      new PostgresM1Repositories(db).createProgramBlock(
        "owner",
        "station_a",
        "clock_b",
        "Block",
        "UTC",
        "00:00",
        [1],
      ),
    /station_reference_forbidden/,
  );
});

test("identity persistence resolves roles deterministically and supports the global owner scope", async () => {
  const calls: string[] = [];
  const db: SqlExecutor = {
    async query<T>(text: string) {
      calls.push(text);
      return {
        rows: [
          {
            id: "owner-a",
            passwordHash: "scrypt$hash",
            enabled: true,
            role: "owner",
            stationIds: [],
          },
        ] as unknown as T[],
        rowCount: 1,
      };
    },
  };
  await new PostgresM1Repositories(db).findUserByEmail("owner@example.test");
  assert.match(calls[0]!, /array_agg\(ur\.role ORDER BY CASE ur\.role/);
  const migration = readFileSync(
    fileURLToPath(
      new URL("../migrations/002_m1_control_plane.sql", import.meta.url),
    ),
    "utf8",
  );
  assert.match(
    migration,
    /UNIQUE NULLS NOT DISTINCT \(user_id, role, station_id\)/,
  );
  assert.match(migration, /role = 'owner' AND station_id IS NULL/);
});
