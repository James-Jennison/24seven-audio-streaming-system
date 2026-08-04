export const migrationFailureStages = [
  "migration_reference",
  "migration_ledger_bootstrap",
  "migration_ledger_lookup",
  "migration_artifact_read",
  "migration_transaction_begin",
  "migration_transaction_apply",
  "migration_ledger_record",
  "migration_transaction_commit",
  "migration_transaction_rollback",
  "station_seed",
  "migration_connection_close",
] as const;

export type MigrationFailureStage = (typeof migrationFailureStages)[number];

export class MigrationRunError extends Error {
  public constructor(public readonly stage: MigrationFailureStage) {
    super("migration_failed");
    this.name = "MigrationRunError";
  }
}

export function migrationFailureReport(error: unknown): {
  event: "m2.migration_failed";
  stage: MigrationFailureStage | "migration_runner";
} {
  return {
    event: "m2.migration_failed",
    stage:
      error instanceof MigrationRunError ? error.stage : "migration_runner",
  };
}
