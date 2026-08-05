import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { M4CatalogCandidate } from "../src/app/m4-catalog-eligibility-boundary.js";
import {
  M4SeparationPolicyBoundary,
  type M4CandidateSeparationKeys,
  type M4SeparationPolicy,
} from "../src/app/m4-separation-policy-boundary.js";

const candidate = (
  id: string,
  stationId = "station:0001",
): M4CatalogCandidate => ({
  id,
  stationId,
  assetId: `asset:${id}`,
  assetRevisionId: `revision:${id}`,
  revision: 1,
  eligibility: "ready_for_schedule_use",
});

const keys = (
  candidateId: string,
  stationId = "station:0001",
  values: M4CandidateSeparationKeys["keys"] = {},
): M4CandidateSeparationKeys => ({ candidateId, stationId, keys: values });

const policy = (
  id: string,
  scope: M4SeparationPolicy["scope"],
  precedence: number,
): M4SeparationPolicy => ({
  id,
  stationId: "station:0001",
  scope,
  minimumCandidateDistance: 2,
  precedence,
  status: "approved",
});

test("M4.4 detects deterministic policy conflicts using approved opaque inputs", () => {
  const current = candidate("catalog:0001");
  const previous = candidate("catalog:0002");
  const boundary = new M4SeparationPolicyBoundary({
    candidates: [current, previous],
    separationKeys: [
      keys(current.id, current.stationId, { artist: "key:artist-a" }),
      keys(previous.id, previous.stationId, { artist: "key:artist-a" }),
    ],
    policies: [policy("policy:0001", "artist", 1)],
  });

  assert.deepEqual(
    boundary.evaluate(current.stationId, current.id, [previous.id]),
    {
      outcome: "conflict",
      evidence: {
        action: "m4.separation_evaluated",
        stationId: "station:0001",
        candidateId: "catalog:0001",
        outcome: "conflict",
        category: "separation_conflict",
        policyId: "policy:0001",
      },
      execution: "unavailable",
    },
  );
});

test("M4.4 uses precedence, rejects missing keys safely, and reports empty catalog", () => {
  const current = candidate("catalog:0001");
  const previous = candidate("catalog:0002");
  const boundary = new M4SeparationPolicyBoundary({
    candidates: [current, previous],
    separationKeys: [
      keys(current.id, current.stationId, {
        artist: "key:artist-a",
        title: "key:title-a",
      }),
      keys(previous.id, previous.stationId, {
        artist: "key:artist-a",
        title: "key:title-a",
      }),
    ],
    policies: [
      policy("policy:0002", "title", 2),
      policy("policy:0001", "artist", 1),
    ],
  });
  const conflict = boundary.evaluate(current.stationId, current.id, [
    previous.id,
  ]);
  assert.equal(conflict.evidence.policyId, "policy:0001");

  const missingKey = new M4SeparationPolicyBoundary({
    candidates: [current],
    separationKeys: [keys(current.id)],
    policies: [policy("policy:0003", "album", 1)],
  }).evaluate(current.stationId, current.id, []);
  assert.equal(missingKey.outcome, "indeterminate");
  assert.equal(missingKey.evidence.category, "separation_key_unavailable");

  assert.deepEqual(
    new M4SeparationPolicyBoundary({
      candidates: [],
      separationKeys: [],
      policies: [],
    }).evaluate("station:0001", undefined, []),
    {
      outcome: "catalog_empty",
      evidence: {
        action: "m4.separation_evaluated",
        stationId: "station:0001",
        outcome: "catalog_empty",
        category: "catalog_empty",
      },
      execution: "unavailable",
    },
  );
});

test("M4.4 preserves station isolation and content-free evidence", () => {
  const owned = candidate("catalog:0001");
  const other = candidate("catalog:0002", "station:0002");
  const ownedPolicy = policy("policy:0001", "artist", 1);
  const boundary = new M4SeparationPolicyBoundary({
    candidates: [owned, other],
    separationKeys: [keys(owned.id), keys(other.id, other.stationId)],
    policies: [ownedPolicy],
  });
  assert.throws(
    () => boundary.evaluate(owned.stationId, other.id, []),
    /not_found/,
  );
  assert.throws(
    () => boundary.assertCandidateOwnership(other.stationId, owned),
    /station_reference_forbidden/,
  );
  assert.throws(
    () => boundary.assertPolicyOwnership(other.stationId, ownedPolicy),
    /station_reference_forbidden/,
  );
  assert.doesNotMatch(
    JSON.stringify(boundary.evaluate(owned.stationId, owned.id, [])),
    /title|artist|filename|path|metadata|token|credential|sql/i,
  );
});

test("M4.4 has no operational adapter or external import", async () => {
  const source = await readFile(
    new URL("../src/app/m4-separation-policy-boundary.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /^import .*?(node:|postgres|sqlite|child_process|worker|ffmpeg|icecast)/m,
  );
  assert.doesNotMatch(source, /fetch\(|http\.request|https\.request/);
});
