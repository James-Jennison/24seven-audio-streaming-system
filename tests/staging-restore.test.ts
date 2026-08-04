import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
  StagingRestoreError,
  isWithinRecoveryObjective,
  stagingRestoreFailureReport,
  stagingRestoreFailureStages,
} from "../src/db/staging-restore.js";

test("restore diagnostics expose only approved content-free stages", () => {
  for (const stage of stagingRestoreFailureStages) {
    assert.deepEqual(
      stagingRestoreFailureReport(new StagingRestoreError(stage)),
      {
        event: "m2.staging_restore_failed",
        stage,
      },
    );
  }
  assert.doesNotMatch(
    JSON.stringify(stagingRestoreFailureReport(new Error("sensitive detail"))),
    /sensitive detail/,
  );
});

test("recovery objectives are inclusive and reject invalid durations", () => {
  assert.equal(isWithinRecoveryObjective(24 * 60 * 60 * 1000, 24), true);
  assert.equal(isWithinRecoveryObjective(4 * 60 * 60 * 1000 + 1, 4), false);
  assert.equal(isWithinRecoveryObjective(-1, 4), false);
});

test("restore contract is isolated, loopback-only, and cleanup-bound", async () => {
  const runner = await readFile(
    join(process.cwd(), "src", "restore-staging.ts"),
    "utf8",
  );
  const compose = await readFile(
    join(process.cwd(), "compose.m2-recovery.yaml"),
    "utf8",
  );
  const authority = await readFile(
    join(process.cwd(), "docs", "M2.4_STAGING_RESTORE_AUTHORITY.sql"),
    "utf8",
  );
  assert.match(runner, /--exit-on-error/);
  assert.match(runner, /down", "--volumes/);
  assert.match(runner, /isWithinRecoveryObjective/);
  assert.match(compose, /127\.0\.0\.1:/);
  assert.match(compose, /postgres:17\.5-bookworm/);
  assert.match(
    authority,
    /NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/,
  );
});
