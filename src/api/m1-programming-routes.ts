import type { IncomingMessage, ServerResponse } from "node:http";

import { assertAuthorized } from "../app/authorization.js";
import {
  dryRunSelection,
  type ApplicationRole,
  type MediaMetadata,
} from "../domain/programming.js";
import {
  authenticate,
  csrf,
  type SessionContext,
  type SessionLookup,
} from "./m1-session.js";

export interface ProgrammingPersistence {
  list(kind: string, stationId: string): Promise<unknown[]>;
  create(
    kind: string,
    actor: string,
    stationId: string,
    body: Record<string, unknown>,
  ): Promise<unknown>;
  read(kind: string, stationId: string, id: string): Promise<unknown>;
  delete(
    kind: string,
    actor: string,
    stationId: string,
    id: string,
  ): Promise<void>;
  update(
    kind: string,
    actor: string,
    stationId: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<unknown>;
  auditRejection?(
    actor: string | undefined,
    stationId: string,
    kind: string,
    id?: string,
  ): Promise<void>;
}

const kinds = new Set([
  "media",
  "playlists",
  "separation-rules",
  "rotations",
  "clocks",
  "program-blocks",
  "scheduled-events",
]);

export async function handleProgramming(
  request: IncomingMessage,
  response: ServerResponse,
  sessions: SessionLookup,
  store: ProgrammingPersistence,
): Promise<boolean> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const dryRun = url.pathname.match(/^\/api\/v1\/stations\/([^/]+)\/dry-run$/);
  if (dryRun) {
    if (request.method !== "GET") {
      json(response, 405, { error: "method_not_allowed" });
      return true;
    }
    return handleDryRun(request, response, sessions, store, dryRun[1]!, url);
  }

  const match = url.pathname.match(
    /^\/api\/v1\/stations\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/,
  );
  if (!match || !kinds.has(match[2] ?? "")) return false;
  const stationId = match[1]!;
  const kind = match[2]!;
  const id = match[3];
  let principal: SessionContext | undefined;
  try {
    principal = await authenticate(sessions, request.headers.cookie);
    if (request.method === "GET") {
      authorize(principal, stationId, "read");
      json(
        response,
        200,
        id
          ? await store.read(kind, stationId, id)
          : { items: await store.list(kind, stationId) },
      );
      return true;
    }
    if (request.method === "POST") {
      await authorizeMutation(request, sessions, principal, stationId);
      json(
        response,
        201,
        await store.create(
          kind,
          principal.userId,
          stationId,
          await body(request),
        ),
      );
      return true;
    }
    if (request.method === "PATCH" && id) {
      await authorizeMutation(request, sessions, principal, stationId);
      json(
        response,
        200,
        await store.update(
          kind,
          principal.userId,
          stationId,
          id,
          await body(request),
        ),
      );
      return true;
    }
    if (request.method === "DELETE" && id) {
      await authorizeMutation(request, sessions, principal, stationId);
      await store.delete(kind, principal.userId, stationId, id);
      response.writeHead(204);
      response.end();
      return true;
    }
    json(response, 405, { error: "method_not_allowed" });
    return true;
  } catch (error) {
    await rejectionAudit(store, principal, stationId, kind, id);
    const result = safeError(error);
    json(response, result.status, { error: result.error });
    return true;
  }
}

async function handleDryRun(
  request: IncomingMessage,
  response: ServerResponse,
  sessions: SessionLookup,
  store: ProgrammingPersistence,
  stationId: string,
  url: URL,
): Promise<boolean> {
  let principal: SessionContext | undefined;
  try {
    const separationText = url.searchParams.get("separationMinutes") ?? "0";
    if (!/^\d+$/.test(separationText)) throw new Error("validation_error");
    const separationMinutes = Number(separationText);
    if (!Number.isSafeInteger(separationMinutes))
      throw new Error("validation_error");
    principal = await authenticate(sessions, request.headers.cookie);
    authorize(principal, stationId, "read");
    const candidates = (await store.list(
      "media",
      stationId,
    )) as MediaMetadata[];
    json(response, 200, {
      stationId,
      readOnly: true,
      separationMinutes,
      plan: dryRunSelection(stationId, candidates, [], separationMinutes),
    });
  } catch (error) {
    await rejectionAudit(store, principal, stationId, "dry-run", undefined);
    const result = safeError(error);
    json(response, result.status, { error: result.error });
  }
  return true;
}

async function authorizeMutation(
  request: IncomingMessage,
  sessions: SessionLookup,
  principal: SessionContext,
  stationId: string,
): Promise<void> {
  authorize(principal, stationId, "program");
  const csrfHeader = request.headers["x-csrf-token"];
  await csrf(
    sessions,
    request.headers.cookie,
    typeof csrfHeader === "string" ? csrfHeader : undefined,
  );
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

async function rejectionAudit(
  store: ProgrammingPersistence,
  principal: SessionContext | undefined,
  stationId: string,
  kind: string,
  id: string | undefined,
): Promise<void> {
  try {
    await store.auditRejection?.(principal?.userId, stationId, kind, id);
  } catch {
    // Auditing must not expose a storage error or replace the safe request result.
  }
}

function safeError(error: unknown): { status: number; error: string } {
  const message = error instanceof Error ? error.message : "internal_error";
  if (message === "unauthenticated") return { status: 401, error: message };
  if (message === "forbidden") return { status: 403, error: message };
  if (message === "station_forbidden" || message === "not_found")
    return { status: 404, error: "not_found" };
  if (message === "csrf_rejected") return { status: 403, error: message };
  if (message === "station_reference_forbidden")
    return { status: 422, error: message };
  if (message === "invalid_json")
    return { status: 400, error: "invalid_request" };
  if (
    message === "validation_error" ||
    message === "immutable_field" ||
    message.startsWith("invalid_")
  )
    return { status: 422, error: "validation_error" };
  return { status: 500, error: "internal_error" };
}

function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let value = "";
    request.on("data", (chunk) => {
      value += String(chunk);
      if (value.length > 1_000_000) reject(new Error("invalid_json"));
    });
    request.on("end", () => {
      try {
        const parsed: unknown = value ? JSON.parse(value) : {};
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new Error("invalid_json");
        resolve(parsed as Record<string, unknown>);
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    request.on("error", () => reject(new Error("invalid_json")));
  });
}

function json(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}
