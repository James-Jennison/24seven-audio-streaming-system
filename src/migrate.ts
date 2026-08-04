import { PostgresPersistence } from "./db/postgres.js";
import {
  MigrationRunError,
  migrationFailureReport,
} from "./db/migration-diagnostics.js";

const url = process.env.DATABASE_MIGRATOR_URL;
if (!url) {
  console.error(
    JSON.stringify({
      event: "m2.migration_failed",
      stage: "migration_reference",
    }),
  );
  process.exitCode = 1;
} else {
  const persistence = new PostgresPersistence(url);
  let failure: unknown;
  try {
    await persistence.migrate();
    await persistence.seedStations();
    console.log("PostgreSQL migrations and station seed completed.");
  } catch (error) {
    failure = error;
  }
  try {
    await persistence.close();
  } catch {
    failure ??= new MigrationRunError("migration_connection_close");
  }
  if (failure) {
    console.error(JSON.stringify(migrationFailureReport(failure)));
    process.exitCode = 1;
  }
}
