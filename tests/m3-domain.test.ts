import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAssetLifecycleTransition,
  validateCueFadeMeasurement,
  validateLoudnessMeasurement,
  validateNormalizationRecommendation,
  validateOpaqueReference,
} from "../src/domain/m3-assets.js";

test("M3 lifecycle accepts only bounded non-runtime transitions", () => {
  assert.doesNotThrow(() =>
    assertAssetLifecycleTransition("validated", "approved_for_processing"),
  );
  assert.doesNotThrow(() =>
    assertAssetLifecycleTransition("failed", "validated"),
  );
  assert.throws(
    () => assertAssetLifecycleTransition("proposed", "processing"),
    /invalid_lifecycle_transition/,
  );
  assert.throws(
    () =>
      assertAssetLifecycleTransition("ready_for_schedule_use", "processing"),
    /invalid_lifecycle_transition/,
  );
});

test("M3 accepts opaque source handles only", () => {
  assert.doesNotThrow(() => validateOpaqueReference("source:8f2a17bd"));
  assert.throws(
    () => validateOpaqueReference("/library/audio.mp3"),
    /invalid_opaque_reference/,
  );
  assert.throws(
    () => validateOpaqueReference("reference/with/slash"),
    /invalid_opaque_reference/,
  );
});

test("EBU R128 and cue/fade contracts reject impossible measurements", () => {
  assert.doesNotThrow(() =>
    validateLoudnessMeasurement({
      integratedLufs: -16,
      loudnessRangeLu: 8,
      truePeakDbtp: -1,
    }),
  );
  assert.throws(
    () =>
      validateLoudnessMeasurement({
        integratedLufs: 1,
        loudnessRangeLu: 8,
        truePeakDbtp: -1,
      }),
    /invalid_loudness_measurement/,
  );
  assert.throws(
    () =>
      validateNormalizationRecommendation({
        targetLufs: -16,
        recommendedGainDb: 99,
        analysisVersion: "fixture-v1",
      }),
    /invalid_normalization_recommendation/,
  );
  assert.throws(
    () =>
      validateCueFadeMeasurement({
        cueInMilliseconds: 100,
        cueOutMilliseconds: 100,
        fadeInMilliseconds: 0,
        fadeOutMilliseconds: 0,
        confidence: 0.5,
        quality: "medium",
        analysisVersion: "fixture-v1",
      }),
    /invalid_cue_fade_measurement/,
  );
});
