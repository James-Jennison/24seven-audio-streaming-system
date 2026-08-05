import type { IncomingMessage, ServerResponse } from "node:http";

import { assertAuthorized } from "../app/authorization.js";
import type { ApplicationRole } from "../domain/programming.js";
import {
  validateImportRequestInput,
  type AssetLifecycleState,
  type M3ImportRequest,
} from "../domain/m3-assets.js";
import {
  authenticate,
  csrf,
  type SessionContext,
  type SessionLookup,
} from "./m1-session.js";

export interface M3AssetPersistence {
  listImportRequests(stationId: string): Promise<M3ImportRequest[]>;
  readImportRequest(stationId: string, id: string): Promise<M3ImportRequest>;
  createImportRequest(
    actor: string,
    stationId: string,
    input: {
      idempotencyKey: string;
      source: {
        kind: "operator_staged_reference" | "managed_source_reference";
        opaqueId: string;
      };
    },
  ): Promise<unknown>;
  transitionImportRequest(
    actor: string,
    stationId: string,
    id: string,
    next: AssetLifecycleState,
  ): Promise<M3ImportRequest>;
  retryImportRequest(
    actor: string,
    stationId: string,
    id: string,
  ): Promise<M3ImportRequest>;
  auditRejection?(
    actor: string | undefined,
    stationId: string,
    id?: string,
  ): Promise<void>;
}

export async function handleM3Assets(
  request: IncomingMessage,
  response: ServerResponse,
  sessions: SessionLookup,
  store: M3AssetPersistence,
): Promise<boolean> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const dryRun = url.pathname.match(
    /^\/api\/v1\/stations\/([^/]+)\/media-imports\/dry-run$/,
  );
  if (dryRun) {
    if (request.method !== "GET") return method(response);
    let principal: SessionContext | undefined;
    try {
      principal = await authenticate(sessions, request.headers.cookie);
      authorize(principal, dryRun[1]!, "read");
      validateImportRequestInput({
        idempotencyKey: url.searchParams.get("idempotencyKey") ?? "",
        source: {
          kind: (url.searchParams.get("sourceKind") ?? "") as
            | "operator_staged_reference"
            | "managed_source_reference",
          opaqueId: url.searchParams.get("sourceOpaqueId") ?? "",
        },
      });
      json(response, 200, {
        stationId: dryRun[1],
        readOnly: true,
        valid: true,
        processing: "disabled",
      });
    } catch (error) {
      await rejectionAudit(store, principal, dryRun[1]!, undefined);
      const safe = safeError(error);
      json(response, safe.status, { error: safe.error });
    }
    return true;
  }
  const match = url.pathname.match(
    /^\/api\/v1\/stations\/([^/]+)\/media-imports(?:\/([^/]+)(?:\/(validate|approve|reject|retry))?)?$/,
  );
  if (!match) return false;
  const [, stationId, id, action] = match;
  let principal: SessionContext | undefined;
  try {
    principal = await authenticate(sessions, request.headers.cookie);
    if (request.method === "GET") {
      authorize(principal, stationId!, "read");
      json(
        response,
        200,
        id
          ? await store.readImportRequest(stationId!, id)
          : { items: await store.listImportRequests(stationId!) },
      );
      return true;
    }
    if (request.method !== "POST") return method(response);
    await authorizeMutation(request, sessions, principal, stationId!);
    if (!id && !action) {
      const input = importInput(await body(request));
      json(
        response,
        201,
        await store.createImportRequest(principal.userId, stationId!, input),
      );
      return true;
    }
    if (id && action === "retry") {
      json(
        response,
        200,
        await store.retryImportRequest(principal.userId, stationId!, id),
      );
      return true;
    }
    const states: Record<string, AssetLifecycleState> = {
      validate: "validated",
      approve: "approved_for_processing",
      reject: "rejected",
    };
    if (!id || !action || !states[action]) return method(response);
    json(
      response,
      200,
      await store.transitionImportRequest(
        principal.userId,
        stationId!,
        id,
        states[action],
      ),
    );
    return true;
  } catch (error) {
    await rejectionAudit(store, principal, stationId!, id);
    const safe = safeError(error);
    json(response, safe.status, { error: safe.error });
    return true;
  }
}

function importInput(bodyValue: Record<string, unknown>): {
  idempotencyKey: string;
  source: {
    kind: "operator_staged_reference" | "managed_source_reference";
    opaqueId: string;
  };
} {
  const source = bodyValue.source;
  if (
    typeof bodyValue.idempotencyKey !== "string" ||
    !source ||
    typeof source !== "object" ||
    Array.isArray(source) ||
    typeof (source as Record<string, unknown>).kind !== "string" ||
    typeof (source as Record<string, unknown>).opaqueId !== "string"
  )
    throw new Error("validation_error");
  const input = {
    idempotencyKey: bodyValue.idempotencyKey,
    source: {
      kind: (source as Record<string, unknown>).kind as
        | "operator_staged_reference"
        | "managed_source_reference",
      opaqueId: (source as Record<string, unknown>).opaqueId as string,
    },
  };
  validateImportRequestInput(input);
  return input;
}

async function authorizeMutation(
  request: IncomingMessage,
  sessions: SessionLookup,
  principal: SessionContext,
  stationId: string,
): Promise<void> {
  authorize(principal, stationId, "program");
  const header = request.headers["x-csrf-token"];
  await csrf(
    sessions,
    request.headers.cookie,
    typeof header === "string" ? header : undefined,
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
  store: M3AssetPersistence,
  principal: SessionContext | undefined,
  stationId: string,
  id: string | undefined,
): Promise<void> {
  try {
    await store.auditRejection?.(principal?.userId, stationId, id);
  } catch {
    // A safe request result must not be replaced by an audit failure.
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
    message === "invalid_lifecycle_transition" ||
    message === "recovery_not_eligible" ||
    message === "idempotency_conflict" ||
    message.startsWith("invalid_") ||
    message === "validation_error"
  )
    return { status: 422, error: "validation_error" };
  return { status: 500, error: "internal_error" };
}

function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let value = "";
    request.on("data", (chunk) => {
      value += String(chunk);
      if (value.length > 32_768) reject(new Error("invalid_json"));
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

function method(response: ServerResponse): true {
  json(response, 405, { error: "method_not_allowed" });
  return true;
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
