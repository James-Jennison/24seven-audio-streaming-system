import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";

import type { ApplicationVersion } from "../app/version.js";
import type { StationRepository } from "../db/persistence.js";
import { renderDashboard } from "../ui/dashboard.js";

export interface ControlPlaneServer {
  server: Server;
  isReady: () => boolean;
}

export function createControlPlaneServer(
  stations: StationRepository,
  version: ApplicationVersion,
): ControlPlaneServer {
  let ready = false;

  const server = createServer((request, response) => {
    handleRequest(request, response, stations, version, ready);
  });
  ready = true;
  return { server, isReady: () => ready };
}

function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  stations: StationRepository,
  version: ApplicationVersion,
  ready: boolean,
): void {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");
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
    sendJson(response, 200, {
      contractVersion: "v1",
      stations: stations.list().map((station) => ({
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
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(renderDashboard(stations.list(), version));
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
