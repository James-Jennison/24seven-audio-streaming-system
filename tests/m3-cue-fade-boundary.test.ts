import assert from "node:assert/strict";
import test from "node:test";

import {
  DisabledCueFadeAnalysisBoundary,
  validateCueFadeAnalysisResult,
  validateCueFadeRecommendation,
} from "../src/app/m3-cue-fade-boundary.js";

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
  declaredInputBytes: 1024,
  formatCategory: "audio/mpeg" as const,
  retryAttempt: 0,
  ...overrides,
});

const request = (overrides = {}) => ({
  id: "cue-fade:0001",
  stationId: "station:0001",
  idempotencyKey: "cue-fade-key:0001",
  processingJob: job(),
  assetRevisionId: "revision:0001",
  profile: "cue-fade-fixture-v1" as const,
  analysisVersion: "cue-fade-fixture-v1",
  retryAttempt: 0,
  requestedAt: "2026-08-04T00:00:00.000Z",
  ...overrides,
});

test("M3.6 previews only approved same-station revision/job references", () => {
  const boundary = new DisabledCueFadeAnalysisBoundary([job()]);
  const result = boundary.preview(request());
  assert.equal(result.availability, "fixture_preview_available");
  assert.equal(result.analysisPerformed, false);
  assert.equal(result.recommendation?.durationMilliseconds, 180_000);
  assert.equal(Object.isFrozen(result), true);
  assert.strictEqual(boundary.preview(request()), result);
  assert.throws(
    () => boundary.preview(request({ retryAttempt: 1 })),
    /idempotency_conflict/,
  );
  assert.throws(() => boundary.status("station:0002", "job:0001"), /not_found/);
  assert.throws(
    () => boundary.preview(request({ stationId: "station:0002" })),
    /station_reference_forbidden/,
  );
  assert.throws(
    () =>
      boundary.preview(
        request({
          id: "cue-fade:0002",
          idempotencyKey: "cue-fade-key:0002",
          assetRevisionId: "revision:0002",
        }),
      ),
    /station_reference_forbidden/,
  );
});

test("M3.6 validates bounded offsets, ordering, profiles, and retries", () => {
  assert.throws(
    () =>
      validateCueFadeRecommendation({
        durationMilliseconds: 10_000,
        cueInMilliseconds: 1_000,
        introEndMilliseconds: 500,
        outroStartMilliseconds: 8_000,
        cueOutMilliseconds: 9_000,
        fadeInMilliseconds: 0,
        fadeOutMilliseconds: 0,
        confidence: 0.9,
        confidenceCategory: "high",
        quality: "high",
        analysisVersion: "cue-fade-fixture-v1",
      }),
    /invalid_cue_fade_recommendation/,
  );
  assert.throws(
    () =>
      validateCueFadeRecommendation({
        durationMilliseconds: 10_000,
        cueInMilliseconds: 0,
        introEndMilliseconds: 1_000,
        outroStartMilliseconds: 8_000,
        cueOutMilliseconds: 9_000,
        fadeInMilliseconds: 0,
        fadeOutMilliseconds: 2_000,
        confidence: 0.9,
        confidenceCategory: "low",
        quality: "high",
        analysisVersion: "cue-fade-fixture-v1",
      }),
    /invalid_cue_fade_recommendation/,
  );
  const boundary = new DisabledCueFadeAnalysisBoundary([job()]);
  const unsupported = boundary.preview(
    request({
      id: "cue-fade:0002",
      idempotencyKey: "cue-fade-key:0002",
      profile: "unsupported-v1" as never,
    }),
  );
  assert.deepEqual(
    {
      availability: unsupported.availability,
      category: unsupported.failureCategory,
      performed: unsupported.analysisPerformed,
    },
    {
      availability: "unavailable",
      category: "unsupported_profile",
      performed: false,
    },
  );
  const retry = boundary.preview(
    request({
      id: "cue-fade:0003",
      idempotencyKey: "cue-fade-key:0003",
      retryAttempt: 4,
    }),
  );
  assert.equal(retry.failureCategory, "retry_not_eligible");
  assert.doesNotMatch(
    JSON.stringify(boundary.readEvidence("station:0001")),
    /path|filename|title|artist|token|credential|ffmpeg|icecast|waveform|payload/i,
  );
});

test("M3.6 preserves append-only fixture recommendations and rejects ineligible jobs", () => {
  const boundary = new DisabledCueFadeAnalysisBoundary([job()]);
  const result = boundary.preview(request());
  assert.throws(() => {
    (result as { availability: string }).availability = "quarantined";
  }, /read only|Cannot assign/);
  const ineligible = boundary.preview(
    request({
      id: "cue-fade:0004",
      idempotencyKey: "cue-fade-key:0004",
      processingJob: job({ lifecycleState: "quarantined" }),
    }),
  );
  assert.equal(ineligible.failureCategory, "job_ineligible");
  const superseded = boundary.preview(
    request({
      id: "cue-fade:0005",
      idempotencyKey: "cue-fade-key:0005",
      processingJob: job({ assetRevisionState: "superseded" }),
    }),
  );
  assert.equal(superseded.failureCategory, "job_ineligible");
  const quarantined = {
    ...ineligible,
    availability: "quarantined" as const,
    failureCategory: "quality_indeterminate" as const,
    retryEligibility: "requires_explicit_authorized_retry" as const,
  };
  assert.doesNotThrow(() => validateCueFadeAnalysisResult(quarantined));
  assert.throws(
    () =>
      validateCueFadeAnalysisResult({
        ...quarantined,
        retryEligibility: "not_eligible",
      }),
    /invalid_cue_fade_result/,
  );
});
