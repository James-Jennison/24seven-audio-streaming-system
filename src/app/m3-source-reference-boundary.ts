import {
  assertExplicitRecoveryRetry,
  assertStationScopedSourceReference,
  type SourceReferenceRecoveryRecord,
  type SourceReferenceValidationOutcome,
  type StationScopedSourceReference,
  validateSourceReferenceRecoveryRecord,
  validateSourceReferenceValidationOutcome,
} from "../domain/m3-assets.js";

export interface SourceReferenceValidationRequest {
  id: string;
  stationId: string;
  intakeRequestId: string;
  sourceReferenceId: string;
  occurredAt: string;
}

export interface SourceReferenceValidationResult {
  outcome: SourceReferenceValidationOutcome;
  duplicate: boolean;
  processing: "disabled";
}

export interface SourceReferenceRetryAuthorization {
  id: string;
  stationId: string;
  intakeRequestId: string;
  sourceReferenceId: string;
  validationOutcomeId: string;
  createdAt: string;
}

/**
 * Fixture-only source-reference boundary. It holds opaque references supplied
 * by tests and has no filesystem, network, parser, subprocess, or worker
 * capability. A future persistence adapter must preserve the same scoped keys
 * and append-only result semantics.
 */
export class DeterministicSourceReferenceBoundary {
  private readonly references = new Map<string, StationScopedSourceReference>();
  private readonly outcomes = new Map<
    string,
    SourceReferenceValidationOutcome
  >();
  private readonly recoveries = new Map<
    string,
    SourceReferenceRecoveryRecord
  >();

  public constructor(references: readonly StationScopedSourceReference[]) {
    for (const reference of references) {
      assertStationScopedSourceReference(reference.stationId, reference);
      const key = scopedKey(reference.stationId, reference.id);
      if (this.references.has(key))
        throw new Error("duplicate_source_reference");
      this.references.set(key, Object.freeze({ ...reference }));
    }
  }

  /** Public scoped lookup intentionally hides another station's ownership. */
  read(
    stationId: string,
    sourceReferenceId: string,
  ): StationScopedSourceReference {
    const reference = this.references.get(
      scopedKey(stationId, sourceReferenceId),
    );
    if (!reference) throw new Error("not_found");
    return reference;
  }

  /** Internal relationship validation identifies a cross-station reference. */
  assertReferenceOwnership(
    stationId: string,
    reference: StationScopedSourceReference,
  ): void {
    assertStationScopedSourceReference(stationId, reference);
  }

  validate(
    request: SourceReferenceValidationRequest,
  ): SourceReferenceValidationResult {
    const idempotencyKey = scopedKey(
      request.stationId,
      request.intakeRequestId,
    );
    const existing = this.outcomes.get(idempotencyKey);
    if (existing) {
      if (existing.sourceReferenceId !== request.sourceReferenceId)
        throw new Error("idempotency_conflict");
      return { outcome: existing, duplicate: true, processing: "disabled" };
    }
    const reference = this.read(request.stationId, request.sourceReferenceId);
    const outcome: SourceReferenceValidationOutcome = Object.freeze({
      id: request.id,
      stationId: request.stationId,
      intakeRequestId: request.intakeRequestId,
      sourceReferenceId: reference.id,
      state: reference.validationState,
      category: reference.validationCategory,
      recoveryEligibility: reference.recoveryEligibility,
      occurredAt: request.occurredAt,
    });
    validateSourceReferenceValidationOutcome(outcome);
    this.outcomes.set(idempotencyKey, outcome);
    return { outcome, duplicate: false, processing: "disabled" };
  }

  /** Appends the sole legal recovery authorization; it never dispatches work. */
  authorizeRetry(
    stationId: string,
    outcome: SourceReferenceValidationOutcome,
    authorization: SourceReferenceRetryAuthorization,
  ): {
    recovery: SourceReferenceRecoveryRecord;
    processing: "disabled";
  } {
    if (outcome.stationId !== stationId)
      throw new Error("station_reference_forbidden");
    if (
      authorization.stationId !== stationId ||
      authorization.intakeRequestId !== outcome.intakeRequestId ||
      authorization.sourceReferenceId !== outcome.sourceReferenceId ||
      authorization.validationOutcomeId !== outcome.id
    )
      throw new Error("station_reference_forbidden");
    validateSourceReferenceValidationOutcome(outcome);
    const lifecycleState = assertExplicitRecoveryRetry(
      outcome.state === "quarantined" ? "quarantined" : "rejected",
      outcome.recoveryEligibility,
    );
    const existing = this.recoveries.get(scopedKey(stationId, outcome.id));
    if (existing) {
      if (existing.id !== authorization.id)
        throw new Error("idempotency_conflict");
      return { recovery: existing, processing: "disabled" };
    }
    const recovery: SourceReferenceRecoveryRecord = Object.freeze({
      ...authorization,
      resultingLifecycleState: lifecycleState,
    });
    validateSourceReferenceRecoveryRecord(recovery);
    this.recoveries.set(scopedKey(stationId, outcome.id), recovery);
    return { recovery, processing: "disabled" };
  }
}

function scopedKey(stationId: string, id: string): string {
  return `${stationId}\u0000${id}`;
}
