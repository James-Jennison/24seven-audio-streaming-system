import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { DisabledM3AsyncProcessingBoundary } from "../src/app/m3-processing-boundary.js";
import { DeterministicSourceReferenceBoundary } from "../src/app/m3-source-reference-boundary.js";
import {
  assertAssetLifecycleTransition,
  type StationScopedSourceReference,
} from "../src/domain/m3-assets.js";
import { seededStations } from "../src/domain/stations.js";
import { renderDashboard } from "../src/ui/dashboard.js";

const opaqueContentPattern =
  /filename|path|url|title|artist|album|tag|payload|credential|token|csrf|raw sql/i;

const processingJob = (overrides = {}) => ({
  id: "job:m39a",
  stationId: "station:m39a",
  importRequestId: "request:m39a",
  assetId: "asset:m39a",
  assetRevisionId: "revision:m39a",
  sourceReferenceId: "source:m39a",
  lifecycleState: "approved_for_processing" as const,
  assetRevisionState: "approved" as const,
  sourceValidationState: "valid" as const,
  declaredInputBytes: 1_024,
  formatCategory: "audio/mpeg" as const,
  retryAttempt: 0,
  ...overrides,
});

const processingRequest = (overrides = {}) => ({
  id: "dispatch:m39a",
  stationId: "station:m39a",
  idempotencyKey: "idempotency:m39a",
  job: processingJob(),
  stages: ["normalization_analysis"] as const,
  requestedAt: "2026-08-04T00:00:00.000Z",
  ...overrides,
});

const sourceReference = (
  id: string,
  stationId: string,
  validationState: StationScopedSourceReference["validationState"],
): StationScopedSourceReference => ({
  id,
  stationId,
  source: { kind: "operator_staged_reference", opaqueId: `source:${id}` },
  validationState,
  validationCategory:
    validationState === "valid" ? "accepted" : "ownership_unverified",
  recoveryEligibility:
    validationState === "quarantined"
      ? "requires_explicit_authorized_retry"
      : "not_eligible",
  createdAt: "2026-08-04T00:00:00.000Z",
});

test("M3.9 validates isolation, idempotency, illegal transitions, and explicit recovery", () => {
  const quarantined = sourceReference(
    "reference:m39a",
    "station:m39a",
    "quarantined",
  );
  const otherStation = sourceReference(
    "reference:m39b",
    "station:m39b",
    "valid",
  );
  const sources = new DeterministicSourceReferenceBoundary([
    quarantined,
    otherStation,
  ]);
  const validation = sources.validate({
    id: "outcome:m39a",
    stationId: "station:m39a",
    intakeRequestId: "request:m39a",
    sourceReferenceId: quarantined.id,
    occurredAt: "2026-08-04T00:00:00.000Z",
  });
  const duplicate = sources.validate({
    id: "outcome:m39a",
    stationId: "station:m39a",
    intakeRequestId: "request:m39a",
    sourceReferenceId: quarantined.id,
    occurredAt: "2026-08-04T00:00:00.000Z",
  });
  assert.equal(duplicate.duplicate, true);
  assert.strictEqual(duplicate.outcome, validation.outcome);
  assert.equal(Object.isFrozen(validation.outcome), true);
  assert.throws(
    () => sources.read("station:m39a", otherStation.id),
    /not_found/,
  );
  assert.throws(
    () => sources.assertReferenceOwnership("station:m39a", otherStation),
    /station_reference_forbidden/,
  );
  assert.throws(
    () => assertAssetLifecycleTransition("proposed", "processing"),
    /invalid_lifecycle_transition/,
  );

  const recovery = sources.authorizeRetry("station:m39a", validation.outcome, {
    id: "recovery:m39a",
    stationId: "station:m39a",
    intakeRequestId: "request:m39a",
    sourceReferenceId: quarantined.id,
    validationOutcomeId: validation.outcome.id,
    createdAt: "2026-08-04T00:00:01.000Z",
  });
  assert.equal(recovery.recovery.resultingLifecycleState, "validated");
  assert.equal(recovery.processing, "disabled");
  assert.equal(Object.isFrozen(recovery.recovery), true);
});

test("M3.9 validates immutable, content-free disabled-boundary evidence without dispatch", () => {
  const job = processingJob();
  const boundary = new DisabledM3AsyncProcessingBoundary([job]);
  const preview = boundary.preview(processingRequest());
  const duplicate = boundary.preview(processingRequest());
  assert.strictEqual(duplicate, preview);
  assert.equal(preview.dispatched, false);
  assert.equal(preview.boundaryState, "disabled");
  assert.equal(Object.isFrozen(preview), true);
  assert.throws(() => boundary.status("station:m39b", job.id), /not_found/);
  assert.throws(
    () => boundary.assertJobOwnership("station:m39b", job),
    /station_reference_forbidden/,
  );

  const failure = {
    id: "attempt:m39a",
    stationId: "station:m39a",
    jobId: job.id,
    from: "pending" as const,
    to: "failed" as const,
    category: "execution_time_limit" as const,
    retryEligibility: "requires_explicit_authorized_retry" as const,
    occurredAt: "2026-08-04T00:00:02.000Z",
  };
  const retry = boundary.recordRetryEligibility(
    {
      id: "retry:m39a",
      stationId: "station:m39a",
      jobId: job.id,
      attemptOutcomeId: failure.id,
      eligibility: "requires_explicit_authorized_retry",
      boundaryState: "disabled",
      occurredAt: "2026-08-04T00:00:03.000Z",
    },
    failure,
  );
  assert.equal(Object.isFrozen(retry), true);
  assert.doesNotMatch(
    JSON.stringify({
      preview,
      retry,
      evidence: boundary.readEvidence(job.stationId),
    }),
    opaqueContentPattern,
  );
});

test("M3.9 statically proves no M3 operational route and keeps unavailable UI non-interactive", async () => {
  const routes = await readFile(
    new URL("../../src/api/m3-asset-routes.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    routes,
    /\/(?:process-now|dispatch|execute|run|start|runtime|encoder|relay|icecast)(?:[/?"`]|$)/i,
  );
  assert.doesNotMatch(routes, /node:(?:child_process|fs|net|dgram)/);

  const dashboard = renderDashboard(seededStations, {
    version: "0.1.0-test",
    buildId: "m39-test",
  });
  assert.match(dashboard, /Fixture\/example status is never live station data/);
  assert.match(dashboard, /aria-disabled": "true"/);
  assert.doesNotMatch(
    dashboard,
    /Process now|Run now|Publish schedule|Start runtime|Restart encoder/,
  );
  assert.doesNotMatch(dashboard, /api\/v1\/stations\//);
});
