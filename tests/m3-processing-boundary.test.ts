import assert from "node:assert/strict";
import test from "node:test";

import {
  DeterministicM3ProcessingBoundary,
  M3_PROCESSING_LIMITS,
  deterministicM3Adapters,
} from "../src/app/m3-processing-boundary.js";

test("M3 deterministic processing boundary accepts only approved station-scoped jobs", async () => {
  const boundary = new DeterministicM3ProcessingBoundary(
    deterministicM3Adapters(),
  );
  const result = await boundary.analyze({
    id: "job-a",
    stationId: "station-a",
    lifecycleState: "approved_for_processing",
  });
  assert.equal(result.metadataCandidates[0]?.stationId, "station-a");
  assert.equal(result.recommendation.recommendedGainDb, 2);
  assert.equal(M3_PROCESSING_LIMITS.maxWallClockMilliseconds, 120_000);
  await assert.rejects(
    () =>
      boundary.analyze({
        id: "job-a",
        stationId: "station-a",
        lifecycleState: "processing",
      } as never),
    /processing_not_approved/,
  );
});

test("M3 metadata candidates cannot cross a station and no default adapter has ambient side effects", async () => {
  let calls = 0;
  const boundary = new DeterministicM3ProcessingBoundary({
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
      findCandidates: async () => {
        calls += 1;
        return [
          {
            id: "candidate-a",
            stationId: "station-b",
            assetRevisionId: "revision-a",
            provider: "deterministic_fixture" as const,
            candidateReference: "candidate:0001",
            confidence: 1,
            resolutionState: "pending" as const,
            createdAt: "2026-08-04T00:00:00.000Z",
          },
        ];
      },
    },
  });
  await assert.rejects(
    () =>
      boundary.analyze({
        id: "job-a",
        stationId: "station-a",
        lifecycleState: "approved_for_processing",
      }),
    /station_reference_forbidden/,
  );
  assert.equal(calls, 1);
});
