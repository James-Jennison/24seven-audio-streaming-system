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
  M4ScheduleApprovalBoundary,
  type M4ProposedSchedule,
  type M4ScheduleReviewAuthorization,
} from "../src/app/m4-schedule-approval-boundary.js";
import { M4SeparationPolicyBoundary } from "../src/app/m4-separation-policy-boundary.js";

const stationId = "station:0001";
const reviewTime = "2026-08-05T12:00:00.000Z";

const candidate = (id = "catalog:0001"): M4CatalogCandidate => ({
  id,
  stationId,
  assetId: `asset:${id}`,
  assetRevisionId: `revision:${id}`,
  revision: 1,
  eligibility: "ready_for_schedule_use",
});

const template = (): M4ClockTemplate => ({
  id: "template:0001",
  stationId,
  timezone: "UTC",
  revision: 1,
  slots: [{ id: "slot:0001", localStartMinute: 0, durationMinutes: 1_440 }],
});

function preview(candidates: readonly M4CatalogCandidate[] = [candidate()]) {
  const clock = new M4ClockTemplateBoundary([template()]);
  const dayInput = clock.prepareDayInput(
    stationId,
    "template:0001",
    "2026-08-05",
  );
  const boundary = new M4DryRunPreviewBoundary({
    dayInputs: [dayInput],
    candidates,
    separation: new M4SeparationPolicyBoundary({
      candidates,
      separationKeys: [],
      policies: [],
    }),
  });
  return boundary.generate(stationId, dayInput.id, "request:0001");
}

function proposal(): M4ProposedSchedule {
  return { id: "proposal:0001", stationId, preview: preview() };
}

const authorization = (
  overrides: Partial<M4ScheduleReviewAuthorization> = {},
): M4ScheduleReviewAuthorization => ({
  reviewerId: "user:0001",
  role: "programmer",
  assignedStationIds: [stationId],
  csrf: "validated",
  ...overrides,
});

test("M4.6 creates one immutable, idempotent approval record for a complete proposal", () => {
  const boundary = new M4ScheduleApprovalBoundary([proposal()]);
  const request = {
    id: "review:0001",
    authorization: authorization(),
    decision: "approved" as const,
    reviewedAt: reviewTime,
  };
  const first = boundary.decide(stationId, "proposal:0001", request);
  const repeated = boundary.decide(stationId, "proposal:0001", request);

  assert.strictEqual(first, repeated);
  assert.deepEqual(first, {
    id: "approval:proposal:0001:review:0001",
    stationId,
    proposalId: "proposal:0001",
    previewId: "preview:civil-day:template:0001:2026-08-05:request:0001",
    reviewerId: "user:0001",
    decision: "approved",
    reviewedAt: reviewTime,
    rework: "not_required",
    publication: "not_published",
    execution: "unavailable",
    evidence: {
      action: "m4.schedule_proposal_reviewed",
      stationId,
      proposalId: "proposal:0001",
      previewId: "preview:civil-day:template:0001:2026-08-05:request:0001",
      reviewId: "review:0001",
      decision: "approved",
      category: "proposal_approved",
    },
  });
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.evidence), true);
  assert.strictEqual(boundary.review(stationId, "review:0001"), first);
});

test("M4.6 rejection requires a new proposal for rework and cannot be overwritten", () => {
  const boundary = new M4ScheduleApprovalBoundary([proposal()]);
  const rejected = boundary.decide(stationId, "proposal:0001", {
    id: "review:0001",
    authorization: authorization(),
    decision: "rejected",
    reviewedAt: reviewTime,
  });
  assert.equal(rejected.rework, "new_proposal_required");
  assert.equal(rejected.evidence.category, "proposal_rejected");
  assert.throws(
    () =>
      boundary.decide(stationId, "proposal:0001", {
        id: "review:0002",
        authorization: authorization(),
        decision: "approved",
        reviewedAt: reviewTime,
      }),
    /proposal_already_reviewed/,
  );
});

test("M4.6 rejects incomplete proposals and enforces CSRF, RBAC, and station isolation", () => {
  const incompleteProposal: M4ProposedSchedule = {
    id: "proposal:0002",
    stationId,
    preview: preview([]),
  };
  assert.throws(
    () => new M4ScheduleApprovalBoundary([incompleteProposal]),
    /proposal_not_approvable/,
  );

  const owned = proposal();
  const boundary = new M4ScheduleApprovalBoundary([owned]);
  const request = {
    id: "review:0001",
    decision: "approved" as const,
    reviewedAt: reviewTime,
  };
  assert.throws(
    () =>
      boundary.decide(stationId, owned.id, {
        ...request,
        authorization: authorization({ assignedStationIds: [] }),
      }),
    /not_found/,
  );
  assert.throws(
    () =>
      boundary.decide(stationId, owned.id, {
        ...request,
        authorization: authorization({ role: "observer" }),
      }),
    /forbidden/,
  );
  assert.throws(
    () =>
      boundary.decide(stationId, owned.id, {
        ...request,
        authorization: authorization({ csrf: "invalid" as "validated" }),
      }),
    /csrf_rejected/,
  );
  assert.throws(
    () => boundary.review("station:0002", "review:0001"),
    /not_found/,
  );
  assert.throws(
    () => boundary.assertProposalOwnership("station:0002", owned),
    /station_reference_forbidden/,
  );
  assert.throws(
    () =>
      boundary.assertAuthorizationScope(
        "station:0002",
        authorization({ assignedStationIds: [] }),
      ),
    /station_reference_forbidden/,
  );
});

test("M4.6 records only content-free output and imports no operational adapter", async () => {
  const boundary = new M4ScheduleApprovalBoundary([proposal()]);
  const record = boundary.decide(stationId, "proposal:0001", {
    id: "review:0001",
    authorization: authorization(),
    decision: "approved",
    reviewedAt: reviewTime,
  });
  assert.doesNotMatch(
    JSON.stringify(record),
    /title|artist|filename|path|metadata|credential|token|csrf|sql/i,
  );
  const source = await readFile(
    new URL("../src/app/m4-schedule-approval-boundary.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /^import .*?(node:|postgres|sqlite|child_process|worker|ffmpeg|icecast)/m,
  );
  assert.doesNotMatch(source, /fetch\(|http\.request|https\.request/);
});
