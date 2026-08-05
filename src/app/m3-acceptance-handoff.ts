import { validateOpaqueReference } from "../domain/m3-assets.js";
import type { StableId } from "../domain/contracts.js";

export type AcceptedM3Milestone =
  | "M3.1"
  | "M3.2"
  | "M3.3"
  | "M3.4"
  | "M3.5"
  | "M3.6"
  | "M3.7"
  | "M3.8"
  | "M3.9"
  | "M3.10";

export type M3AcceptanceEvidenceCategory =
  | "content_free_local_evidence"
  | "station_isolation"
  | "disabled_boundary";

export type M3OpenRiskCategory =
  | "later_milestone_approval_required"
  | "operational_authority_not_granted";

export interface M3AcceptanceEvidence {
  id: StableId;
  stationId: StableId;
  category: M3AcceptanceEvidenceCategory;
  result: "passed";
}

/** A content-free, station-scoped risk ownership record. */
export interface M3OpenRiskOwnership {
  id: StableId;
  stationId: StableId;
  category: M3OpenRiskCategory;
  ownerReference: StableId;
  status: "open";
}

export interface M3AcceptanceHandoff {
  id: StableId;
  stationId: StableId;
  decision: "accepted_for_handoff";
  reviewMode: "local_evidence_only";
  operationalAuthority: "not_granted";
  acceptedMilestones: readonly AcceptedM3Milestone[];
  evidence: readonly M3AcceptanceEvidence[];
  assetReadiness: {
    state: "ready_for_schedule_use";
    schedule: "not_published";
    runtime: "unavailable";
    encoder: "unavailable";
    listener: "unavailable";
  };
  handoffs: {
    m4CatalogEligibility: "input_only";
    m5DesignInput: "input_only";
    m7Boundary: "input_only";
    newHumanApprovalRequired: true;
  };
  openRisks: readonly M3OpenRiskOwnership[];
}

export interface M3AcceptanceHandoffReview {
  id: StableId;
  stationId: StableId;
  handoffId: StableId;
  decision: "accepted_for_handoff";
  operationalAuthority: "not_granted";
  nextMilestone: "M4.1";
  nextMilestoneApproval: "required";
}

const acceptedMilestones: readonly AcceptedM3Milestone[] = [
  "M3.1",
  "M3.2",
  "M3.3",
  "M3.4",
  "M3.5",
  "M3.6",
  "M3.7",
  "M3.8",
  "M3.9",
  "M3.10",
];

const requiredEvidence: readonly M3AcceptanceEvidenceCategory[] = [
  "content_free_local_evidence",
  "station_isolation",
  "disabled_boundary",
];

/**
 * Validates a decision-only M3 handoff. It cannot grant operational authority
 * or authorize work in a later plane.
 */
export function validateM3AcceptanceHandoff(
  handoff: M3AcceptanceHandoff,
): void {
  validateOpaqueReference(handoff.id);
  validateOpaqueReference(handoff.stationId);
  if (
    handoff.decision !== "accepted_for_handoff" ||
    handoff.reviewMode !== "local_evidence_only" ||
    handoff.operationalAuthority !== "not_granted"
  )
    throw new Error("operational_authority_forbidden");
  if (!hasExactly(handoff.acceptedMilestones, acceptedMilestones))
    throw new Error("incomplete_m3_acceptance");
  if (
    handoff.evidence.length !== requiredEvidence.length ||
    !hasExactly(
      handoff.evidence.map((evidence) => evidence.category),
      requiredEvidence,
    )
  )
    throw new Error("incomplete_m3_acceptance_evidence");
  for (const evidence of handoff.evidence) {
    validateOpaqueReference(evidence.id);
    if (evidence.stationId !== handoff.stationId)
      throw new Error("station_reference_forbidden");
    if (evidence.result !== "passed")
      throw new Error("invalid_m3_acceptance_evidence");
  }
  if (
    handoff.assetReadiness.state !== "ready_for_schedule_use" ||
    handoff.assetReadiness.schedule !== "not_published" ||
    handoff.assetReadiness.runtime !== "unavailable" ||
    handoff.assetReadiness.encoder !== "unavailable" ||
    handoff.assetReadiness.listener !== "unavailable"
  )
    throw new Error("asset_readiness_execution_forbidden");
  if (
    handoff.handoffs.m4CatalogEligibility !== "input_only" ||
    handoff.handoffs.m5DesignInput !== "input_only" ||
    handoff.handoffs.m7Boundary !== "input_only" ||
    handoff.handoffs.newHumanApprovalRequired !== true
  )
    throw new Error("later_milestone_authority_forbidden");
  if (!handoff.openRisks.length)
    throw new Error("open_risk_ownership_required");
  for (const risk of handoff.openRisks) {
    validateOpaqueReference(risk.id);
    validateOpaqueReference(risk.ownerReference);
    if (risk.stationId !== handoff.stationId)
      throw new Error("station_reference_forbidden");
    if (
      ![
        "later_milestone_approval_required",
        "operational_authority_not_granted",
      ].includes(risk.category) ||
      risk.status !== "open"
    )
      throw new Error("invalid_m3_open_risk");
  }
}

/**
 * An in-memory review boundary for a local acceptance decision. It has no
 * route, adapter, persistence, process, network, or filesystem dependency.
 */
export class M3AcceptanceHandoffBoundary {
  private readonly handoffs = new Map<string, M3AcceptanceHandoff>();

  public constructor(handoffs: readonly M3AcceptanceHandoff[]) {
    for (const handoff of handoffs) {
      validateM3AcceptanceHandoff(handoff);
      const key = scopedKey(handoff.stationId, handoff.id);
      if (this.handoffs.has(key)) throw new Error("duplicate_m3_handoff");
      this.handoffs.set(key, Object.freeze({ ...handoff }));
    }
  }

  /** Public review does not disclose another station's acceptance decision. */
  review(stationId: StableId, handoffId: StableId): M3AcceptanceHandoffReview {
    const handoff = this.handoffs.get(scopedKey(stationId, handoffId));
    if (!handoff) throw new Error("not_found");
    return Object.freeze({
      id: `review:${handoff.id}`,
      stationId: handoff.stationId,
      handoffId: handoff.id,
      decision: "accepted_for_handoff",
      operationalAuthority: "not_granted",
      nextMilestone: "M4.1",
      nextMilestoneApproval: "required",
    });
  }

  /** Trusted internal callers receive a precise station-reference failure. */
  assertHandoffOwnership(
    stationId: StableId,
    handoff: M3AcceptanceHandoff,
  ): void {
    if (stationId !== handoff.stationId)
      throw new Error("station_reference_forbidden");
    validateM3AcceptanceHandoff(handoff);
  }
}

function hasExactly<T>(actual: readonly T[], expected: readonly T[]): boolean {
  return (
    actual.length === expected.length &&
    expected.every((item) => actual.includes(item))
  );
}

function scopedKey(stationId: StableId, id: StableId): string {
  return `${stationId}\u0000${id}`;
}
