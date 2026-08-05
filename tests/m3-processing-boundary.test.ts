import assert from "node:assert/strict";
import test from "node:test";

import {
  assertM3ProcessingAttemptTransition,
  DeterministicM3ProcessingBoundary,
  DisabledM3AsyncProcessingBoundary,
  M3_PROCESSING_LIMITS,
  type M3ProcessingAttemptOutcome,
  type M3ProcessingDispatchRequest,
  retryEligibilityFor,
  validateApprovedProcessingJobReference,
  validateM3ProcessingAttemptOutcome,
  validateM3ProcessingResourceLimits,
  deterministicM3Adapters,
} from "../src/app/m3-processing-boundary.js";

const job = (overrides = {}) => ({
  id: "job:0001",
  stationId: "station:0001",
  importRequestId: "request:0001",
  assetId: "asset:0001",
  assetRevisionId: "revision:0001",
  sourceReferenceId: "source:0001",
  lifecycleState: "approved_for_processing" as const,
  assetRevisionState: "approved" as const,
  sourceValidationState: "valid" as const,
  declaredInputBytes: 1_024,
  formatCategory: "audio/mpeg" as const,
  retryAttempt: 0,
  ...overrides,
});

const request = (overrides = {}): M3ProcessingDispatchRequest => ({
  id: "dispatch:0001",
  stationId: "station:0001",
  idempotencyKey: "idempotency:0001",
  job: job(),
  stages: [
    "normalization_analysis",
    "cue_fade_analysis",
    "metadata_enrichment",
  ],
  requestedAt: "2026-08-04T00:00:00.000Z",
  ...overrides,
});

test("M3.4 disabled boundary previews only approved station-scoped jobs", () => {
  const boundary = new DisabledM3AsyncProcessingBoundary([job()]);
  assert.deepEqual(boundary.status("station:0001", "job:0001"), {
    stationId: "station:0001",
    jobId: "job:0001",
    state: "disabled",
    execution: "unavailable",
    stages: [
      "normalization_analysis",
      "cue_fade_analysis",
      "metadata_enrichment",
    ],
  });
  const preview = boundary.preview(request());
  assert.deepEqual(preview, {
    id: "dispatch:0001",
    stationId: "station:0001",
    jobId: "job:0001",
    decision: "accepted_for_future_worker",
    boundaryState: "disabled",
    dispatched: false,
    retryEligibility: "not_eligible",
    requestedAt: "2026-08-04T00:00:00.000Z",
  });
  assert.strictEqual(boundary.preview(request()), preview);
  assert.equal(Object.isFrozen(preview), true);
  assert.deepEqual(boundary.readEvidence("station:0001"), [
    {
      action: "m3.processing_previewed",
      stationId: "station:0001",
      entityId: "job:0001",
      category: "disabled",
      safeCount: 3,
      occurredAt: "2026-08-04T00:00:00.000Z",
    },
  ]);
  assert.equal(M3_PROCESSING_LIMITS.maxWallClockMilliseconds, 120_000);
  assert.equal(M3_PROCESSING_LIMITS.maxConcurrentJobs, 1);
  assert.equal(M3_PROCESSING_LIMITS.maxRetryAttempts, 3);
});

test("M3.4 hides out-of-scope jobs and rejects cross-station internal references", () => {
  const owned = job();
  const other = job({ id: "job:0002", stationId: "station:0002" });
  const boundary = new DisabledM3AsyncProcessingBoundary([owned, other]);
  assert.throws(() => boundary.status("station:0001", "job:0002"), /not_found/);
  assert.throws(
    () => boundary.assertJobOwnership("station:0001", other),
    /station_reference_forbidden/,
  );
  assert.throws(
    () => boundary.preview(request({ stationId: "station:0002", job: owned })),
    /station_reference_forbidden/,
  );
});

test("M3.4 validates approval, resource limits, formats, and deterministic idempotency", () => {
  assert.doesNotThrow(() =>
    validateM3ProcessingResourceLimits(M3_PROCESSING_LIMITS),
  );
  assert.throws(
    () =>
      validateM3ProcessingResourceLimits({
        ...M3_PROCESSING_LIMITS,
        maxMemoryBytes: 0,
      }),
    /invalid_processing_limits/,
  );
  assert.throws(
    () =>
      validateM3ProcessingResourceLimits({
        ...M3_PROCESSING_LIMITS,
        maxConcurrentJobs: 0,
      }),
    /invalid_processing_limits/,
  );
  assert.throws(
    () =>
      validateApprovedProcessingJobReference(
        job({ lifecycleState: "processing" }),
      ),
    /processing_not_approved/,
  );
  assert.throws(
    () =>
      validateApprovedProcessingJobReference(
        job({ assetRevisionState: "superseded" }),
      ),
    /processing_not_approved/,
  );
  assert.throws(
    () =>
      validateApprovedProcessingJobReference(
        job({
          declaredInputBytes: M3_PROCESSING_LIMITS.maxDeclaredInputBytes + 1,
        }),
      ),
    /input_size_limit/,
  );
  assert.throws(
    () =>
      validateApprovedProcessingJobReference(
        job({ formatCategory: "audio/unknown" }),
      ),
    /format_not_allowed/,
  );
  assert.throws(
    () => validateApprovedProcessingJobReference(job({ retryAttempt: 4 })),
    /retry_limit/,
  );

  const boundary = new DisabledM3AsyncProcessingBoundary([job()]);
  boundary.preview(request());
  const declined = boundary.preview(
    request({
      id: "dispatch:0002",
      idempotencyKey: "idempotency:0002",
      job: job({
        declaredInputBytes: M3_PROCESSING_LIMITS.maxDeclaredInputBytes + 1,
      }),
    }),
  );
  assert.deepEqual(
    {
      decision: declined.decision,
      category: declined.category,
      dispatched: declined.dispatched,
    },
    { decision: "declined", category: "input_size_limit", dispatched: false },
  );
  assert.throws(
    () => boundary.preview(request({ job: job({ id: "job:0009" }) })),
    /not_found|idempotency_conflict/,
  );
});

