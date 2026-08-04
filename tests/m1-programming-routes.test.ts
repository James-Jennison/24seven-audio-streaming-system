import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";

import {
  handleProgramming,
  type ProgrammingPersistence,
} from "../src/api/m1-programming-routes.js";
import type { SessionLookup } from "../src/api/m1-session.js";
import type { MediaMetadata } from "../src/domain/programming.js";

const kinds = [
  "media",
  "playlists",
  "separation-rules",
  "rotations",
  "clocks",
  "program-blocks",
  "scheduled-events",
] as const;

const token = "fixture";
const csrfToken = "csrf";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

const media: MediaMetadata = {
  id: "media-a",
  stationId: "station-a",
  title: "Safe title",
  artist: "Safe artist",
  category: "category",
  genreTags: [],
  tags: [],
  sourceReference: "safe-reference",
  lifecycleState: "available",
  createdAt: "2026-08-03T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
};

interface Call {
  operation: string;
  kind: string;
  stationId: string;
  id?: string;
}

class ProgrammingFake implements ProgrammingPersistence {
  public readonly calls: Call[] = [];
  public readonly audits: Array<Pick<Call, "kind" | "stationId" | "id">> = [];
  public failure: Error | undefined;

  async list(kind: string, stationId: string): Promise<unknown[]> {
    this.calls.push({ operation: "list", kind, stationId });
    if (this.failure) throw this.failure;
    return kind === "media" ? [media] : [{ id: `${kind}-a`, stationId }];
  }

  async create(
    kind: string,
    _actor: string,
    stationId: string,
  ): Promise<unknown> {
    this.calls.push({ operation: "create", kind, stationId });
    if (this.failure) throw this.failure;
    return { id: `${kind}-created` };
  }

  async read(kind: string, stationId: string, id: string): Promise<unknown> {
    this.calls.push({ operation: "read", kind, stationId, id });
    if (this.failure) throw this.failure;
    return { id, stationId };
  }

  async delete(
    kind: string,
    _actor: string,
    stationId: string,
    id: string,
  ): Promise<void> {
    this.calls.push({ operation: "delete", kind, stationId, id });
    if (this.failure) throw this.failure;
  }

  async update(
    kind: string,
    _actor: string,
    stationId: string,
    id: string,
  ): Promise<unknown> {
    this.calls.push({ operation: "update", kind, stationId, id });
    if (this.failure) throw this.failure;
    return { id, stationId };
  }

  async auditRejection(
    _actor: string | undefined,
    stationId: string,
    kind: string,
    id?: string,
  ): Promise<void> {
    this.audits.push({ kind, stationId, id });
  }
}

function sessions(
  role = "programmer",
  stationIds = ["station-a"],
  available = true,
): SessionLookup {
  return {
    lookupSession: async () =>
      available
        ? {
            userId: "user-a",
            role,
            stationIds,
            csrfHash: digest(csrfToken),
          }
        : undefined,
    audit: async () => {},
  };
}

interface RouteResult {
  handled: boolean;
  status: number;
  body: unknown;
}

