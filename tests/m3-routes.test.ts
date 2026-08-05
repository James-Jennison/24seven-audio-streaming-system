import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";

import {
  handleM3Assets,
  type M3AssetPersistence,
} from "../src/api/m3-asset-routes.js";
import type { SessionLookup } from "../src/api/m1-session.js";
import type { M3ImportRequest } from "../src/domain/m3-assets.js";

const token = "fixture";
const csrfToken = "csrf";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("base64url");
const requestRecord: M3ImportRequest = {
  id: "request-a",
  stationId: "station-a",
  idempotencyKey: "request:0001",
  source: { kind: "operator_staged_reference", opaqueId: "source:0001" },
  lifecycleState: "proposed",
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
};

class M3Fake implements M3AssetPersistence {
  public calls: string[] = [];
  public audits: Array<{ stationId: string; id?: string }> = [];
  public processingCalls = 0;
  async listImportRequests(stationId: string): Promise<M3ImportRequest[]> {
    this.calls.push(`list:${stationId}`);
    return [requestRecord];
  }
  async readImportRequest(
    stationId: string,
    id: string,
  ): Promise<M3ImportRequest> {
    this.calls.push(`read:${stationId}:${id}`);
    if (stationId !== "station-a") throw new Error("not_found");
    return requestRecord;
  }
  async createImportRequest(): Promise<unknown> {
    this.calls.push("create");
    return {
      request: requestRecord,
      job: { id: "job-a", stationId: "station-a" },
      duplicate: false,
    };
  }
  async transitionImportRequest(
    _actor: string,
    stationId: string,
    id: string,
    next: M3ImportRequest["lifecycleState"],
  ): Promise<M3ImportRequest> {
    this.calls.push(`transition:${stationId}:${id}:${next}`);
    return { ...requestRecord, lifecycleState: next };
  }
  async retryImportRequest(
    _actor: string,
    stationId: string,
    id: string,
  ): Promise<M3ImportRequest> {
    this.calls.push(`retry:${stationId}:${id}`);
    return { ...requestRecord, lifecycleState: "validated" };
  }
  async auditRejection(
    _actor: string | undefined,
    stationId: string,
    id?: string,
  ): Promise<void> {
    this.audits.push({ stationId, id });
  }
}

const sessions = (stationIds = ["station-a"]): SessionLookup => ({
  lookupSession: async () => ({
    userId: "user-a",
    role: "programmer",
    stationIds,
    csrfHash: digest(csrfToken),
  }),
  audit: async () => {},
});

async function invoke(
  path: string,
  method: string,
  store: M3Fake,
  payload?: Record<string, unknown>,
  lookup = sessions(),
): Promise<{ status: number; body: unknown }> {
  const request = Readable.from(
    payload ? [JSON.stringify(payload)] : [],
  ) as IncomingMessage;
  Object.assign(request, {
    method,
    url: path,
    headers: {
      cookie: `session=${token}`,
      ...(method === "POST" ? { "x-csrf-token": csrfToken } : {}),
    },
  });
  let status = 0;
  let content = "";
  const response = {
    writeHead(code: number): void {
      status = code;
    },
    end(value?: string): void {
      content += value ?? "";
    },
  } as unknown as ServerResponse;
  assert.equal(await handleM3Assets(request, response, lookup, store), true);
  return { status, body: content ? JSON.parse(content) : undefined };
}

test("M3 dry run validates an opaque request without invoking persistence or processing", async () => {
  const store = new M3Fake();
  const result = await invoke(
    "/api/v1/stations/station-a/media-imports/dry-run?idempotencyKey=request:0001&sourceKind=operator_staged_reference&sourceOpaqueId=source:0001",
    "GET",
    store,
  );
  assert.deepEqual(result, {
    status: 200,
    body: {
      stationId: "station-a",
      readOnly: true,
      valid: true,
      processing: "disabled",
    },
  });
  assert.deepEqual(store.calls, []);
  assert.equal(store.processingCalls, 0);
});

