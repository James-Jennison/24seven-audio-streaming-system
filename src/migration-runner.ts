import {
  MigrationRunError,
  migrationFailureReport,
  migrationSuccessReport,
  type MigrationFailureStage,
} from "./db/migration-diagnostics.js";

export interface MigrationPersistence {
  migrate(): Promise<void>;
  seedStations(): Promise<void>;
  close(): Promise<void>;
}

export type MigrationRunResult =
  | { event: "m2.migration_completed" }
  | {
      event: "m2.migration_failed";
      stage: MigrationFailureStage | "migration_runner";
    };

export async function runM2Migration(
  migratorUrl: string | undefined,
  createPersistence: (url: string) => MigrationPersistence,
): Promise<MigrationRunResult> {
  if (!migratorUrl)
    return migrationFailureReport(new MigrationRunError("migration_reference"));

  let persistence: MigrationPersistence;
  try {
    persistence = createPersistence(migratorUrl);
  } catch {
    return migrationFailureReport(
      new MigrationRunError("migration_runner_initialization"),
    );
  }

  let failure: unknown;
  try {
    await persistence.migrate();
    await persistence.seedStations();
  } catch (error) {
    failure = error;
  }
  try {
    await persistence.close();
  } catch {
    failure ??= new MigrationRunError("migration_connection_close");
  }
  return failure ? migrationFailureReport(failure) : migrationSuccessReport();
}