test("M3.4 validates future completion, failure, quarantine, and bounded retry contracts", () => {
  assert.doesNotThrow(() =>
    assertM3ProcessingAttemptTransition("pending", "completed"),
  );
  assert.doesNotThrow(() =>
    assertM3ProcessingAttemptTransition("quarantined", "eligible"),
  );
  assert.throws(
    () => assertM3ProcessingAttemptTransition("completed", "eligible"),
    /invalid_processing_transition/,
  );
  assert.equal(
    retryEligibilityFor("execution_time_limit", 0),
    "requires_explicit_authorized_retry",
  );
  assert.equal(retryEligibilityFor("format_not_allowed", 0), "not_eligible");
  assert.equal(retryEligibilityFor("internal_boundary", 3), "not_eligible");

  const quarantined: M3ProcessingAttemptOutcome = {
    id: "outcome:0001",
    stationId: "station:0001",
    jobId: "job:0001",
    from: "pending",
    to: "quarantined",
    category: "memory_limit",
    retryEligibility: "requires_explicit_authorized_retry",
    occurredAt: "2026-08-04T00:00:00.000Z",
  };
  assert.doesNotThrow(() => validateM3ProcessingAttemptOutcome(quarantined));
  const boundary = new DisabledM3AsyncProcessingBoundary([job()]);
  const record = boundary.recordRetryEligibility(
    {
      id: "retry:0001",
      stationId: "station:0001",
      jobId: "job:0001",
      attemptOutcomeId: "outcome:0001",
      eligibility: "requires_explicit_authorized_retry",
      boundaryState: "disabled",
      occurredAt: "2026-08-04T00:00:01.000Z",
    },
    quarantined,
  );
  assert.equal(record.boundaryState, "disabled");
  assert.equal(Object.isFrozen(record), true);
  assert.throws(
    () =>
      validateM3ProcessingAttemptOutcome({
        ...quarantined,
        retryEligibility: "not_eligible",
      }),
    /invalid_processing_outcome/,
  );
});

test("M3.4 default dispatcher has no execution adapter while fixtures remain deterministic", async () => {
  const boundary = new DisabledM3AsyncProcessingBoundary([job()]);
  const preview = boundary.preview(request());
  assert.equal(preview.dispatched, false);
  assert.doesNotMatch(
    JSON.stringify({
      preview,
      evidence: boundary.readEvidence("station:0001"),
    }),
    /path|filename|title|artist|token|credential|ffmpeg|icecast|payload/i,
  );

  const fixture = new DeterministicM3ProcessingBoundary(
    deterministicM3Adapters(),
  );
  const result = await fixture.analyze(job());
  assert.equal(result.metadataCandidates[0]?.stationId, "station:0001");
  await assert.rejects(
    () => fixture.analyze(job({ lifecycleState: "processing" }) as never),
    /processing_not_approved/,
  );
});

test("M3.4 fixture analysis rejects a cross-station candidate without provenance mutation", async () => {
  const fixture = new DeterministicM3ProcessingBoundary({
    normalization: {
      analyze: async () => ({
        loudness: { integratedLufs: -16, loudnessRangeLu: 1, truePeakDbtp: -1 },
        recommendation: {
          targetLufs: -16,
          recommendedGainDb: 0,
          analysisVersion: "v1",
        },
      }),
    },
    cueFade: {
      analyze: async () => ({
        cueInMilliseconds: 0,
        cueOutMilliseconds: 1,
        fadeInMilliseconds: 0,
        fadeOutMilliseconds: 0,
        confidence: 1,
        quality: "high" as const,
        analysisVersion: "v1",
      }),
    },
    metadata: {
      findCandidates: async () => [
        {
          id: "candidate:0001",
          stationId: "station:0002",
          assetRevisionId: "revision:0001",
          provider: "deterministic_fixture" as const,
          candidateReference: "candidate:0001",
          confidence: 1,
          resolutionState: "pending" as const,
          createdAt: "2026-08-04T00:00:00.000Z",
        },
      ],
    },
  });
  await assert.rejects(
    () => fixture.analyze(job()),
    /station_reference_forbidden/,
  );
});
