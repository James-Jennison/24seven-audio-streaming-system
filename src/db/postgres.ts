import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

import {
  assertStation,
  type Station,
  type StationSlug,
} from "../domain/contracts.js";
import { seededStations } from "../domain/stations.js";
import {
  MigrationRunError,
  type MigrationFailureStage,
} from "./migration-diagnostics.js";

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
    await this.guarded("migration_ledger_bootstrap", () =>
      this.pool.query(
        "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL)",
      ),
    );
    for (const name of ["002_m1_control_plane.sql"]) {
      const existing = await this.guarded("migration_ledger_lookup", () =>
        this.pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [
          name,
        ]),
      );
      if (existing.rowCount) continue;
      const path = fileURLToPath(
        new URL(`../../migrations/${name}`, import.meta.url),
      );
      let migration: string;
      try {
        migration = readFileSync(path, "utf8");
      } catch {
        throw new MigrationRunError("migration_artifact_read");
      }
      await this.guarded("migration_transaction_begin", () =>
        this.pool.query("BEGIN"),
      );
      try {
        await this.guarded("migration_transaction_apply", () =>
          this.pool.query(migration),
        );
        await this.guarded("migration_ledger_record", () =>
          this.pool.query(
            "INSERT INTO schema_migrations (name, applied_at) VALUES ($1, now())",
            [name],
          ),
        );
        await this.guarded("migration_transaction_commit", () =>
          this.pool.query("COMMIT"),
        );
      } catch (error) {
        try {
          await this.pool.query("ROLLBACK");
        } catch {
          throw new MigrationRunError("migration_transaction_rollback");
        }
        throw error;
      }
    }
  }

  public async seedStations(): Promise<void> {
    try {
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
    } catch {
      throw new MigrationRunError("station_seed");
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

  private async guarded<T>(
    stage: MigrationFailureStage,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch {
      throw new MigrationRunError(stage);
    }
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
