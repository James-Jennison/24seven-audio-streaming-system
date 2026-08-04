import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import type { ApplicationVersion } from "../app/version.js";
import { renderDashboard } from "../ui/dashboard.js";
import { handleM1Auth } from "./m1-routes.js";
import type { AuthPersistence } from "./m1-auth.js";
import { authenticate, type SessionLookup } from "./m1-session.js";
import {
  handleProgramming,
  type ProgrammingPersistence,
} from "./m1-programming-routes.js";

export interface StationReader {
  list():
    | readonly import("../domain/contracts.js").Station[]
    | Promise<readonly import("../domain/contracts.js").Station[]>;
}

export interface ControlPlaneServer {
  server: Server;
  isReady: () => boolean;
}

export function createControlPlaneServer(
  stations: StationReader,
  version: ApplicationVersion,
  auth?: AuthPersistence,
  sessions?: SessionLookup,
  programming?: ProgrammingPersistence,
): ControlPlaneServer {
  let ready = false;

  const server = createServer((request, response) => {
    void handleRequest(
      request,
      response,
      stations,
      version,
      ready,
      auth,
      sessions,
      programming,
    ).catch(() => sendJson(response, 500, { error: "internal_error" }));
  });
  ready = true;
  return { server, isReady: () => ready };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  stations: StationReader,
  version: ApplicationVersion,
  ready: boolean,
  auth?: AuthPersistence,
  sessions?: SessionLookup,
  programming?: ProgrammingPersistence,
): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");
  if (auth && (await handleM1Auth(request, response, auth, sessions))) return;
  if (
    sessions &&
    programming &&
    (await handleProgramming(request, response, sessions, programming))
  )
    return;
  if (sessions && method === "GET" && url.pathname === "/api/v1/session") {
    try {
      const principal = await authenticate(sessions, request.headers.cookie);
      sendJson(response, 200, {
        userId: principal.userId,
        role: principal.role,
        stationIds: principal.stationIds,
        readOnly: principal.role === "observer",
      });
    } catch {
      sendJson(response, 401, { error: "unauthenticated" });
    }
    return;
  }
  if (method !== "GET") {
    sendJson(response, 405, { error: "method_not_allowed" });
    return;
  }

  if (url.pathname === "/healthz") {
    sendJson(response, 200, { status: "ok" });
    return;
  }
  if (url.pathname === "/readyz") {
    sendJson(response, ready ? 200 : 503, {
      status: ready ? "ready" : "not_ready",
    });
    return;
  }
  if (url.pathname === "/api/v1/version") {
    sendJson(response, 200, { contractVersion: "v1", ...version });
    return;
  }
  if (url.pathname === "/api/v1/stations") {
    const stationList = await stations.list();
    sendJson(response, 200, {
      contractVersion: "v1",
      stations: stationList.map((station) => ({
        ...station,
        runtime: {
          status: "unavailable",
          reason: "Audio runtime not implemented in M0",
          authoritativeWriter: "audio-runtime",
        },
      })),
    });
    return;
  }
  if (url.pathname === "/") {
    const stationList = await stations.list();
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderDashboard(stationList, version));
    return;
  }
  sendJson(response, 404, { error: "not_found" });
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}
