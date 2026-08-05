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
} from "../src/app/m4-schedule-approval-boundary.js";
import {
  M4SchedulePublicationBoundary,
  type M4PublicationCandidate,
  type M4SchedulePublicationAuthorization,
} from "../src/app/m4-schedule-publication-boundary.js";
import { M4SeparationPolicyBoundary } from "../src/app/m4-separation-policy-boundary.js";

const stationId = "station:0001";
const reviewTime = "2026-08-05T12:00:00.000Z";
const publishTime = "2026-08-05T12:01:00.000Z";

const template = (): M4ClockTemplate => ({
  id: "template:0001",
  stationId,
  timezone: "UTC",
  revision: 1,
  slots: [{ id: "slot:0001", localStartMinute: 0, durationMinutes: 1_440 }],
});

function candidate(id: string): M4CatalogCandidate {
  return {
    id,
    stationId,
    assetId: `asset:${id}`,
    assetRevisionId: `revision:${id}`,
    revision: 1,
    eligibility: "ready_for_schedule_use",
  };
}

function proposed(id: string, catalogId: string): M4ProposedSchedule {
  const catalog = candidate(catalogId);
  const clock = new M4ClockTemplateBoundary([template()]);
  const day = clock.prepareDayInput(stationId, "template:0001", "2026-08-05");
  const preview = new M4DryRunPreviewBoundary({
    dayInputs: [day],
    candidates: [catalog],
    separation: new M4SeparationPolicyBoundary({
      candidates: [catalog],
      separationKeys: [],
      policies: [],
    }),
  }).generate(stationId, day.id, `request:${id}`);
  return { id, stationId, preview };
}

function publicationCandidate(
  id: string,
  catalogId: string,
  compatibility: "compatible" | "incompatible" = "compatible",
): M4PublicationCandidate {
  const proposal = proposed(id, catalogId);
  const approval = new M4ScheduleApprovalBoundary([proposal]).decide(
    stationId,
    proposal.id,
    {
      id: `review:${id}`,
      authorization: {
        reviewerId: "user:0001",
        role: "programmer",
        assignedStationIds: [stationId],
        csrf: "validated",
      },
      decision: "approved",
      reviewedAt: reviewTime,
    },
  );
  return {
    proposal,
    approval,
    compatibility: {
      id: `compatibility:${id}`,
      stationId,
      proposalId: proposal.id,
      approvalId: approval.id,
      previewId: proposal.preview.id,
      state: compatibility,
    },
  };
}

const authorization = (
  overrides: Partial<M4SchedulePublicationAuthorization> = {},
): M4SchedulePublicationAuthorization => ({
  publisherId: "user:0002",
  role: "administrator",
  assignedStationIds: [stationId],
  csrf: "validated",
  ...overrides,
});

test("M4.7 publishes immutable versioned artifacts and atomically advances only the active pointer", () => {
  const first = publicationCandidate("proposal:0001", "catalog:0001");
  const second = publicationCandidate("proposal:0002", "catalog:0002");
  const boundary = new M4SchedulePublicationBoundary([first, second]);
  const firstRecord = boundary.publish(stationId, first.proposal.id, {
    id: "publish:0001",
    authorization: authorization(),
    publishedAt: publishTime,
  });
  const repeated = boundary.publish(stationId, first.proposal.id, {
    id: "publish:0001",
    authorization: authorization(),
    publishedAt: publishTime,
  });
  assert.strictEqual(firstRecord, repeated);
  assert.equal(firstRecord.version.version, 1);
  assert.equal(firstRecord.version.publication, "published_versioned");
  assert.equal(firstRecord.version.execution, "unavailable");
  assert.equal(boundary.activeVersion(stationId).version, 1);

  const secondRecord = boundary.publish(stationId, second.proposal.id, {
    id: "publish:0002",
    authorization: authorization(),
    publishedAt: publishTime,
  });
  assert.equal(secondRecord.version.version, 2);
  assert.equal(
    boundary.activeVersion(stationId).versionId,
    secondRecord.version.id,
  );
  assert.strictEqual(
    boundary.version(stationId, firstRecord.version.id),
    firstRecord.version,
  );
  assert.equal(Object.isFrozen(firstRecord.version), true);
  assert.equal(Object.isFrozen(firstRecord.version.assignments), true);
});

