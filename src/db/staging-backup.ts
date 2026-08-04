export const stagingBackupFailureStages = [
  "backup_reference",
  "backup_destination",
  "backup_authority_configuration",
  "backup_dump",
  "backup_archive_validation",
  "backup_checksum",
  "backup_manifest",
  "backup_retention",
] as const;

export type StagingBackupFailureStage =
  (typeof stagingBackupFailureStages)[number];

export class StagingBackupError extends Error {
  public constructor(public readonly stage: StagingBackupFailureStage) {
    super("staging_backup_failed");
    this.name = "StagingBackupError";
  }
}

export interface VerifiedBackupSet {
  artifactId: string;
  backupDay: string;
}

export function stagingBackupFailureReport(error: unknown): {
  event: "m2.staging_backup_failed";
  stage: StagingBackupFailureStage | "backup_runner";
} {
  return {
    event: "m2.staging_backup_failed",
    stage: error instanceof StagingBackupError ? error.stage : "backup_runner",
  };
}

export function artifactIdsToPrune(
  verifiedSets: readonly VerifiedBackupSet[],
  retainedDays = 14,
): readonly string[] {
  const retained = new Set(
    [...new Set(verifiedSets.map((set) => set.backupDay))]
      .sort((left, right) => right.localeCompare(left))
      .slice(0, retainedDays),
  );
  return verifiedSets
    .filter((set) => !retained.has(set.backupDay))
    .map((set) => set.artifactId);
}