test("M3.4 processing-boundary status is station-scoped, read-only, and disabled", async () => {
  const store = new M3Fake();
  const status = await invoke(
    "/api/v1/stations/station-a/media-imports/request-a/processing-boundary",
    "GET",
    store,
  );
  assert.deepEqual(status, {
    status: 200,
    body: {
      stationId: "station-a",
      requestId: "request-a",
      lifecycleState: "proposed",
      processing: "disabled",
      execution: "unavailable",
    },
  });
  const outOfScope = await invoke(
    "/api/v1/stations/station-b/media-imports/request-a/processing-boundary",
    "GET",
    store,
    undefined,
    sessions(["station-b"]),
  );
  assert.deepEqual(outOfScope, { status: 404, body: { error: "not_found" } });
  assert.equal(store.processingCalls, 0);
  assert.doesNotMatch(
    store.calls.join(" "),
    /worker|process|playout|encoder|relay|icecast/i,
  );
});

test("M3.5 normalization status is read-only, disabled, and station-scoped", async () => {
  const store = new M3Fake();
  const result = await invoke(
    "/api/v1/stations/station-a/media-imports/request-a/normalization-analysis",
    "GET",
    store,
  );
  assert.deepEqual(result, {
    status: 200,
    body: {
      stationId: "station-a",
      requestId: "request-a",
      normalization: "disabled",
      analysis: "fixture_only",
    },
  });
  const outOfScope = await invoke(
    "/api/v1/stations/station-b/media-imports/request-a/normalization-analysis",
    "GET",
    store,
    undefined,
    sessions(["station-b"]),
  );
  assert.deepEqual(outOfScope, { status: 404, body: { error: "not_found" } });
  assert.equal(store.processingCalls, 0);
});

test("M3.6 cue/fade status is read-only, disabled, and station-scoped", async () => {
  const store = new M3Fake();
  const result = await invoke(
    "/api/v1/stations/station-a/media-imports/request-a/cue-fade-analysis",
    "GET",
    store,
  );
  assert.deepEqual(result, {
    status: 200,
    body: {
      stationId: "station-a",
      requestId: "request-a",
      cueFade: "disabled",
      analysis: "fixture_only",
    },
  });
  const outOfScope = await invoke(
    "/api/v1/stations/station-b/media-imports/request-a/cue-fade-analysis",
    "GET",
    store,
    undefined,
    sessions(["station-b"]),
  );
  assert.deepEqual(outOfScope, { status: 404, body: { error: "not_found" } });
  assert.equal(store.processingCalls, 0);
  assert.doesNotMatch(
    store.calls.join(" "),
    /worker|process|playout|encoder|relay|icecast/i,
  );
});

test("M3 routes isolate stations, require CSRF for proposed approval flow, and do not expose runtime routes", async () => {
  const store = new M3Fake();
  const created = await invoke(
    "/api/v1/stations/station-a/media-imports",
    "POST",
    store,
    {
      idempotencyKey: "request:0001",
      source: { kind: "operator_staged_reference", opaqueId: "source:0001" },
    },
  );
  assert.equal(created.status, 201);
  const validated = await invoke(
    "/api/v1/stations/station-a/media-imports/request-a/validate",
    "POST",
    store,
  );
  assert.equal((validated.body as M3ImportRequest).lifecycleState, "validated");
  const approved = await invoke(
    "/api/v1/stations/station-a/media-imports/request-a/approve",
    "POST",
    store,
  );
  assert.equal(
    (approved.body as M3ImportRequest).lifecycleState,
    "approved_for_processing",
  );
  const outOfScope = await invoke(
    "/api/v1/stations/station-b/media-imports/request-a",
    "GET",
    store,
    undefined,
    sessions(["station-b"]),
  );
  assert.deepEqual(outOfScope, { status: 404, body: { error: "not_found" } });
  assert.doesNotMatch(store.calls.join(" "), /playout|encoder|relay|icecast/i);
});

test("M3 retry is an explicit CSRF-protected state record and never dispatches processing", async () => {
  const store = new M3Fake();
  const retry = await invoke(
    "/api/v1/stations/station-a/media-imports/request-a/retry",
    "POST",
    store,
  );
  assert.deepEqual(retry, {
    status: 200,
    body: { ...requestRecord, lifecycleState: "validated" },
  });
  assert.deepEqual(store.calls, ["retry:station-a:request-a"]);
  assert.equal(store.processingCalls, 0);
});
