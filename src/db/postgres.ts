import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import {
  assertStation,
  type Station,
  type StationSlug,
} from "../domain/contracts.js";
import { seededStations } from "../domain/stations.js";

export interface StationRepository {
  list(): Promise<readonly Station[]>;
  findBySlug(slug: StationSlug): Promise<Station | undefined>;
}

interface StationRow {
  id: string;
  contract_version: "v1";
  slug: StationSlug;
  name: string;
  timezone: string;
  enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export class PostgresPersistence implements StationRepository {
  public readonly pool: Pool;

  public constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 5 });
  }

  public async migrate(): Promise<void> {
    await this.pool.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)",
    );
    for (const name of ["002_m1_control_plane.sql"]) {
      const existing = await this.pool.query(
        "SELECT 1 FROM schema_migrations WHERE name = $1",
        [name],
      );
      if (existing.rowCount) continue;
      const path = fileURLToPath(
        new URL(`../../migrations/${name}`, import.meta.url),
      );
      await this.pool.query("BEGIN");
      try {
        await this.pool.query(readFileSync(path, "utf8"));
        await this.pool.query(
          "INSERT INTO schema_migrations (name, applied_at) VALUES ($1, now())",
          [name],
        );
        await this.pool.query("COMMIT");
      } catch (error) {
        await this.pool.query("ROLLBACK");
        throw error;
      }
    }
  }

  public async seedStations(): Promise<void> {
    for (const station of seededStations) {
      assertStation(station);
      await this.pool.query(
        `INSERT INTO stations (id, contract_version, slug, name, timezone, enabled, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [
          station.id,
          station.contractVersion,
          station.slug,
          station.name,
          station.timezone,
          station.enabled,
          station.createdAt,
          station.updatedAt,
        ],
      );
    }
  }

  public async list(): Promise<readonly Station[]> {
    const result = await this.pool.query<StationRow>(
      "SELECT * FROM stations ORDER BY name ASC",
    );
    return result.rows.map((row) => this.toStation(row));
  }

  public async findBySlug(slug: StationSlug): Promise<Station | undefined> {
    const result = await this.pool.query<StationRow>(
      "SELECT * FROM stations WHERE slug = $1",
      [slug],
    );
    return result.rows[0] ? this.toStation(result.rows[0]) : undefined;
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  private toStation(row: StationRow): Station {
    return {
      id: row.id,
      contractVersion: row.contract_version,
      slug: row.slug,
      name: row.name,
      timezone: row.timezone,
      enabled: row.enabled,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
