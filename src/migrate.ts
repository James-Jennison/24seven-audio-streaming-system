import { PostgresPersistence } from "./db/postgres.js";

const url = process.env.DATABASE_MIGRATOR_URL;
if (!url) throw new Error("DATABASE_MIGRATOR_URL is required for migrations.");

const persistence = new PostgresPersistence(url);
try {
  await persistence.migrate();
  await persistence.seedStations();
  console.log("PostgreSQL migrations and station seed completed.");
} finally {
  await persistence.close();
}
