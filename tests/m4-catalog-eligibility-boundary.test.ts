import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { M4CatalogEligibilityBoundary } from "../src/app/m4-catalog-eligibility-boundary.js";
import type { AssetRecord, AssetRevision } from "../src/domain/m3-assets.js";

const asset = (
  id: string,
  stationId: string,
  lifecycleState: AssetRecord["lifecycleState"] = "ready_for_schedule_use",
): AssetRecord => ({
  id,
  stationId,
  lifecycleState,
  createdAt: "2026-08-05T00:00:00.000Z",
  updatedAt: "2026-08-05T00:00:00.000Z",
});

const revision = (
  id: string,
  stationId: string,
  assetId: string,
): AssetRevision => ({
  id,
  stationId,
  assetId,
  revision: 1,
  source: {
    kind: "operator_staged_reference",
    opaqueId: `source:${id}`,
  },
  provenanceReference: `provenance:${id}`,
  createdAt: "2026-08-05T00:00:00.000Z",
});

test("M4.2 accepts only ready same-station immutable asset revisions", () => {
  const ready = asset("asset:0001", "station:0001");
  const readyRevision = revision("revision:0001", ready.stationId, ready.id);
  const boundary = new M4CatalogEligibilityBoundary([
    { asset: ready, revision: readyRevision },
  ]);

  const result = boundary.evaluate(ready.stationId, ready.id, readyRevision.id);
  assert.deepEqual(result, {
    candidate: {
      id: "catalog:revision:0001",
      stationId: "station:0001",
      assetId: "asset:0001",
      assetRevisionId: "revision:0001",
      revision: 1,
      eligibility: "ready_for_schedule_use",
    },
    evidence: {
      action: "m4.catalog_eligibility_evaluated",
      stationId: "station:0001",
      assetId: "asset:0001",
      assetRevisionId: "revision:0001",
      outcome: "eligible",
      category: "ready_for_schedule_use",
    },
    execution: "unavailable",
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.candidate), true);
  ready.lifecycleState = "superseded";
  assert.equal(
    boundary.evaluate(ready.stationId, ready.id, readyRevision.id).evidence
      .outcome,
    "eligible",
  );
});

test("M4.2 rejects ineligible and superseded assets with content-free evidence", () => {
  const pending = asset("asset:0002", "station:0001", "metadata_pending");
  const superseded = asset("asset:0003", "station:0001", "superseded");
  const pendingRevision = revision(
    "revision:0002",
    pending.stationId,
    pending.id,
  );
  const supersededRevision = revision(
    "revision:0003",
    superseded.stationId,
    superseded.id,
  );
  const boundary = new M4CatalogEligibilityBoundary([
    { asset: pending, revision: pendingRevision },
    { asset: superseded, revision: supersededRevision },
  ]);

  const pendingResult = boundary.evaluate(
    pending.stationId,
    pending.id,
    pendingRevision.id,
  );
  const supersededResult = boundary.evaluate(
    superseded.stationId,
    superseded.id,
    supersededRevision.id,
  );
  assert.equal(pendingResult.candidate, undefined);
  assert.equal(pendingResult.evidence.category, "asset_not_schedule_eligible");
  assert.equal(supersededResult.candidate, undefined);
  assert.equal(supersededResult.evidence.category, "asset_superseded");
  assert.doesNotMatch(
    JSON.stringify([pendingResult, supersededResult]),
    /title|artist|filename|path|metadata|token|credential|sql/i,
  );
});

test("M4.2 hides other-station resources and rejects trusted cross-station references", () => {
  const owned = asset("asset:0001", "station:0001");
  const ownedRevision = revision("revision:0001", owned.stationId, owned.id);
  const other = asset("asset:0002", "station:0002");
  const otherRevision = revision("revision:0002", other.stationId, other.id);
  const boundary = new M4CatalogEligibilityBoundary([
    { asset: owned, revision: ownedRevision },
    { asset: other, revision: otherRevision },
  ]);
  const candidate = boundary.evaluate(
    owned.stationId,
    owned.id,
    ownedRevision.id,
  ).candidate;
  assert.ok(candidate);
  assert.throws(
    () => boundary.evaluate(owned.stationId, other.id, otherRevision.id),
    /not_found/,
  );
  assert.throws(
    () => boundary.assertCandidateOwnership(other.stationId, candidate),
    /station_reference_forbidden/,
  );
  assert.throws(
    () =>
      new M4CatalogEligibilityBoundary([
        { asset: owned, revision: otherRevision },
      ]),
    /station_reference_forbidden/,
  );
});

test("M4.2 has no operational adapter or filesystem, network, or runtime import", async () => {
  const source = await readFile(
    new URL("../src/app/m4-catalog-eligibility-boundary.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /^import .*?(node:|postgres|sqlite|child_process|worker|ffmpeg|icecast)/m,
  );
  assert.doesNotMatch(source, /fetch\(|http\.request|https\.request/);
});
