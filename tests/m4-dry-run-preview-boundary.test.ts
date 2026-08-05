import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { M4CatalogCandidate } from "../src/app/m4-catalog-eligibility-boundary.js";
import {
  M4ClockTemplateBoundary,
  type M4ClockTemplate,
} from "../src/app/m4-clock-template-boundary.js";
import { M4DryRunPreviewBoundary } from "../src/app/m4-dry-run-preview-boundary.js";
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

const template = (id: string, stationId = "station:0001"): M4ClockTemplate => ({
  id,
  stationId,
  timezone: "UTC",
  revision: 1,
  slots: [
    { id: "slot:0001", localStartMinute: 0, durationMinutes: 720 },
    { id: "slot:0002", localStartMinute: 720, durationMinutes: 720 },
  ],
});

const policy = (): M4SeparationPolicy => ({
  id: "policy:0001",
  stationId: "station:0001",
  scope: "artist",
  minimumCandidateDistance: 1,
  precedence: 0,
  status: "approved",
});

const keys = (
  candidateId: string,
  value: string,
): M4CandidateSeparationKeys => ({
  candidateId,
  stationId: "station:0001",
  keys: { artist: value },
});

function boundary(input: {
  candidates: readonly M4CatalogCandidate[];
  separationKeys: readonly M4CandidateSeparationKeys[];
  policies?: readonly M4SeparationPolicy[];
  templates?: readonly M4ClockTemplate[];
}): M4DryRunPreviewBoundary {
  const templates = input.templates ?? [template("template:0001")];
  const clock = new M4ClockTemplateBoundary(templates);
  const dayInputs = templates.map((item) =>
    clock.prepareDayInput(item.stationId, item.id, "2026-08-05"),
  );
  return new M4DryRunPreviewBoundary({
    dayInputs,
    candidates: input.candidates,
    separation: new M4SeparationPolicyBoundary({
      candidates: input.candidates,
      separationKeys: input.separationKeys,
      policies: input.policies ?? [],
    }),
  });
}

test("M4.5 creates a deterministic complete opaque dry-run preview", () => {
  const first = candidate("catalog:0001");
  const second = candidate("catalog:0002");
  const previews = boundary({
    candidates: [second, first],
    separationKeys: [keys(first.id, "key:0001"), keys(second.id, "key:0002")],
    policies: [policy()],
  });

  const one = previews.generate(
    "station:0001",
    "civil-day:template:0001:2026-08-05",
    "request:0001",
  );
  const two = previews.generate(
    "station:0001",
    "civil-day:template:0001:2026-08-05",
    "request:0001",
  );

  assert.deepEqual(one, two);
  assert.deepEqual(one.assignments, [
    { slotId: "slot:0001", candidateId: "catalog:0001" },
    { slotId: "slot:0002", candidateId: "catalog:0002" },
  ]);
  assert.equal(one.status, "complete");
  assert.equal(one.conflicts.length, 1);
  assert.equal(one.evidence.category, "preview_complete");
  assert.equal(one.execution, "unavailable");
  assert.equal(Object.isFrozen(one), true);
  assert.equal(Object.isFrozen(one.assignments), true);
});

test("M4.5 stops incomplete planning without retaining partial replacement assignments", () => {
  const only = candidate("catalog:0001");
  const previews = boundary({
    candidates: [only],
    separationKeys: [keys(only.id, "key:0001")],
    policies: [policy()],
  });
  const preview = previews.generate(
    "station:0001",
    "civil-day:template:0001:2026-08-05",
    "request:0001",
  );

  assert.equal(preview.status, "incomplete");
  assert.deepEqual(preview.assignments, []);
  assert.deepEqual(preview.conflicts, [
    {
      slotId: "slot:0002",
      candidateId: "catalog:0001",
      outcome: "conflict",
      category: "separation_conflict",
      policyId: "policy:0001",
    },
  ]);
  assert.equal(preview.evidence.assignmentCount, 0);
  assert.equal(preview.evidence.category, "preview_incomplete");
});

test("M4.5 reports empty and indeterminate inputs with controlled conflict evidence", () => {
  const empty = boundary({ candidates: [], separationKeys: [] }).generate(
    "station:0001",
    "civil-day:template:0001:2026-08-05",
    "request:0001",
  );
  assert.equal(empty.status, "incomplete");
  assert.deepEqual(empty.conflicts, [
    { outcome: "catalog_empty", category: "catalog_empty" },
  ]);

  const current = candidate("catalog:0001");
  const indeterminate = boundary({
    candidates: [current],
    separationKeys: [
      { candidateId: current.id, stationId: current.stationId, keys: {} },
    ],
    policies: [policy()],
  }).generate(
    "station:0001",
    "civil-day:template:0001:2026-08-05",
    "request:0001",
  );
  assert.equal(indeterminate.status, "incomplete");
  assert.equal(indeterminate.conflicts[0]?.outcome, "indeterminate");
  assert.equal(
    indeterminate.conflicts[0]?.category,
    "separation_key_unavailable",
  );
});

test("M4.5 preserves station isolation and content-free preview evidence", () => {
  const owned = candidate("catalog:0001");
  const other = candidate("catalog:0002", "station:0002");
  const ownedTemplate = template("template:0001");
  const otherTemplate = template("template:0002", "station:0002");
  const previews = boundary({
    candidates: [owned, other],
    separationKeys: [keys(owned.id, "key:0001")],
    templates: [ownedTemplate, otherTemplate],
  });
  assert.throws(
    () =>
      previews.generate(
        "station:0001",
        "civil-day:template:0002:2026-08-05",
        "request:0001",
      ),
    /not_found/,
  );
  assert.throws(
    () => previews.assertCandidateOwnership("station:0002", owned),
    /station_reference_forbidden/,
  );
  const ownedDay = new M4ClockTemplateBoundary([ownedTemplate]).prepareDayInput(
    "station:0001",
    "template:0001",
    "2026-08-05",
  );
  assert.throws(
    () => previews.assertDayInputOwnership("station:0002", ownedDay),
    /station_reference_forbidden/,
  );
  assert.doesNotMatch(
    JSON.stringify(
      previews.generate(
        "station:0001",
        "civil-day:template:0001:2026-08-05",
        "request:0001",
      ),
    ),
    /title|artist|filename|path|metadata|token|credential|sql/i,
  );
});

test("M4.5 imports no operational adapter or external dependency", async () => {
  const source = await readFile(
    new URL("../src/app/m4-dry-run-preview-boundary.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /^import .*?(node:|postgres|sqlite|child_process|worker|ffmpeg|icecast)/m,
  );
  assert.doesNotMatch(source, /fetch\(|http\.request|https\.request/);
});
