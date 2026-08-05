import { validateOpaqueReference } from "../domain/m3-assets.js";
import type { StableId } from "../domain/contracts.js";
import {
  M3_PROCESSING_LIMITS,
  type M3ProcessingResourceLimits,
  validateM3ProcessingResourceLimits,
} from "./m3-processing-boundary.js";

export type M3StagingStopCategory =
  | "target_ambiguous"
  | "authority_missing"
  | "unexpected_input"
  | "plane_activation";

export type M3StagingEvidenceRequirement =
  | "ledger_schema"
  | "station_isolation"
  | "no_network_no_downstream_dispatch"
  | "stop_cleanup";

/**
 * A local-only review artifact. It models a future owner-reviewed rehearsal
 * without containing a target address, credential, source reference, media
 * input, SQL, or any executable instruction.
 */
export interface M3StagingRehearsalProposal {
  id: StableId;
  stationId: StableId;
  reviewedCommit: string;
  migrationIdentity: string;
  mode: "proposal_only";
  ownerAuthorizationRequired: true;
  ownerAuthorizationGranted: false;
  target: {
    classification: "isolated_staging";
    exposure: "loopback_only";
    input: "empty_non_production";
  };
  authorities: readonly [
    "migration",
    "control_plane",
    "future_worker",
    "evidence_review",
  ];
  sandboxLimits: M3ProcessingResourceLimits;
  inactivePlanes: {
    m4Publication: "inactive";
    m5Runtime: "inactive";
    m7EncoderListener: "inactive";
  };
  rollback: {
    stopCategories: readonly M3StagingStopCategory[];
    automaticRetry: false;
    automaticRollback: false;
    ownerDecisionRequired: true;
  };
  evidenceRequirements: readonly M3StagingEvidenceRequirement[];
}

export interface M3StagingProposalReview {
  id: StableId;
  stationId: StableId;
  proposalId: StableId;
  mode: "proposal_only";
  execution: "unavailable";
  rehearsalPerformed: false;
  evidenceStatus: "not_run";
}

export interface M3StagingStopDecision {
  stationId: StableId;
  proposalId: StableId;
  category: M3StagingStopCategory;
  execution: "unavailable";
  cleanup: "not_started";
  automaticRetry: false;
  automaticRollback: false;
  nextAction: "owner_decision_required";
}

const requiredEvidence: readonly M3StagingEvidenceRequirement[] = [
  "ledger_schema",
  "station_isolation",
  "no_network_no_downstream_dispatch",
  "stop_cleanup",
];

const requiredStopCategories: readonly M3StagingStopCategory[] = [
  "target_ambiguous",
  "authority_missing",
  "unexpected_input",
  "plane_activation",
];

/** Validates a future rehearsal proposal only; it cannot activate a rehearsal. */
export function validateM3StagingRehearsalProposal(
  proposal: M3StagingRehearsalProposal,
): void {
  validateOpaqueReference(proposal.id);
  validateOpaqueReference(proposal.stationId);
  if (!/^[a-f0-9]{40}$/i.test(proposal.reviewedCommit))
    throw new Error("invalid_reviewed_commit");
  validateOpaqueReference(proposal.migrationIdentity);
  if (
    proposal.mode !== "proposal_only" ||
    proposal.ownerAuthorizationRequired !== true ||
    proposal.ownerAuthorizationGranted !== false
  )
    throw new Error("proposal_execution_forbidden");
  if (
    proposal.target.classification !== "isolated_staging" ||
    proposal.target.exposure !== "loopback_only" ||
    proposal.target.input !== "empty_non_production"
  )
    throw new Error("invalid_rehearsal_target");
  if (
    new Set(proposal.authorities).size !== proposal.authorities.length ||
    proposal.authorities.join(",") !==
      "migration,control_plane,future_worker,evidence_review"
  )
    throw new Error("invalid_rehearsal_authorities");
  validateM3ProcessingResourceLimits(proposal.sandboxLimits);
  if (
    proposal.inactivePlanes.m4Publication !== "inactive" ||
    proposal.inactivePlanes.m5Runtime !== "inactive" ||
    proposal.inactivePlanes.m7EncoderListener !== "inactive"
  )
    throw new Error("plane_activation_forbidden");
  if (
    proposal.rollback.automaticRetry !== false ||
    proposal.rollback.automaticRollback !== false ||
    proposal.rollback.ownerDecisionRequired !== true ||
    !hasExactly(proposal.rollback.stopCategories, requiredStopCategories)
  )
    throw new Error("invalid_rehearsal_recovery");
  if (!hasExactly(proposal.evidenceRequirements, requiredEvidence))
    throw new Error("invalid_rehearsal_evidence");
}

/**
 * The proposal boundary is intentionally review-only. It has no adapter
 * dependency and no method that can start a migration, service, worker, or
 * external call.
 */
export class DisabledM3StagingRehearsalProposalBoundary {
  private readonly proposals = new Map<string, M3StagingRehearsalProposal>();

  public constructor(proposals: readonly M3StagingRehearsalProposal[]) {
    for (const proposal of proposals) {
      validateM3StagingRehearsalProposal(proposal);
      const key = scopedKey(proposal.stationId, proposal.id);
      if (this.proposals.has(key))
        throw new Error("duplicate_rehearsal_proposal");
      this.proposals.set(key, Object.freeze({ ...proposal }));
    }
  }

  /** Public scoped review intentionally hides another station's proposal. */
  review(stationId: StableId, proposalId: StableId): M3StagingProposalReview {
    const proposal = this.proposals.get(scopedKey(stationId, proposalId));
    if (!proposal) throw new Error("not_found");
    return Object.freeze({
      id: `review:${proposal.id}`,
      stationId: proposal.stationId,
      proposalId: proposal.id,
      mode: "proposal_only",
      execution: "unavailable",
      rehearsalPerformed: false,
      evidenceStatus: "not_run",
    });
  }

  /** Internal references disclose a mismatched station only to trusted code. */
  assertProposalOwnership(
    stationId: StableId,
    proposal: M3StagingRehearsalProposal,
  ): void {
    if (stationId !== proposal.stationId)
      throw new Error("station_reference_forbidden");
    validateM3StagingRehearsalProposal(proposal);
  }

  /** Records the fail-closed recovery decision shape without performing cleanup. */
  stopDecision(
    stationId: StableId,
    proposalId: StableId,
    category: M3StagingStopCategory,
  ): M3StagingStopDecision {
    const proposal = this.proposals.get(scopedKey(stationId, proposalId));
    if (!proposal) throw new Error("not_found");
    if (!requiredStopCategories.includes(category))
      throw new Error("invalid_rehearsal_stop");
    return Object.freeze({
      stationId: proposal.stationId,
      proposalId: proposal.id,
      category,
      execution: "unavailable",
      cleanup: "not_started",
      automaticRetry: false,
      automaticRollback: false,
      nextAction: "owner_decision_required",
    });
  }
}

/** Reusable local fixture limits; this does not configure a sandbox. */
export const M3_STAGING_PROPOSAL_LIMITS = M3_PROCESSING_LIMITS;

function hasExactly<T>(actual: readonly T[], expected: readonly T[]): boolean {
  return (
    actual.length === expected.length &&
    expected.every((item) => actual.includes(item))
  );
}

function scopedKey(stationId: StableId, id: StableId): string {
  return `${stationId}\u0000${id}`;
}
