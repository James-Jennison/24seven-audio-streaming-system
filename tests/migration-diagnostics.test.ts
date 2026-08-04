import assert from "node:assert/strict";
import test from "node:test";

import {
  MigrationRunError,
  migrationFailureReport,
  migrationFailureStages,
} from "../src/db/migration-diagnostics.js";

test("migration diagnostics remain content-free and expose only approved stages", () => {
  assert.deepEqual(
    migrationFailureReport(new MigrationRunError("station_seed")),
    {
      event: "m2.migration_failed",
      stage: "station_seed",
    },
  );
  assert.deepEqual(migrationFailureReport(new Error("secret detail")), {
    event: "m2.migration_failed",
    stage: "migration_runner",
  });
  assert.ok(migrationFailureStages.includes("migration_transaction_apply"));
  assert.ok(migrationFailureStages.includes("migration_connection_close"));
  assert.deepEqual(
    migrationFailureReport(new MigrationRunError("migration_connection_close")),
    { event: "m2.migration_failed", stage: "migration_connection_close" },
  );
  assert.doesNotMatch(
    JSON.stringify(migrationFailureReport(new Error("secret detail"))),
    /secret detail/,
  );
});
