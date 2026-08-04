import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { createControlPlaneServer } from "./api/server.js";
import { applicationVersion } from "./app/version.js";
import { SqlitePersistence } from "./db/persistence.js";

const host = process.env.HOST ?? "127.0.0.1";
if (host !== "127.0.0.1" && host !== "::1") {
  throw new Error("M0 only permits loopback hosts: 127.0.0.1 or ::1.");
}

const port = Number.parseInt(process.env.PORT ?? "3100", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const databasePath = resolve(
  process.env.DATABASE_PATH ?? "./data/24seven-m0.sqlite",
);
mkdirSync(dirname(databasePath), { recursive: true });
const persistence = new SqlitePersistence(databasePath);
persistence.migrate();
persistence.seed();

const controlPlane = createControlPlaneServer(
  persistence,
  applicationVersion(),
);
controlPlane.server.listen(port, host, () => {
  const address = controlPlane.server.address();
  const listeningPort =
    typeof address === "object" && address ? address.port : port;
  console.log(
    `24Seven M0 control plane listening on http://${host}:${listeningPort}`,
  );
});

function close(): void {
  controlPlane.server.close(() => persistence.close());
}

process.once("SIGINT", close);
process.once("SIGTERM", close);
