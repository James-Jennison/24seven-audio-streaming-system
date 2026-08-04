import { PostgresPersistence } from "./db/postgres.js";
import { runM2Migration } from "./migration-runner.js";

const result = await runM2Migration(
  process.env.DATABASE_MIGRATOR_URL,
  (url) => new PostgresPersistence(url),
);
if (result.event === "m2.migration_failed") {
  console.error(JSON.stringify(result));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result));
}
