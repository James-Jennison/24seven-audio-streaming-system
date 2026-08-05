import assert from "node:assert/strict";
import test from "node:test";

import {
  DisabledMetadataEnrichmentBoundary,
  validateMetadataCandidateRecord,
  validateMetadataEnrichmentOutcome,
  validateMetadataResolutionRecord,
} from "../src/app/m3-metadata-boundary.js";

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
  id: "metadata:0001",
  stationId: "station:0001",
  idempotencyKey: "metadata-key:0001",
  processingJob: job(),
  assetRevisionId: "revision:0001",
  profile: "metadata-fixture-v1" as const,
  providerCategory: "deterministic_fixture" as const,
  providerVersion: "metadata-fixture-v1",
  analysisVersion: "metadata-fixture-v1",
  retryAttempt: 0,
  requestedAt: "2026-08-04T00:00:00.000Z",
  ...overrides,
});

test("M3.7 previews only approved same-station jobs and hides out-of-scope candidates", () => {
  const boundary = new DisabledMetadataEnrichmentBoundary([job()]);
  const outcome = boundary.preview(request());
  const candidateId = outcome.candidateIds[0]!;
  const candidate = boundary.readCandidate("station:0001", candidateId);
  assert.equal(outcome.availability, "fixture_preview_available");
  assert.equal(outcome.enrichmentPerformed, false);
  assert.equal(candidate.resolutionState, "pending");
  assert.equal(Object.isFrozen(candidate), true);
  assert.strictEqual(boundary.preview(request()), outcome);
  assert.throws(
    () => boundary.readCandidate("station:0002", candidateId),
    /not_found/,
  );
  assert.throws(
    () => boundary.assertCandidateOwnership("station:0002", candidate),
    /station_reference_forbidden/,
  );
  assert.throws(
    () => boundary.preview(request({ stationId: "station:0002" })),
    /station_reference_forbidden/,
  );
  assert.throws(
    () =>
      boundary.preview(
        request({
          id: "metadata:0002",
          idempotencyKey: "metadata-key:0002",
          assetRevisionId: "revision:0002",
        }),
      ),
    /station_reference_forbidden/,
  );
});

test("M3.7 validates confidence, provider-disabled, retry, and quarantine outcomes", () => {
  assert.throws(
    () =>
      validateMetadataCandidateRecord({
        id: "candidate:0001",
        stationId: "station:0001",
        requestId: "metadata:0001",
        jobId: "job:0001",
        assetRevisionId: "revision:0001",
        profile: "metadata-fixture-v1",
        providerCategory: "deterministic_fixture",
        providerVersion: "metadata-fixture-v1",
        provenanceReference: "metadata-fixture-v1",
        availability: "fixture_preview_available",
        confidence: 0.9,
        confidenceCategory: "low",
        resolutionState: "pending",
        enrichmentPerformed: false,
        createdAt: "2026-08-04T00:00:00.000Z",
      }),
    /invalid_metadata_candidate/,
  );
  const boundary = new DisabledMetadataEnrichmentBoundary([job()]);
  const unavailable = boundary.preview(
    request({
      id: "metadata:0002",
      idempotencyKey: "metadata-key:0002",
      providerCategory: "musicbrainz_compatible",
    }),
  );
  assert.deepEqual(
    {
      availability: unavailable.availability,
      category: unavailable.failureCategory,
      performed: unavailable.enrichmentPerformed,
    },
    {
      availability: "unavailable",
      category: "provider_disabled",
      performed: false,
    },
  );
  const retryable = boundary.preview(
    request({
      id: "metadata:0003",
      idempotencyKey: "metadata-key:0003",
      processingJob: job({ declaredInputBytes: 3_000_000_000 }),
    }),
  );
  assert.equal(retryable.failureCategory, "internal_boundary");
  assert.equal(
    retryable.retryEligibility,
    "requires_explicit_authorized_retry",
  );
  const retry = boundary.recordRetry(
    {
      id: "retry:0001",
      stationId: "station:0001",
      outcomeId: retryable.id,
      jobId: "job:0001",
      eligibility: "requires_explicit_authorized_retry",
      boundaryState: "disabled",
      occurredAt: "2026-08-04T00:00:01.000Z",
    },
    retryable,
  );
  assert.equal(Object.isFrozen(retry), true);
  const quarantined = {
    ...retryable,
    availability: "quarantined" as const,
    failureCategory: "candidate_quarantined" as const,
    retryEligibility: "requires_explicit_authorized_retry" as const,
  };
  assert.doesNotThrow(() => validateMetadataEnrichmentOutcome(quarantined));
  assert.throws(
    () =>
      validateMetadataEnrichmentOutcome({
        ...quarantined,
        retryEligibility: "not_eligible",
      }),
    /invalid_metadata_outcome/,
  );
  assert.doesNotMatch(
    JSON.stringify(boundary.readEvidence("station:0001")),
    /title|artist|album|filename|path|url|tag|token|credential|ffmpeg|icecast|payload/i,
  );
});

test("M3.7 requires an explicit, append-only operator resolution", () => {
  const boundary = new DisabledMetadataEnrichmentBoundary([job()]);
  const candidateId = boundary.preview(request()).candidateIds[0]!;
  const resolution = {
    id: "resolution:0001",
    stationId: "station:0001",
    candidateId,
    idempotencyKey: "resolution-key:0001",
    operatorId: "operator:0001",
    priorState: "pending" as const,
    resolutionState: "approved" as const,
    recordedAt: "2026-08-04T00:00:02.000Z",
  };
  assert.doesNotThrow(() => validateMetadataResolutionRecord(resolution));
  const recorded = boundary.resolve(resolution);
  assert.equal(recorded.resolutionState, "approved");
  assert.strictEqual(boundary.resolve(resolution), recorded);
  assert.equal(
    boundary.readCandidate("station:0001", candidateId).resolutionState,
    "pending",
  );
  assert.equal(
    boundary.readResolution("station:0001", candidateId)?.resolutionState,
    "approved",
  );
  assert.throws(
    () =>
      boundary.resolve({
        ...resolution,
        id: "resolution:0002",
        idempotencyKey: "resolution-key:0002",
        resolutionState: "superseded",
      }),
    /invalid_metadata_resolution_transition/,
  );
  assert.throws(
    () =>
      boundary.resolve({
        ...resolution,
        stationId: "station:0002",
        id: "resolution:0003",
        idempotencyKey: "resolution-key:0003",
      }),
    /not_found/,
  );
});
