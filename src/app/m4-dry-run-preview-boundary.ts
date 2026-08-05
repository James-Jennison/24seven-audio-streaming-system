import type { StableId } from "../domain/contracts.js";
import { validateOpaqueReference } from "../domain/m3-assets.js";
import type { M4CatalogCandidate } from "./m4-catalog-eligibility-boundary.js";
import type { M4CivilDayPlanningInput } from "./m4-clock-template-boundary.js";
import {
  M4SeparationPolicyBoundary,
  type M4SeparationEvaluation,
  type M4SeparationEvidence,
} from "./m4-separation-policy-boundary.js";

export interface M4PreviewSlotAssignment {
  slotId: StableId;
  candidateId: StableId;
}

export interface M4PreviewConflict {
  slotId?: StableId;
  candidateId?: StableId;
  outcome: "conflict" | "indeterminate" | "catalog_empty";
  category: M4SeparationEvidence["category"];
  policyId?: StableId;
}

export type M4DryRunPreviewStatus = "complete" | "incomplete";

export interface M4DryRunPreviewEvidence {
  action: "m4.dry_run_preview_generated";
  stationId: StableId;
  previewId: StableId;
  status: M4DryRunPreviewStatus;
  slotCount: number;
  candidateCount: number;
  assignmentCount: number;
  conflictCount: number;
  category: "preview_complete" | "preview_incomplete";
}

/** A content-minimized proposal; it is never an approved or published schedule. */
export interface M4DryRunPreview {
  id: StableId;
  stationId: StableId;
  dayInputId: StableId;
  requestId: StableId;
  status: M4DryRunPreviewStatus;
  assignments: readonly M4PreviewSlotAssignment[];
  conflicts: readonly M4PreviewConflict[];
  evidence: M4DryRunPreviewEvidence;
  execution: "unavailable";
}

/**
 * Local-only M4.5 proposal generator. It composes already-prepared clock,
 * catalog, and separation inputs deterministically, but never writes a
 * proposal, approves/publishes it, or reaches a downstream plane.
 */
export class M4DryRunPreviewBoundary {
  private readonly dayInputs = new Map<string, M4CivilDayPlanningInput>();
  private readonly candidates = new Map<
    string,
    readonly M4CatalogCandidate[]
  >();

  public constructor(input: {
    dayInputs: readonly M4CivilDayPlanningInput[];
    candidates: readonly M4CatalogCandidate[];
    separation: M4SeparationPolicyBoundary;
  }) {
    this.separation = input.separation;
    for (const dayInput of input.dayInputs) this.addDayInput(dayInput);
    for (const candidate of input.candidates) this.addCandidate(candidate);
  }

  private readonly separation: M4SeparationPolicyBoundary;

  /**
   * Produces a repeatable, read-only preview. An incomplete result intentionally
   * exposes no partial assignments or inferred replacement selection.
   */
  generate(
    stationId: StableId,
    dayInputId: StableId,
    requestId: StableId,
  ): M4DryRunPreview {
    validateOpaqueReference(stationId);
    validateOpaqueReference(dayInputId);
    validateOpaqueReference(requestId);
    const dayInput = this.dayInputs.get(scopedKey(stationId, dayInputId));
    if (!dayInput) throw new Error("not_found");

    const candidates = this.candidates.get(stationId) ?? [];
    const previewId = `preview:${dayInput.id}:${requestId}`;
    const selectedCandidateIds: StableId[] = [];
    const assignments: M4PreviewSlotAssignment[] = [];
    const conflicts: M4PreviewConflict[] = [];

    if (!candidates.length) {
      conflicts.push({ outcome: "catalog_empty", category: "catalog_empty" });
      return preview(
        stationId,
        dayInput,
        requestId,
        previewId,
        candidates.length,
        [],
        conflicts,
      );
    }

    for (const slot of dayInput.slots) {
      let selected: M4CatalogCandidate | undefined;
      for (const candidate of candidates) {
        const evaluation = this.separation.evaluate(
          stationId,
          candidate.id,
          [...selectedCandidateIds].reverse(),
        );
        if (evaluation.outcome === "eligible") {
          selected = candidate;
          break;
        }
        conflicts.push(conflict(slot.id, candidate.id, evaluation));
        if (evaluation.outcome === "indeterminate")
          return preview(
            stationId,
            dayInput,
            requestId,
            previewId,
            candidates.length,
            [],
            conflicts,
          );
      }
      if (!selected)
        return preview(
          stationId,
          dayInput,
          requestId,
          previewId,
          candidates.length,
          [],
          conflicts,
        );
      selectedCandidateIds.push(selected.id);
      assignments.push({ slotId: slot.id, candidateId: selected.id });
    }

    return preview(
      stationId,
      dayInput,
      requestId,
      previewId,
      candidates.length,
      assignments,
      conflicts,
    );
  }

