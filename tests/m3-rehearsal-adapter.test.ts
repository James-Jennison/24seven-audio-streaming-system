import assert from "node:assert/strict";
import test from "node:test";
import {
  M3_REHEARSAL_OPT_IN,
  M3RehearsalAdapter,
} from "../src/app/m3-rehearsal-adapter.js";

const request = (overrides = {}) => ({
  id: "rehearsal:1",
  stationId: "station:1",
  idempotencyKey: "key:1",
  actionId: "m3.12",
  fixtureReference: "fixture:opaque",
  activation: M3_REHEARSAL_OPT_IN,
  metadataMode: "deterministic_double" as const,
  ...overrides,
});

test("rehearsal adapter is explicit, idempotent, station-scoped, and content-free", () => {
  const adapter = new M3RehearsalAdapter();
  const result = adapter.run(request());
  assert.equal(result.outcome, "completed_deterministic_double");
  assert.strictEqual(adapter.run(request({ id: "rehearsal:other" })), result);
  assert.equal(adapter.read("station:1", "key:1"), result);
  assert.throws(() => adapter.read("station:2", "key:1"), /not_found/);
  assert.throws(
    () => adapter.assertSameStation("station:2", result),
    /station_reference_forbidden/,
  );
  assert.equal(JSON.stringify(result).includes("fixture"), false);
});

test("rehearsal adapter fails closed and labels unavailable and failed doubles", () => {
  const adapter = new M3RehearsalAdapter();
  assert.equal(
    adapter.run(request({ activation: "off" })).outcome,
    "unavailable",
  );
  assert.equal(
    adapter.run(
      request({ id: "r2", idempotencyKey: "k2", metadataMode: "failed" }),
    ).outcome,
    "quarantined",
  );
  assert.equal(
    adapter.run(
      request({ id: "r3", idempotencyKey: "k3", metadataMode: "unavailable" }),
    ).metadata,
    "unavailable",
  );
});
