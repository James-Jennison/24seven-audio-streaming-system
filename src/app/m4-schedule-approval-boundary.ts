import type { ApplicationRole } from "../domain/programming.js";
import type { StableId, UtcTimestamp } from "../domain/contracts.js";
import { validateOpaqueReference } from "../domain/m3-assets.js";
import type { M4DryRunPreview } from "./m4-dry-run-preview-boundary.js";

export interface M4ProposedSchedule {
  id: StableId;
  stationId: StableId;
  preview: M4DryRunPreview;
}

/** A trusted, token-free assertion from a future CSRF/session boundary. */
export interface M4ScheduleReviewAuthorization {
  reviewerId: StableId;
  role: ApplicationRole;
  assignedStationIds: readonly StableId[];
  csrf: "validated";
}

export interface M4ScheduleReviewRequest {
  id: StableId;
  authorization: M4ScheduleReviewAuthorization;
  decision: "approved" | "rejected";
  reviewedAt: UtcTimestamp;
}

export interface M4ScheduleApprovalEvidence {
  action: "m4.schedule_proposal_reviewed";
  stationId: StableId;
  proposalId: StableId;
  previewId: StableId;
  reviewId: StableId;
  decision: "approved" | "rejected";
  category: "proposal_approved" | "proposal_rejected";
}

/** An append-only local decision record; it is neither publication nor execution. */
export interface M4ScheduleApprovalRecord {
  id: StableId;
  stationId: StableId;
  proposalId: StableId;
  previewId: StableId;
  reviewerId: StableId;
  decision: "approved" | "rejected";
  reviewedAt: UtcTimestamp;
  rework: "not_required" | "new_proposal_required";
  publication: "not_published";
  execution: "unavailable";
  evidence: M4ScheduleApprovalEvidence;
}

/**
 * M4.6's local-only approval boundary. It stores frozen fixture decisions in
 * memory only; it has no route, session/token handling, persistence, or
 * publication/runtime adapter.
 */
export class M4ScheduleApprovalBoundary {
  private readonly proposals = new Map<string, M4ProposedSchedule>();
  private readonly decisions = new Map<string, M4ScheduleApprovalRecord>();
  private readonly decisionByProposal = new Map<
    string,
    M4ScheduleApprovalRecord
  >();

  public constructor(proposals: readonly M4ProposedSchedule[]) {
    for (const proposal of proposals) this.addProposal(proposal);
  }

  /**
   * Approves or rejects one complete immutable proposal. Repeating the same
   * review ID returns its original append-only decision; a new review ID may
   * not alter an already reviewed proposal.
   */
  decide(
    stationId: StableId,
    proposalId: StableId,
    request: M4ScheduleReviewRequest,
  ): M4ScheduleApprovalRecord {
    validateOpaqueReference(stationId);
    validateOpaqueReference(proposalId);
    validateReviewRequest(request);
    const proposal = this.proposals.get(scopedKey(stationId, proposalId));
    if (!proposal) throw new Error("not_found");
    assertReviewAuthorization(stationId, request.authorization);

    const existingByReview = this.decisions.get(
      scopedKey(stationId, request.id),
    );
    if (existingByReview) {
      if (existingByReview.proposalId !== proposalId)
        throw new Error("review_id_reused");
      return existingByReview;
    }
    if (this.decisionByProposal.has(scopedKey(stationId, proposalId)))
      throw new Error("proposal_already_reviewed");

    const record = freezeRecord({
      id: `approval:${proposal.id}:${request.id}`,
      stationId,
      proposalId: proposal.id,
      previewId: proposal.preview.id,
      reviewerId: request.authorization.reviewerId,
      decision: request.decision,
      reviewedAt: request.reviewedAt,
      rework:
        request.decision === "approved"
          ? "not_required"
          : "new_proposal_required",
      publication: "not_published",
      execution: "unavailable",
      evidence: {
        action: "m4.schedule_proposal_reviewed",
        stationId,
        proposalId: proposal.id,
        previewId: proposal.preview.id,
        reviewId: request.id,
        decision: request.decision,
        category:
          request.decision === "approved"
            ? "proposal_approved"
            : "proposal_rejected",
      },
    });
    this.decisions.set(scopedKey(stationId, request.id), record);
    this.decisionByProposal.set(scopedKey(stationId, proposalId), record);
    return record;
  }

  /** Public station-scoped lookup hides records owned by another station. */
  review(stationId: StableId, reviewId: StableId): M4ScheduleApprovalRecord {
    validateOpaqueReference(stationId);
    validateOpaqueReference(reviewId);
    const record = this.decisions.get(scopedKey(stationId, reviewId));
    if (!record) throw new Error("not_found");
    return record;
  }

