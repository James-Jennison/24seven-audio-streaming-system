import assert from "node:assert/strict";
import test from "node:test";
import type { Pool } from "pg";

import {
  MigrationRunError,
  migrationFailureReport,
  migrationFailureStages,
} from "../src/db/migration-diagnostics.js";
import { PostgresPersistence } from "../src/db/postgres.js";
import { runM2Migration } from "../src/migration-runner.js";

class FakePool {
  public calls = 0;

  public constructor(
    private readonly failAt: number | undefined = undefined,
    private readonly failRollback = false,
  ) {}

  public async query<T>(
    text: string,
  ): Promise<{ rows: T[]; rowCount: number }> {
    this.calls += 1;
    if (this.failRollback && text === "ROLLBACK") throw new Error("failure");
    if (this.calls === this.failAt) throw new Error("failure");
    return { rows: [], rowCount: 0 };
  }

  public async end(): Promise<void> {}
}

async function expectStage(
  operation: () => Promise<void>,
  stage: (typeof migrationFailureStages)[number],
): Promise<void> {
  await assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof MigrationRunError && error.stage === stage,
  );
}

test("PostgreSQL migration paths classify every repository-supported query failure", async () => {
  const queryStages = [
    ["migration_ledger_bootstrap", 1],
    ["migration_ledger_lookup", 2],
    ["migration_transaction_begin", 3],
    ["migration_transaction_apply", 4],
    ["migration_ledger_record", 5],
    ["migration_transaction_commit", 6],
  ] as const;

  for (const [stage, failAt] of queryStages) {
    const pool = new FakePool(failAt);
    const persistence = new PostgresPersistence("postgresql://test", {
      pool: pool as unknown as Pool,
      readMigration: () => "safe migration fixture",
    });
    await expectStage(() => persistence.migrate(), stage);
  }

  const unreadable = new PostgresPersistence("postgresql://test", {
    pool: new FakePool() as unknown as Pool,
    readMigration: () => {
      throw new Error("unreadable");
    },
  });
  await expectStage(() => unreadable.migrate(), "migration_artifact_read");

  const rollbackFailure = new PostgresPersistence("postgresql://test", {
    pool: new FakePool(4, true) as unknown as Pool,
    readMigration: () => "safe migration fixture",
  });
  await expectStage(
    () => rollbackFailure.migrate(),
    "migration_transaction_rollback",
  );

  const seedFailure = new PostgresPersistence("postgresql://test", {
    pool: new FakePool(13) as unknown as Pool,
    readMigration: () => "safe migration fixture",
  });
  await seedFailure.migrate();
  await expectStage(() => seedFailure.seedStations(), "station_seed");
});

test("runner maps configuration, initialization, close, and generic outer failures safely", async () => {
  assert.deepEqual(await runM2Migration(undefined, () => unreachable()), {
    event: "m2.migration_failed",
    stage: "migration_reference",
  });
  assert.deepEqual(
    await runM2Migration("postgresql://test", () => {
      throw new Error("initialization failure");
    }),
    { event: "m2.migration_failed", stage: "migration_runner_initialization" },
  );
  assert.deepEqual(
    await runM2Migration("postgresql://test", () => ({
      migrate: async () => {},
      seedStations: async () => {},
      close: async () => {
        throw new Error("close failure");
      },
    })),
    { event: "m2.migration_failed", stage: "migration_connection_close" },
  );
  assert.deepEqual(
    await runM2Migration("postgresql://test", () => ({
      migrate: async () => {
        throw new Error("external failure");
      },
      seedStations: async () => {},
      close: async () => {},
    })),
    { event: "m2.migration_failed", stage: "migration_runner" },
  );
});

test("runner preserves every classified persistence failure without collapsing to generic", async () => {
  const persistenceStages = migrationFailureStages.filter(
    (stage) =>
      ![
        "migration_build",
        "migration_reference",
        "migration_runner_initialization",
        "migration_connection_close",
      ].includes(stage),
  );

  for (const stage of persistenceStages) {
    const result = await runM2Migration("postgresql://test", () => ({
      migrate: async () => {
        if (stage !== "station_seed") throw new MigrationRunError(stage);
      },
      seedStations: async () => {
        if (stage === "station_seed") throw new MigrationRunError(stage);
      },
      close: async () => {},
    }));
    assert.deepEqual(result, { event: "m2.migration_failed", stage });
  }
});

test("diagnostic reports permit only approved content-free stages", () => {
  for (const stage of migrationFailureStages) {
    assert.deepEqual(migrationFailureReport(new MigrationRunError(stage)), {
      event: "m2.migration_failed",
      stage,
    });
  }
  assert.doesNotMatch(
    JSON.stringify(migrationFailureReport(new Error("secret detail"))),
    /secret detail/,
  );
});

function unreachable(): never {
  throw new Error("unreachable");
}
