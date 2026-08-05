import assert from "node:assert/strict";
import test from "node:test";
import {
  DisabledNormalizationAnalysisBoundary,
  validateNormalizationAnalysisResult,
  validateNormalizationPolicy,
} from "../src/app/m3-normalization-boundary.js";

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
  id: "normalization:0001",
  stationId: "station:0001",
  idempotencyKey: "normalization-key:0001",
  processingJob: job(),
  assetRevisionId: "revision:0001",
  policy: {
    profile: "ebu-r128-v1" as const,
    targetLufs: -16,
    maximumRecommendedGainDb: 12,
    analysisVersion: "ebu-r128-v1",
  },
  retryAttempt: 0,
  requestedAt: "2026-08-04T00:00:00.000Z",
  ...overrides,
});

test("M3.5 previews only approved same-station revision/job references", () => {
  const boundary = new DisabledNormalizationAnalysisBoundary([job()]);
  const result = boundary.preview(request());
  assert.equal(result.availability, "fixture_preview_available");
  assert.equal(result.analysisPerformed, false);
  assert.equal(Object.isFrozen(result), true);
  assert.strictEqual(boundary.preview(request()), result);
  assert.throws(() => boundary.status("station:0002", "job:0001"), /not_found/);
  assert.throws(
    () => boundary.preview(request({ stationId: "station:0002" })),
    /station_reference_forbidden/,
  );
  assert.throws(
    () =>
      boundary.preview(
        request({
          id: "normalization:0003",
          idempotencyKey: "normalization-key:0003",
          assetRevisionId: "revision:0002",
        }),
      ),
    /station_reference_forbidden/,
  );
});

test("M3.5 validates bounded policy/result ranges and deterministic decline/retry", () => {
  assert.throws(
    () =>
      validateNormalizationPolicy({
        profile: "ebu-r128-v1",
        targetLufs: 1,
        maximumRecommendedGainDb: 1,
        analysisVersion: "ebu-r128-v1",
      }),
    /invalid_normalization_policy/,
  );
  assert.throws(
    () =>
      validateNormalizationPolicy({
        profile: "ebu-r128-v1",
        targetLufs: -16,
        maximumRecommendedGainDb: 41,
        analysisVersion: "ebu-r128-v1",
      }),
    /invalid_normalization_policy/,
  );
  const boundary = new DisabledNormalizationAnalysisBoundary([job()]);
  const declined = boundary.preview(
    request({
      id: "normalization:0002",
      idempotencyKey: "normalization-key:0002",
      policy: {
        profile: "ebu-r128-v1",
        targetLufs: 1,
        maximumRecommendedGainDb: 1,
        analysisVersion: "ebu-r128-v1",
      },
    }),
  );
  assert.deepEqual(
    {
      availability: declined.availability,
      category: declined.failureCategory,
      dispatched: declined.analysisPerformed,
    },
    {
      availability: "unavailable",
      category: "policy_invalid",
      dispatched: false,
    },
  );
  assert.doesNotMatch(
    JSON.stringify(boundary.readEvidence("station:0001")),
    /path|filename|title|artist|token|credential|ffmpeg|icecast/i,
  );
  assert.throws(
    () =>
      validateNormalizationAnalysisResult({
        ...declined,
        source: "deterministic_fixture",
      }),
    /invalid_normalization_result/,
  );
});

test("M3.5 rejects ineligible lifecycle references without overwriting provenance", () => {
  const boundary = new DisabledNormalizationAnalysisBoundary([job()]);
  const result = boundary.preview(
    request({ processingJob: job({ lifecycleState: "processing" }) }),
  );
  assert.equal(result.failureCategory, "job_ineligible");
  assert.equal(result.retryEligibility, "not_eligible");
  assert.throws(
    () =>
      boundary.preview(
        request({
          id: "normalization:0003",
          idempotencyKey: "normalization-key:0003",
          processingJob: job({ stationId: "station:0002" }),
        }),
      ),
    /station_reference_forbidden/,
  );
});