  /** Trusted internal callers must preserve station ownership of a proposal. */
  assertProposalOwnership(
    stationId: StableId,
    proposal: M4ProposedSchedule,
  ): void {
    if (stationId !== proposal.stationId)
      throw new Error("station_reference_forbidden");
    validateProposal(proposal);
  }

  /** Trusted authorization assertions must not cross a station boundary. */
  assertAuthorizationScope(
    stationId: StableId,
    authorization: M4ScheduleReviewAuthorization,
  ): void {
    validateAuthorization(authorization);
    if (
      authorization.role !== "owner" &&
      !authorization.assignedStationIds.includes(stationId)
    )
      throw new Error("station_reference_forbidden");
  }

  private addProposal(proposal: M4ProposedSchedule): void {
    validateProposal(proposal);
    const key = scopedKey(proposal.stationId, proposal.id);
    if (this.proposals.has(key)) throw new Error("duplicate_schedule_proposal");
    this.proposals.set(key, freezeProposal(proposal));
  }
}

function validateProposal(proposal: M4ProposedSchedule): void {
  validateOpaqueReference(proposal.id);
  validateOpaqueReference(proposal.stationId);
  validatePreview(proposal.preview);
  if (proposal.preview.stationId !== proposal.stationId)
    throw new Error("station_reference_forbidden");
}

function validatePreview(preview: M4DryRunPreview): void {
  validateOpaqueReference(preview.id);
  validateOpaqueReference(preview.stationId);
  validateOpaqueReference(preview.dayInputId);
  validateOpaqueReference(preview.requestId);
  if (
    preview.status !== "complete" ||
    preview.execution !== "unavailable" ||
    preview.evidence.previewId !== preview.id ||
    preview.evidence.stationId !== preview.stationId ||
    preview.evidence.status !== "complete" ||
    preview.evidence.category !== "preview_complete" ||
    preview.assignments.length !== preview.evidence.slotCount ||
    preview.assignments.length !== preview.evidence.assignmentCount
  )
    throw new Error("proposal_not_approvable");
  for (const assignment of preview.assignments) {
    validateOpaqueReference(assignment.slotId);
    validateOpaqueReference(assignment.candidateId);
  }
}

function validateReviewRequest(request: M4ScheduleReviewRequest): void {
  validateOpaqueReference(request.id);
  validateAuthorization(request.authorization);
  if (!isUtcTimestamp(request.reviewedAt))
    throw new Error("invalid_review_time");
  if (request.decision !== "approved" && request.decision !== "rejected")
    throw new Error("invalid_review_decision");
}

function validateAuthorization(
  authorization: M4ScheduleReviewAuthorization,
): void {
  validateOpaqueReference(authorization.reviewerId);
  if (authorization.csrf !== "validated") throw new Error("csrf_rejected");
  if (!canReview(authorization.role)) throw new Error("forbidden");
  for (const stationId of authorization.assignedStationIds)
    validateOpaqueReference(stationId);
}

function assertReviewAuthorization(
  stationId: StableId,
  authorization: M4ScheduleReviewAuthorization,
): void {
  if (
    authorization.role !== "owner" &&
    !authorization.assignedStationIds.includes(stationId)
  )
    throw new Error("not_found");
}

function canReview(role: ApplicationRole): boolean {
  return role === "owner" || role === "administrator" || role === "programmer";
}

function isUtcTimestamp(value: string): value is UtcTimestamp {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value);
}

function freezeProposal(proposal: M4ProposedSchedule): M4ProposedSchedule {
  return Object.freeze({
    ...proposal,
    preview: freezePreview(proposal.preview),
  });
}

function freezePreview(preview: M4DryRunPreview): M4DryRunPreview {
  return Object.freeze({
    ...preview,
    assignments: Object.freeze(
      preview.assignments.map((assignment) => Object.freeze({ ...assignment })),
    ),
    conflicts: Object.freeze(
      preview.conflicts.map((conflict) => Object.freeze({ ...conflict })),
    ),
    evidence: Object.freeze({ ...preview.evidence }),
  });
}

function freezeRecord(
  record: M4ScheduleApprovalRecord,
): M4ScheduleApprovalRecord {
  return Object.freeze({
    ...record,
    evidence: Object.freeze({ ...record.evidence }),
  });
}

function scopedKey(stationId: StableId, id: StableId): string {
  return `${stationId}\u0000${id}`;
}
