import assert from "node:assert/strict";
import test from "node:test";

import { DeterministicSourceReferenceBoundary } from "../src/app/m3-source-reference-boundary.js";
import type {
  StationScopedSourceReference,
  SourceReferenceValidationOutcome,
} from "../src/domain/m3-assets.js";

const fixture = (
  id: string,
  stationId: string,
  validationState: StationScopedSourceReference["validationState"] = "valid",
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

const validationRequest = (sourceReferenceId: string) => ({
  id: "outcome:0001",
  stationId: "station-a",
  intakeRequestId: "request:0001",
  sourceReferenceId,
  occurredAt: "2026-08-04T00:00:01.000Z",
});

const retryAuthorization = (outcome: SourceReferenceValidationOutcome) => ({
  id: "recovery:0001",
  stationId: outcome.stationId,
  intakeRequestId: outcome.intakeRequestId,
  sourceReferenceId: outcome.sourceReferenceId,
  validationOutcomeId: outcome.id,
  createdAt: "2026-08-04T00:00:02.000Z",
});

test("M3 source references are opaque, station-scoped, and hide out-of-scope reads", () => {
  const reference = fixture("reference:0001", "station-a");
  const otherStation = fixture("reference:0002", "station-b");
  const boundary = new DeterministicSourceReferenceBoundary([
    reference,
    otherStation,
  ]);

  assert.equal(
    boundary.read("station-a", reference.id).source.opaqueId,
    "source:reference:0001",
  );
  assert.throws(() => boundary.read("station-a", otherStation.id), /not_found/);
  assert.throws(
    () => boundary.assertReferenceOwnership("station-a", otherStation),
    /station_reference_forbidden/,
  );
  assert.throws(
    () =>
      new DeterministicSourceReferenceBoundary([
        {
          ...reference,
          source: {
            kind: "operator_staged_reference",
            opaqueId: "/unsafe/media-path.mp3",
          },
        },
      ]),
    /invalid_opaque_reference/,
  );
});

test("M3 validation records deterministic, content-free outcomes without an adapter", () => {
  const boundary = new DeterministicSourceReferenceBoundary([
    fixture("reference:0001", "station-a"),
  ]);
  const first = boundary.validate(validationRequest("reference:0001"));
  const duplicate = boundary.validate(validationRequest("reference:0001"));

  assert.equal(first.outcome.state, "valid");
  assert.equal(first.outcome.category, "accepted");
  assert.equal(first.processing, "disabled");
  assert.equal(duplicate.duplicate, true);
  assert.strictEqual(duplicate.outcome, first.outcome);
  assert.throws(
    () => boundary.validate(validationRequest("reference:missing")),
    /idempotency_conflict/,
  );
  assert.doesNotMatch(
    JSON.stringify(first),
    /path|filename|artist|title|token|credential|ffmpeg|icecast/i,
  );
});

test("M3 quarantine requires an explicit retry while rejection remains terminal", () => {
  const boundary = new DeterministicSourceReferenceBoundary([
    fixture("reference:0001", "station-a", "quarantined"),
    fixture("reference:0002", "station-a", "rejected"),
  ]);
  const quarantined = boundary.validate(validationRequest("reference:0001"));
  const retry = boundary.authorizeRetry(
    "station-a",
    quarantined.outcome,
    retryAuthorization(quarantined.outcome),
  );
  assert.deepEqual(retry, {
    recovery: {
      ...retryAuthorization(quarantined.outcome),
      resultingLifecycleState: "validated",
    },
    processing: "disabled",
  });
  assert.strictEqual(
    boundary.authorizeRetry(
      "station-a",
      quarantined.outcome,
      retryAuthorization(quarantined.outcome),
    ).recovery,
    retry.recovery,
  );

  const rejected = boundary.validate({
    ...validationRequest("reference:0002"),
    id: "outcome:0002",
    intakeRequestId: "request:0002",
  });
  assert.equal(rejected.outcome.state, "rejected");
  assert.throws(
    () =>
      boundary.authorizeRetry(
        "station-a",
        rejected.outcome,
        retryAuthorization(rejected.outcome),
      ),
    /recovery_not_eligible/,
  );
  assert.throws(
    () =>
      boundary.authorizeRetry(
        "station-b",
        quarantined.outcome,
        retryAuthorization(quarantined.outcome),
      ),
    /station_reference_forbidden/,
  );
});

test("M3 source-boundary outcomes are immutable values and never a provenance overwrite", () => {
  const boundary = new DeterministicSourceReferenceBoundary([
    fixture("reference:0001", "station-a"),
  ]);
  const outcome: SourceReferenceValidationOutcome = boundary.validate(
    validationRequest("reference:0001"),
  ).outcome;
  assert.equal(Object.isFrozen(outcome), true);
  assert.throws(() => {
    (outcome as { category: string }).category = "policy_rejected";
  }, /read only|Cannot assign/);
});
