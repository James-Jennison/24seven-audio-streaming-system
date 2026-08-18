import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  M5_RUNTIME_AUTHORITY_MATRIX,
  M5_RUNTIME_OBSERVATION_CONTRACT,
  M5RuntimeAuthorityBoundary,
  validateM5RuntimeUnavailableObservation,
  type M5RuntimeUnavailableObservation,
} from "../src/app/m5-runtime-authority-boundary.js";

const stationId = "station:m501";

function observation(
  overrides: Partial<M5RuntimeUnavailableObservation> = {},
): M5RuntimeUnavailableObservation {
  return {
    id: "runtime-observation:m501",
    stationId,
    contract: M5_RUNTIME_OBSERVATION_CONTRACT,
    runtimeInstanceId: "runtime:m501",
    observedAt: "2026-08-05T20:00:00.000Z",
    sequence: 0,
    availability: "unavailable",
    status: "safe_stop",
    ...overrides,
  };
}

test("M5.1 fixes one-way writer authority and permits only a safe unavailable observation", () => {
  assert.deepEqual(M5_RUNTIME_AUTHORITY_MATRIX, [
    {
      plane: "programming_control_plane",
      programmingState: "write",
      runtimeObservation: "read_only",
      outputControl: "none",
    },
    {
      plane: "playout_automation_runtime",
      programmingState: "read_only",
      runtimeObservation: "write",
      outputControl: "none",
    },
    {
      plane: "source_encoder_layer",
      programmingState: "none",
      runtimeObservation: "read_only",
      outputControl: "none",
    },
    {
      plane: "listener_facing_icecast_layer",
      programmingState: "none",
      runtimeObservation: "read_only",
      outputControl: "none",
    },
  ]);
  assert.equal(Object.isFrozen(M5_RUNTIME_AUTHORITY_MATRIX), true);
  assert.equal(Object.isFrozen(M5_RUNTIME_AUTHORITY_MATRIX[0]), true);
  assert.doesNotThrow(() =>
    validateM5RuntimeUnavailableObservation(observation()),
  );
  assert.throws(
    () =>
      validateM5RuntimeUnavailableObservation(
        observation({ availability: "available" as "unavailable" }),
      ),
    /invalid_runtime_unavailable_observation/,
  );
  assert.throws(
    () =>
      validateM5RuntimeUnavailableObservation(
        observation({ status: "playing" as "safe_stop" }),
      ),
    /invalid_runtime_unavailable_observation/,
  );
});

test("M5.1 exposes only a station-scoped content-free unavailable status", () => {
  const owned = observation();
  const other = observation({
    id: "runtime-observation:m502",
    stationId: "station:m502",
    runtimeInstanceId: "runtime:m502",
  });
  const boundary = new M5RuntimeAuthorityBoundary([owned, other]);
  const status = boundary.unavailableStatus(stationId, owned.id);
  assert.deepEqual(status, {
    id: `runtime-status:${owned.id}`,
    stationId,
    observationId: owned.id,
    availability: "unavailable",
    status: "safe_stop",
  });
  assert.equal(Object.isFrozen(status), true);
  assert.throws(
    () => boundary.unavailableStatus(stationId, other.id),
    /not_found/,
  );
  assert.throws(
    () => boundary.assertObservationOwnership(stationId, other),
    /station_reference_forbidden/,
  );
  assert.doesNotMatch(
    JSON.stringify({ observation: owned, status }),
    /title|artist|filename|path|payload|metadata|credential|token|csrf|sql/i,
  );
});

test("M5.1 has no process, persistence, network, or downstream adapter", async () => {
  const source = await readFile(
    new URL("../src/app/m5-runtime-authority-boundary.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /^import .*?(node:|postgres|sqlite|child_process|worker|ffmpeg|icecast)/m,
  );
  assert.doesNotMatch(
    source,
    /(?:spawn|exec|fetch|connect|listen|dispatch)\s*\(/,
  );
});
