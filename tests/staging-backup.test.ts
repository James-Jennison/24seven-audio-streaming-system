import assert from "node:assert/strict";
import test from "node:test";

import {
  StagingBackupError,
  artifactIdsToPrune,
  stagingBackupFailureReport,
  stagingBackupFailureStages,
} from "../src/db/staging-backup.js";

test("retention preserves the fourteen newest verified daily backup sets", () => {
  const sets = Array.from({ length: 16 }, (_, index) => ({
    artifactId: `artifact-${index}`,
    backupDay: `202608${String(index + 1).padStart(2, "0")}`,
  }));
  assert.deepEqual(artifactIdsToPrune(sets), ["artifact-0", "artifact-1"]);
});

test("retention never prunes multiple verified sets from retained days", () => {
  const sets = [
    { artifactId: "older", backupDay: "20260801" },
    { artifactId: "newer-a", backupDay: "20260815" },
    { artifactId: "newer-b", backupDay: "20260815" },
  ];
  assert.deepEqual(artifactIdsToPrune(sets, 1), ["older"]);
});

test("backup diagnostics expose only approved content-free stages", () => {
  for (const stage of stagingBackupFailureStages) {
    assert.deepEqual(
      stagingBackupFailureReport(new StagingBackupError(stage)),
      {
        event: "m2.staging_backup_failed",
        stage,
      },
    );
  }
  assert.doesNotMatch(
    JSON.stringify(stagingBackupFailureReport(new Error("sensitive detail"))),
    /sensitive detail/,
  );
});
