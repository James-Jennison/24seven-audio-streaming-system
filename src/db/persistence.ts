import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import {
  assertStation,
  type Station,
  type StationSlug,
} from "../domain/contracts.js";
import { seededStations } from "../domain/stations.js";

export interface StationRepository {
  list(): readonly Station[];
  findBySlug(slug: StationSlug): Station | undefined;
}

export interface Persistence extends StationRepository {
  migrate(): void;
  seed(): void;
  close(): void;
}

interface StationRow {
  id: string;
  contract_version: "v1";
  slug: StationSlug;
  name: string;
  timezone: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export class SqlitePersistence implements Persistence {
  private readonly database: DatabaseSync;

  public constructor(databasePath: string) {
    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }
    this.database = new DatabaseSync(databasePath);
  }

  public migrate(): void {
    const migrationName = "001_initial_stations.sql";
    this.database.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL);",
    );
    const applied = this.database
      .prepare("SELECT name FROM schema_migrations WHERE name = ?")
      .get(migrationName) as { name: string } | undefined;
    if (applied) return;

    const migrationPath = fileURLToPath(
      new URL("../../migrations/001_initial_stations.sql", import.meta.url),
    );
    this.database.exec(readFileSync(migrationPath, "utf8"));
    this.database
      .prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)")
      .run(migrationName, new Date().toISOString());
  }

  public seed(): void {
    const insert = this.database.prepare(`
      INSERT INTO stations (id, contract_version, slug, name, timezone, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);
    for (const station of seededStations) {
      assertStation(station);
      insert.run(
        station.id,
        station.contractVersion,
        station.slug,
        station.name,
        station.timezone,
        station.enabled ? 1 : 0,
        station.createdAt,
        station.updatedAt,
      );
    }
  }

  public list(): readonly Station[] {
    const rows = this.database
      .prepare("SELECT * FROM stations ORDER BY name ASC")
      .all() as unknown as StationRow[];
    return rows.map((row) => this.toStation(row));
  }

  public findBySlug(slug: StationSlug): Station | undefined {
    const row = this.database
      .prepare("SELECT * FROM stations WHERE slug = ?")
      .get(slug) as StationRow | undefined;
    return row ? this.toStation(row) : undefined;
  }

  public close(): void {
    this.database.close();
  }

  private toStation(row: StationRow): Station {
    return {
      id: row.id,
      contractVersion: row.contract_version,
      slug: row.slug,
      name: row.name,
      timezone: row.timezone,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
