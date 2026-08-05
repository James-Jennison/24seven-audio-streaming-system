import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  M3AcceptanceHandoffBoundary,
  validateM3AcceptanceHandoff,
  type M3AcceptanceHandoff,
} from "../src/app/m3-acceptance-handoff.js";
import { seededStations } from "../src/domain/stations.js";
import { renderDashboard } from "../src/ui/dashboard.js";

const forbiddenContent =
  /filename|path|url|title|artist|album|tag|payload|metadata|credential|token|csrf|raw sql/i;

const handoff = (
  overrides: Partial<M3AcceptanceHandoff> = {},
): M3AcceptanceHandoff => ({
  id: "handoff:m311a",
  stationId: "station:m311a",
  decision: "accepted_for_handoff",
  reviewMode: "local_evidence_only",
  operationalAuthority: "not_granted",
  acceptedMilestones: [
    "M3.1",
    "M3.2",
    "M3.3",
    "M3.4",
    "M3.5",
    "M3.6",
    "M3.7",
    "M3.8",
    "M3.9",
    "M3.10",
  ],
  evidence: [
    {
      id: "evidence:m311a",
      stationId: "station:m311a",
      category: "content_free_local_evidence",
      result: "passed",
    },
    {
      id: "evidence:m311b",
      stationId: "station:m311a",
      category: "station_isolation",
      result: "passed",
    },
    {
      id: "evidence:m311c",
      stationId: "station:m311a",
      category: "disabled_boundary",
      result: "passed",
    },
  ],
  assetReadiness: {
    state: "ready_for_schedule_use",
    schedule: "not_published",
    runtime: "unavailable",
    encoder: "unavailable",
    listener: "unavailable",
  },
  handoffs: {
    m4CatalogEligibility: "input_only",
    m5DesignInput: "input_only",
    m7Boundary: "input_only",
    newHumanApprovalRequired: true,
  },
  openRisks: [
    {
      id: "risk:m311a",
      stationId: "station:m311a",
      category: "later_milestone_approval_required",
      ownerReference: "owner:m311a",
      status: "open",
    },
    {
      id: "risk:m311b",
      stationId: "station:m311a",
      category: "operational_authority_not_granted",
      ownerReference: "owner:m311a",
      status: "open",
    },
  ],
  ...overrides,
});

test("M3.11 accepts only complete local M3 evidence and input-only handoffs", () => {
  assert.doesNotThrow(() => validateM3AcceptanceHandoff(handoff()));
  const incomplete = {
    ...handoff(),
    acceptedMilestones: ["M3.1"],
  } as unknown as M3AcceptanceHandoff;
  assert.throws(
    () => validateM3AcceptanceHandoff(incomplete),
    /incomplete_m3_acceptance/,
  );
  const operational = {
    ...handoff(),
    operationalAuthority: "granted",
  } as unknown as M3AcceptanceHandoff;
  assert.throws(
    () => validateM3AcceptanceHandoff(operational),
    /operational_authority_forbidden/,
  );
  const publication = {
    ...handoff(),
    assetReadiness: { ...handoff().assetReadiness, schedule: "published" },
  } as unknown as M3AcceptanceHandoff;
  assert.throws(
    () => validateM3AcceptanceHandoff(publication),
    /asset_readiness_execution_forbidden/,
  );
  const automaticHandoff = {
    ...handoff(),
    handoffs: { ...handoff().handoffs, newHumanApprovalRequired: false },
  } as unknown as M3AcceptanceHandoff;
  assert.throws(
    () => validateM3AcceptanceHandoff(automaticHandoff),
    /later_milestone_authority_forbidden/,
  );
});

test("M3.11 handoff review preserves station isolation, open-risk ownership, and fail-closed approval", () => {
  const owned = handoff();
  const other = handoff({
    id: "handoff:m311b",
    stationId: "station:m311b",
    evidence: handoff().evidence.map((evidence) => ({
      ...evidence,
      stationId: "station:m311b",
    })),
    openRisks: handoff().openRisks.map((risk) => ({
      ...risk,
      stationId: "station:m311b",
    })),
  });
  const boundary = new M3AcceptanceHandoffBoundary([owned, other]);
  const review = boundary.review(owned.stationId, owned.id);
  assert.deepEqual(review, {
    id: `review:${owned.id}`,
    stationId: owned.stationId,
    handoffId: owned.id,
    decision: "accepted_for_handoff",
    operationalAuthority: "not_granted",
    nextMilestone: "M4.1",
    nextMilestoneApproval: "required",
  });
  assert.equal(Object.isFrozen(review), true);
  assert.throws(() => boundary.review(owned.stationId, other.id), /not_found/);
  assert.throws(
    () => boundary.assertHandoffOwnership(owned.stationId, other),
    /station_reference_forbidden/,
  );
  const crossStationEvidence = {
    ...handoff(),
    evidence: [
      ...handoff().evidence.slice(0, 2),
      {
        id: "evidence:m311c",
        stationId: "station:m311b",
        category: "disabled_boundary" as const,
        result: "passed" as const,
      },
    ],
  };
  assert.throws(
    () => validateM3AcceptanceHandoff(crossStationEvidence),
    /station_reference_forbidden/,
  );
  assert.doesNotMatch(
    JSON.stringify({ handoff: owned, review }),
    forbiddenContent,
  );
});

test("M3.11 remains a non-operational accessible handoff with no adapter or dashboard control", async () => {
  const source = await readFile(
    new URL("../../src/app/m3-acceptance-handoff.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /node:(?:child_process|fs|net|dgram|http)/);
  assert.doesNotMatch(source, /(?:spawn|exec|fetch|connect|listen)\s*\(/);

  const dashboard = renderDashboard(seededStations, {
    version: "0.1.0-test",
    buildId: "m311-test",
  });
  assert.match(dashboard, /Fixture\/example status is never live station data/);
  assert.match(dashboard, /aria-disabled": "true"/);
  assert.doesNotMatch(
    dashboard,
    /Approve M4|Publish schedule|Start runtime|Start encoder|Start listener/,
  );
});
