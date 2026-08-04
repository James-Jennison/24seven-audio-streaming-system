import { createControlPlaneServer } from "./api/server.js";
import { applicationVersion } from "./app/version.js";
import { PostgresPersistence } from "./db/postgres.js";
import {
  PostgresM1Repositories,
  type SqlExecutor,
} from "./db/m1-repositories.js";

const host = process.env.HOST ?? "127.0.0.1";
if (host !== "127.0.0.1" && host !== "::1") {
  throw new Error("M0 only permits loopback hosts: 127.0.0.1 or ::1.");
}

const port = Number.parseInt(process.env.PORT ?? "3100", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const databaseUrl = process.env.DATABASE_RUNTIME_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_RUNTIME_URL is required; SQLite is not an M1 runtime fallback.",
  );
}
const persistence = new PostgresPersistence(databaseUrl);
const m1 = new PostgresM1Repositories(
  persistence.pool as unknown as SqlExecutor,
);

const controlPlane = createControlPlaneServer(
  persistence,
  applicationVersion(),
  {
    hasUsers: () => m1.hasUsers(),
    bootstrap: (email, hash) => m1.bootstrap(email, hash),
    findUser: (email) => m1.findUser(email),
    createSession: async (userId, tokenHash, csrfHash, expiresAt) => {
      await m1.createAuthSession(userId, tokenHash, csrfHash, expiresAt);
    },
    revoke: (tokenHash) => m1.revoke(tokenHash),
    audit: (action, entityId, actorId) =>
      m1.audit(actorId, undefined, action, "authentication", entityId),
  },
  {
    lookupSession: (hash) => m1.lookupSession(hash),
    audit: (action, entityId, actorId) =>
      m1.audit(actorId, undefined, action, "authentication", entityId),
  },
  {
    list: (kind, stationId) => m1.list(kind, stationId),
    create: (kind, actor, stationId, body) =>
      m1.create(kind, actor, stationId, body),
    read: (kind, stationId, id) => m1.read(kind, stationId, id),
    delete: (kind, actor, stationId, id) =>
      m1.delete(kind, actor, stationId, id),
    update: (kind, actor, stationId, id, body) =>
      m1.update(kind, actor, stationId, id, body),
    auditRejection: (actor, stationId, kind, id) =>
      m1.auditRejection(actor, stationId, kind, id),
  },
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
  controlPlane.server.close(() => void persistence.close());
}

process.once("SIGINT", close);
process.once("SIGTERM", close);
