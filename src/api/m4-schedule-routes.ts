import type { IncomingMessage, ServerResponse } from "node:http";

import { assertAuthorized } from "../app/authorization.js";
import type { ApplicationRole } from "../domain/programming.js";
import {
  authenticate,
  csrf,
  type SessionContext,
  type SessionLookup,
} from "./m1-session.js";

export interface M4ScheduleAudit {
  auditRejection?(
    actor: string | undefined,
    stationId: string,
    action?: string,
  ): Promise<void>;
}

/** Local-only M4.8 route surface: visibility only; schedule actions fail closed. */
export async function handleM4Schedule(
  request: IncomingMessage,
  response: ServerResponse,
  sessions: SessionLookup,
  audit: M4ScheduleAudit,
): Promise<boolean> {
  const match = new URL(request.url ?? "/", "http://localhost").pathname.match(
    /^\/api\/v1\/stations\/([^/]+)\/schedule(?:\/(preview|review|approval|publication|rollback))?$/,
  );
  if (!match) return false;
  const stationId = match[1]!;
  const action = match[2];
  let principal: SessionContext | undefined;
  try {
    principal = await authenticate(sessions, request.headers.cookie);
    if (request.method === "GET" && !action) {
      authorize(principal, stationId, "read");
      json(response, 200, {
        stationId,
        preview: "fixture_unavailable",
        review: "fixture_unavailable",
        approval: "fixture_unavailable",
        publication: "fixture_unavailable",
        rollback: "proposal_unavailable",
        execution: "unavailable",
      });
      return true;
    }
    if (request.method !== "POST" || !action) return method(response);
    authorize(principal, stationId, "program");
    const header = request.headers["x-csrf-token"];
    await csrf(
      sessions,
      request.headers.cookie,
      typeof header === "string" ? header : undefined,
    );
    await audit.auditRejection?.(principal.userId, stationId, action);
    json(response, 409, { error: "operation_unavailable" });
  } catch (error) {
    await audit.auditRejection?.(principal?.userId, stationId, action);
    const message = error instanceof Error ? error.message : "internal_error";
    const status =
      message === "unauthenticated"
        ? 401
        : message === "forbidden" || message === "csrf_rejected"
          ? 403
          : message === "station_forbidden" || message === "not_found"
            ? 404
            : 500;
    json(response, status, {
      error:
        status === 404
          ? "not_found"
          : message === "csrf_rejected" ||
              message === "forbidden" ||
              message === "unauthenticated"
            ? message
            : "internal_error",
    });
  }
  return true;
}

function authorize(
  principal: SessionContext,
  stationId: string,
  action: "read" | "program",
): void {
  assertAuthorized(
    principal.role as ApplicationRole,
    principal.stationIds,
    stationId,
    action,
  );
}
function method(response: ServerResponse): boolean {
  json(response, 405, { error: "method_not_allowed" });
  return true;
}
function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}