test("M4.7 fails compatibility before a pointer change and preserves station isolation", () => {
  const valid = publicationCandidate("proposal:0001", "catalog:0001");
  const invalid = publicationCandidate(
    "proposal:0002",
    "catalog:0002",
    "incompatible",
  );
  const boundary = new M4SchedulePublicationBoundary([valid, invalid]);
  const published = boundary.publish(stationId, valid.proposal.id, {
    id: "publish:0001",
    authorization: authorization(),
    publishedAt: publishTime,
  });
  assert.throws(
    () =>
      boundary.publish(stationId, invalid.proposal.id, {
        id: "publish:0002",
        authorization: authorization(),
        publishedAt: publishTime,
      }),
    /compatibility_failed/,
  );
  assert.equal(
    boundary.activeVersion(stationId).versionId,
    published.version.id,
  );
  assert.throws(
    () => boundary.version("station:0002", published.version.id),
    /not_found/,
  );
  assert.throws(
    () => boundary.assertCandidateOwnership("station:0002", valid),
    /station_reference_forbidden/,
  );
});

test("M4.7 rollback changes only the active pointer and preserves both versions", () => {
  const first = publicationCandidate("proposal:0001", "catalog:0001");
  const second = publicationCandidate("proposal:0002", "catalog:0002");
  const boundary = new M4SchedulePublicationBoundary([first, second]);
  const firstRecord = boundary.publish(stationId, first.proposal.id, {
    id: "publish:0001",
    authorization: authorization(),
    publishedAt: publishTime,
  });
  const secondRecord = boundary.publish(stationId, second.proposal.id, {
    id: "publish:0002",
    authorization: authorization(),
    publishedAt: publishTime,
  });
  const rollback = boundary.rollback(stationId, firstRecord.version.id, {
    id: "rollback:0001",
    authorization: authorization(),
    rolledBackAt: "2026-08-05T12:02:00.000Z",
  });
  assert.equal(rollback.fromVersionId, secondRecord.version.id);
  assert.equal(rollback.toVersionId, firstRecord.version.id);
  assert.equal(
    boundary.activeVersion(stationId).versionId,
    firstRecord.version.id,
  );
  assert.strictEqual(
    boundary.version(stationId, secondRecord.version.id),
    secondRecord.version,
  );
  assert.strictEqual(
    boundary.rollback(stationId, firstRecord.version.id, {
      id: "rollback:0001",
      authorization: authorization(),
      rolledBackAt: "2026-08-05T12:02:00.000Z",
    }),
    rollback,
  );
});

test("M4.7 enforces publisher authority and emits only content-free non-dispatching records", async () => {
  const item = publicationCandidate("proposal:0001", "catalog:0001");
  const boundary = new M4SchedulePublicationBoundary([item]);
  const request = { id: "publish:0001", publishedAt: publishTime };
  assert.throws(
    () =>
      boundary.publish(stationId, item.proposal.id, {
        ...request,
        authorization: authorization({ assignedStationIds: [] }),
      }),
    /not_found/,
  );
  assert.throws(
    () =>
      boundary.publish(stationId, item.proposal.id, {
        ...request,
        authorization: authorization({ role: "programmer" }),
      }),
    /forbidden/,
  );
  assert.throws(
    () =>
      boundary.publish(stationId, item.proposal.id, {
        ...request,
        authorization: authorization({ csrf: "invalid" as "validated" }),
      }),
    /csrf_rejected/,
  );
  const record = boundary.publish(stationId, item.proposal.id, {
    ...request,
    authorization: authorization(),
  });
  assert.doesNotMatch(
    JSON.stringify(record),
    /title|artist|filename|path|metadata|credential|token|csrf|sql/i,
  );
  const source = await readFile(
    new URL("../src/app/m4-schedule-publication-boundary.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /^import .*?(node:|postgres|sqlite|child_process|worker|ffmpeg|icecast)/m,
  );
  assert.doesNotMatch(source, /fetch\(|http\.request|https\.request/);
});