async function invoke(
  path: string,
  method: string,
  store: ProgrammingPersistence,
  lookup = sessions(),
  payload?: Record<string, unknown>,
  csrf = csrfToken,
  cookie = `session=${token}`,
): Promise<RouteResult> {
  const request = Readable.from(
    payload ? [JSON.stringify(payload)] : [],
  ) as IncomingMessage;
  Object.assign(request, {
    method,
    url: path,
    headers: {
      cookie,
      ...(method === "POST" || method === "PATCH" || method === "DELETE"
        ? { "x-csrf-token": csrf }
        : {}),
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
  const handled = await handleProgramming(request, response, lookup, store);
  return {
    handled,
    status,
    body: content ? (JSON.parse(content) as unknown) : undefined,
  };
}

test("all programming entity families route authenticated CRUD and CSRF-protected mutations", async () => {
  const store = new ProgrammingFake();
  for (const kind of kinds) {
    const base = `/api/v1/stations/station-a/${kind}`;
    assert.equal((await invoke(base, "GET", store)).status, 200);
    assert.equal((await invoke(`${base}/record-a`, "GET", store)).status, 200);
    assert.equal(
      (await invoke(base, "POST", store, sessions(), { name: "valid" })).status,
      201,
    );
    assert.equal(
      (
        await invoke(`${base}/record-a`, "PATCH", store, sessions(), {
          name: "valid",
        })
      ).status,
      200,
    );
    assert.equal(
      (await invoke(`${base}/record-a`, "DELETE", store)).status,
      204,
    );
  }
  assert.equal(store.calls.length, kinds.length * 5);
  assert.ok(store.calls.every((call) => call.stationId === "station-a"));
});

test("programming routes reject invalid sessions, CSRF, roles, and out-of-scope stations safely", async () => {
  const store = new ProgrammingFake();
  const path = "/api/v1/stations/station-a/media";
  assert.deepEqual(
    await invoke(
      path,
      "GET",
      store,
      sessions("programmer", ["station-a"], false),
    ),
    {
      handled: true,
      status: 401,
      body: { error: "unauthenticated" },
    },
  );
  const missing = await invoke(
    path,
    "GET",
    store,
    sessions(),
    undefined,
    csrfToken,
    "",
  );
  assert.equal(missing.status, 401);
  const malformed = await invoke(
    path,
    "GET",
    store,
    sessions(),
    undefined,
    csrfToken,
    "not-a-session",
  );
  assert.equal(malformed.status, 401);
  const expired = await invoke(
    path,
    "GET",
    store,
    sessions("programmer", ["station-a"], false),
  );
  assert.equal(expired.status, 401);
  const revoked = await invoke(
    path,
    "GET",
    store,
    sessions("programmer", ["station-a"], false),
  );
  assert.equal(revoked.status, 401);
  const badCsrf = await invoke(
    path,
    "POST",
    store,
    sessions(),
    { title: "ignored" },
    "wrong",
  );
  assert.equal(badCsrf.status, 403);
  assert.deepEqual(badCsrf.body, { error: "csrf_rejected" });
  assert.equal(store.audits.length, 6);
  const observerMutation = await invoke(
    path,
    "POST",
    store,
    sessions("observer"),
    { title: "ignored" },
  );
  assert.equal(observerMutation.status, 403);
  const outOfScope = await invoke(
    path,
    "GET",
    store,
    sessions("programmer", ["station-b"]),
  );
  assert.deepEqual(outOfScope.body, { error: "not_found" });
  assert.equal(outOfScope.status, 404);
  assert.doesNotMatch(
    JSON.stringify(store.audits),
    /ignored|station-b|fixture/,
  );
});

test("programming routes preserve safe not_found, validation, reference, and method errors", async () => {
  const store = new ProgrammingFake();
  store.failure = new Error("not_found");
  const missing = await invoke(
    "/api/v1/stations/station-a/playlists/record-a",
    "GET",
    store,
  );
  assert.deepEqual(missing, {
    handled: true,
    status: 404,
    body: { error: "not_found" },
  });
  store.failure = new Error("station_reference_forbidden");
  const crossStation = await invoke(
    "/api/v1/stations/station-a/rotations",
    "POST",
    store,
    sessions(),
    { name: "ignored" },
  );
  assert.deepEqual(crossStation.body, { error: "station_reference_forbidden" });
  assert.equal(crossStation.status, 422);
  store.failure = new Error("invalid_weight");
  const invalid = await invoke(
    "/api/v1/stations/station-a/rotations/record-a",
    "PATCH",
    store,
    sessions(),
    { name: "ignored" },
  );
  assert.deepEqual(invalid.body, { error: "validation_error" });
  assert.equal(invalid.status, 422);
  const method = await invoke("/api/v1/stations/station-a/media", "PUT", store);
  assert.deepEqual(method.body, { error: "method_not_allowed" });
  assert.equal(method.status, 405);
});

test("dry-run is station-scoped, deterministic, read-only, and validates separation input", async () => {
  const store = new ProgrammingFake();
  const path = "/api/v1/stations/station-a/dry-run?separationMinutes=30";
  const first = await invoke(path, "GET", store);
  const second = await invoke(path, "GET", store);
  assert.equal(first.status, 200);
  assert.deepEqual(first.body, second.body);
  assert.deepEqual(first.body, {
    stationId: "station-a",
    readOnly: true,
    separationMinutes: 30,
    plan: [
      {
        media,
        eligible: true,
        reasons: ["available for selected station"],
      },
    ],
  });
  assert.deepEqual(
    store.calls.map((call) => call.operation),
    ["list", "list"],
  );
  const invalid = await invoke(
    "/api/v1/stations/station-a/dry-run?separationMinutes=-1",
    "GET",
    store,
  );
  assert.deepEqual(invalid.body, { error: "validation_error" });
  assert.equal(invalid.status, 422);
});