  /** Trusted internal callers must retain the day input's station ownership. */
  assertDayInputOwnership(
    stationId: StableId,
    dayInput: M4CivilDayPlanningInput,
  ): void {
    if (dayInput.stationId !== stationId)
      throw new Error("station_reference_forbidden");
    validateDayInput(dayInput);
  }

  /** Trusted internal callers must retain the candidate's station ownership. */
  assertCandidateOwnership(
    stationId: StableId,
    candidate: M4CatalogCandidate,
  ): void {
    if (candidate.stationId !== stationId)
      throw new Error("station_reference_forbidden");
    validateCandidate(candidate);
  }

  private addDayInput(dayInput: M4CivilDayPlanningInput): void {
    validateDayInput(dayInput);
    const key = scopedKey(dayInput.stationId, dayInput.id);
    if (this.dayInputs.has(key)) throw new Error("duplicate_preview_day_input");
    this.dayInputs.set(key, freezeDayInput(dayInput));
  }

  private addCandidate(candidate: M4CatalogCandidate): void {
    validateCandidate(candidate);
    const current = this.candidates.get(candidate.stationId) ?? [];
    if (current.some((item) => item.id === candidate.id))
      throw new Error("duplicate_catalog_candidate");
    this.candidates.set(
      candidate.stationId,
      Object.freeze(
        [...current, Object.freeze({ ...candidate })].sort((left, right) =>
          left.id.localeCompare(right.id),
        ),
      ),
    );
  }
}

function preview(
  stationId: StableId,
  dayInput: M4CivilDayPlanningInput,
  requestId: StableId,
  previewId: StableId,
  candidateCount: number,
  assignments: readonly M4PreviewSlotAssignment[],
  conflicts: readonly M4PreviewConflict[],
): M4DryRunPreview {
  const status: M4DryRunPreviewStatus =
    assignments.length === dayInput.slots.length ? "complete" : "incomplete";
  const visibleAssignments =
    status === "complete"
      ? Object.freeze(
          assignments.map((assignment) => Object.freeze({ ...assignment })),
        )
      : Object.freeze([]);
  const visibleConflicts = Object.freeze(
    conflicts.map((item) => Object.freeze({ ...item })),
  );
  return Object.freeze({
    id: previewId,
    stationId,
    dayInputId: dayInput.id,
    requestId,
    status,
    assignments: visibleAssignments,
    conflicts: visibleConflicts,
    evidence: Object.freeze({
      action: "m4.dry_run_preview_generated",
      stationId,
      previewId,
      status,
      slotCount: dayInput.slots.length,
      candidateCount,
      assignmentCount: visibleAssignments.length,
      conflictCount: visibleConflicts.length,
      category:
        status === "complete" ? "preview_complete" : "preview_incomplete",
    }),
    execution: "unavailable",
  });
}

function conflict(
  slotId: StableId,
  candidateId: StableId,
  evaluation: M4SeparationEvaluation,
): M4PreviewConflict {
  if (evaluation.outcome === "eligible")
    throw new Error("invalid_preview_conflict");
  return Object.freeze({
    slotId,
    candidateId,
    outcome: evaluation.outcome,
    category: evaluation.evidence.category,
    ...(evaluation.evidence.policyId === undefined
      ? {}
      : { policyId: evaluation.evidence.policyId }),
  });
}

function validateDayInput(dayInput: M4CivilDayPlanningInput): void {
  validateOpaqueReference(dayInput.id);
  validateOpaqueReference(dayInput.stationId);
  validateOpaqueReference(dayInput.templateId);
  if (!dayInput.slots.length || dayInput.summary.execution !== "unavailable")
    throw new Error("invalid_preview_day_input");
  for (const slot of dayInput.slots) validateOpaqueReference(slot.id);
}

function validateCandidate(candidate: M4CatalogCandidate): void {
  validateOpaqueReference(candidate.id);
  validateOpaqueReference(candidate.stationId);
  validateOpaqueReference(candidate.assetId);
  validateOpaqueReference(candidate.assetRevisionId);
  if (candidate.eligibility !== "ready_for_schedule_use")
    throw new Error("invalid_catalog_candidate");
}

function freezeDayInput(
  dayInput: M4CivilDayPlanningInput,
): M4CivilDayPlanningInput {
  return Object.freeze({
    ...dayInput,
    slots: Object.freeze(
      dayInput.slots.map((slot) => Object.freeze({ ...slot })),
    ),
    summary: Object.freeze({ ...dayInput.summary }),
  });
}

function scopedKey(stationId: StableId, id: StableId): string {
  return `${stationId}\u0000${id}`;
}
