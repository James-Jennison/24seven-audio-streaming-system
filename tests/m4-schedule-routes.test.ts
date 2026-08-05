import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";
import { handleM4Schedule } from "../src/api/m4-schedule-routes.js";

const digest = (value: string) =>
  createHash("sha256").update(value).digest("base64url");
async function call(
  path: string,
  method = "GET",
  role = "programmer",
  stations = ["station:0001"],
  csrf?: string,
) {
  const request = Readable.from([]) as IncomingMessage;
  Object.assign(request, {
    method,
    url: path,
    headers: {
      cookie: "session=fixture",
      ...(csrf ? { "x-csrf-token": csrf } : {}),
    },
  });
  let status = 0,
    text = "",
    audits = 0;
  const handled = await handleM4Schedule(
    request,
    {
      writeHead: (code: number) => {
        status = code;
      },
      end: (value?: string) => {
        text += value ?? "";
      },
    } as unknown as ServerResponse,
    {
      lookupSession: async () => ({
        userId: "user:0001",
        role,
        stationIds: stations,
        csrfHash: digest("csrf"),
      }),
      audit: async () => {},
    },
    {
      auditRejection: async () => {
        audits++;
      },
    },
  );
  return {
    handled,
    status,
    body: JSON.parse(text) as Record<string, unknown>,
    audits,
  };
}
test("M4.8 schedule visibility is station-scoped, content-free, and actions fail closed", async () => {
  const view = await call("/api/v1/stations/station:0001/schedule");
  assert.equal(view.status, 200);
  assert.equal(view.body.execution, "unavailable");
  assert.doesNotMatch(
    JSON.stringify(view.body),
    /title|artist|filename|path|metadata|token|csrf|sql/i,
  );
  assert.equal(
    (
      await call(
        "/api/v1/stations/station:0002/schedule",
        "GET",
        "programmer",
        ["station:0001"],
      )
    ).body.error,
    "not_found",
  );
  const action = await call(
    "/api/v1/stations/station:0001/schedule/publication",
    "POST",
    "programmer",
    ["station:0001"],
    "csrf",
  );
  assert.equal(action.status, 409);
  assert.equal(action.body.error, "operation_unavailable");
  assert.equal(action.audits, 1);
  assert.equal(
    (
      await call(
        "/api/v1/stations/station:0001/schedule/publication",
        "POST",
        "programmer",
        ["station:0001"],
      )
    ).body.error,
    "csrf_rejected",
  );
});
