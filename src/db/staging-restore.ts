export const stagingRestoreFailureStages = [
  "restore_reference",
  "recovery_target_configuration",
  "backup_attribution",
  "rpo_window",
  "recovery_target_start",
  "restore_authority_configuration",
  "archive_restore",
  "recovery_validation",
  "rto_window",
  "recovery_target_cleanup",
  "recovery_evidence",
] as const;

export type StagingRestoreFailureStage =
  (typeof stagingRestoreFailureStages)[number];

export class StagingRestoreError extends Error {
  public constructor(public readonly stage: StagingRestoreFailureStage) {
    super("staging_restore_failed");
    this.name = "StagingRestoreError";
  }
}

export function stagingRestoreFailureReport(error: unknown): {
  event: "m2.staging_restore_failed";
  stage: StagingRestoreFailureStage | "restore_runner";
} {
  return {
    event: "m2.staging_restore_failed",
    stage:
      error instanceof StagingRestoreError ? error.stage : "restore_runner",
  };
}

export function isWithinRecoveryObjective(
  elapsedMilliseconds: number,
  maximumHours: number,
): boolean {
  return (
    Number.isFinite(elapsedMilliseconds) &&
    elapsedMilliseconds >= 0 &&
    elapsedMilliseconds <= maximumHours * 60 * 60 * 1000
  );
}
