import type { ApplicationRole } from "../domain/programming.js";
import type { StableId, UtcTimestamp } from "../domain/contracts.js";
import { validateOpaqueReference } from "../domain/m3-assets.js";
import type {
  M4ProposedSchedule,
  M4ScheduleApprovalRecord,
} from "./m4-schedule-approval-boundary.js";

export interface M4PublicationCompatibilityCheck {
  id: StableId;
  stationId: StableId;
  proposalId: StableId;
  approvalId: StableId;
  previewId: StableId;
  state: "compatible" | "incompatible";
}

export interface M4PublicationCandidate {
  proposal: M4ProposedSchedule;
  approval: M4ScheduleApprovalRecord;
  compatibility: M4PublicationCompatibilityCheck;
}

/** A trusted, token-free assertion from a future CSRF/session boundary. */
export interface M4SchedulePublicationAuthorization {
  publisherId: StableId;
  role: ApplicationRole;
  assignedStationIds: readonly StableId[];
  csrf: "validated";
}

export interface M4SchedulePublicationRequest {
  id: StableId;
  authorization: M4SchedulePublicationAuthorization;
  publishedAt: UtcTimestamp;
}

export interface M4ScheduleRollbackRequest {
  id: StableId;
  authorization: M4SchedulePublicationAuthorization;
  rolledBackAt: UtcTimestamp;
}

export interface M4PublishedScheduleVersion {
  id: StableId;
  stationId: StableId;
  version: number;
  proposalId: StableId;
  approvalId: StableId;
  previewId: StableId;
  assignments: readonly { slotId: StableId; candidateId: StableId }[];
  publication: "published_versioned";
  execution: "unavailable";
}

export interface M4SchedulePublicationEvidence {
  action: "m4.schedule_published";
  stationId: StableId;
  publicationId: StableId;
  versionId: StableId;
  proposalId: StableId;
  category: "published_atomically";
}

export interface M4SchedulePublicationRecord {
  id: StableId;
  stationId: StableId;
  version: M4PublishedScheduleVersion;
  publisherId: StableId;
  publishedAt: UtcTimestamp;
  evidence: M4SchedulePublicationEvidence;
}

export interface M4ActivePublishedSchedule {
  stationId: StableId;
  versionId: StableId;
  version: number;
  state: "published";
  execution: "unavailable";
}

export interface M4ScheduleRollbackEvidence {
  action: "m4.schedule_rolled_back";
  stationId: StableId;
  rollbackId: StableId;
  fromVersionId: StableId;
  toVersionId: StableId;
  category: "active_pointer_rolled_back";
}

export interface M4ScheduleRollbackRecord {
  id: StableId;
  stationId: StableId;
  fromVersionId: StableId;
  toVersionId: StableId;
  publisherId: StableId;
  rolledBackAt: UtcTimestamp;
  execution: "unavailable";
  evidence: M4ScheduleRollbackEvidence;
}

/**
 * M4.7's local-only versioning model. It preserves immutable fixture artifacts
 * and updates only an in-memory active-version pointer after all validation
 * succeeds. It has no database, route, dispatch, or runtime consumer.
 */
export class M4SchedulePublicationBoundary {
  private readonly candidates = new Map<string, M4PublicationCandidate>();
  private readonly publications = new Map<
    string,
    M4SchedulePublicationRecord
  >();
  private readonly publicationByProposal = new Map<
    string,
    M4SchedulePublicationRecord
  >();
  private readonly versions = new Map<string, M4PublishedScheduleVersion>();
  private readonly active = new Map<string, M4ActivePublishedSchedule>();
  private readonly rollbacks = new Map<string, M4ScheduleRollbackRecord>();
  private readonly nextVersion = new Map<string, number>();

  public constructor(candidates: readonly M4PublicationCandidate[]) {
    for (const candidate of candidates) this.addCandidate(candidate);
  }

  /**
   * Creates a permanent version and atomically changes the active pointer only
   * after compatibility and authorization validation have completed.
   */
  publish(
    stationId: StableId,
    proposalId: StableId,
    request: M4SchedulePublicationRequest,
  ): M4SchedulePublicationRecord {
    validateOpaqueReference(stationId);
    validateOpaqueReference(proposalId);
    validatePublicationRequest(request);
    const candidate = this.candidates.get(scopedKey(stationId, proposalId));
    if (!candidate) throw new Error("not_found");
    assertPublicationAuthorization(stationId, request.authorization);

    const existingByRequest = this.publications.get(
      scopedKey(stationId, request.id),
    );
    if (existingByRequest) {
      if (existingByRequest.version.proposalId !== proposalId)
        throw new Error("publication_id_reused");
      return existingByRequest;
    }
    if (this.publicationByProposal.has(scopedKey(stationId, proposalId)))
      throw new Error("proposal_already_published");
    if (candidate.compatibility.state !== "compatible")
      throw new Error("compatibility_failed");

    const versionNumber = this.nextVersion.get(stationId) ?? 1;
    const version = freezeVersion({
      id: `published:${stationId}:${versionNumber}`,
      stationId,
      version: versionNumber,
      proposalId: candidate.proposal.id,
      approvalId: candidate.approval.id,
      previewId: candidate.proposal.preview.id,
      assignments: candidate.proposal.preview.assignments,
      publication: "published_versioned",
      execution: "unavailable",
    });
    const record = freezePublication({
      id: `publication:${candidate.proposal.id}:${request.id}`,
      stationId,
      version,
      publisherId: request.authorization.publisherId,
      publishedAt: request.publishedAt,
      evidence: {
        action: "m4.schedule_published",
        stationId,
        publicationId: request.id,
        versionId: version.id,
        proposalId: candidate.proposal.id,
        category: "published_atomically",
      },
    });
    const active = freezeActive(version);

    this.versions.set(scopedKey(stationId, version.id), version);
    this.publications.set(scopedKey(stationId, request.id), record);
    this.publicationByProposal.set(scopedKey(stationId, proposalId), record);
    this.active.set(stationId, active);
    this.nextVersion.set(stationId, versionNumber + 1);
    return record;
  }

  /** Changes only the active pointer; neither historical version is mutated. */
  rollback(
    stationId: StableId,
    targetVersionId: StableId,
    request: M4ScheduleRollbackRequest,
  ): M4ScheduleRollbackRecord {
    validateOpaqueReference(stationId);
    validateOpaqueReference(targetVersionId);
    validateRollbackRequest(request);
    assertPublicationAuthorization(stationId, request.authorization);
    const target = this.versions.get(scopedKey(stationId, targetVersionId));
    if (!target) throw new Error("not_found");
    const current = this.active.get(stationId);
    if (!current) throw new Error("no_active_published_version");

    const existing = this.rollbacks.get(scopedKey(stationId, request.id));
    if (existing) {
      if (existing.toVersionId !== targetVersionId)
        throw new Error("rollback_id_reused");
      return existing;
    }
    if (current.versionId === targetVersionId)
      throw new Error("rollback_target_already_active");

    const record = freezeRollback({
      id: `rollback:${current.versionId}:${targetVersionId}:${request.id}`,
      stationId,
      fromVersionId: current.versionId,
      toVersionId: targetVersionId,
      publisherId: request.authorization.publisherId,
      rolledBackAt: request.rolledBackAt,
      execution: "unavailable",
      evidence: {
        action: "m4.schedule_rolled_back",
        stationId,
        rollbackId: request.id,
        fromVersionId: current.versionId,
        toVersionId: targetVersionId,
        category: "active_pointer_rolled_back",
      },
    });
    this.rollbacks.set(scopedKey(stationId, request.id), record);
    this.active.set(stationId, freezeActive(target));
    return record;
  }

  activeVersion(stationId: StableId): M4ActivePublishedSchedule {
    validateOpaqueReference(stationId);
    const active = this.active.get(stationId);
    if (!active) throw new Error("not_found");
    return active;
  }

  version(
    stationId: StableId,
    versionId: StableId,
  ): M4PublishedScheduleVersion {
    validateOpaqueReference(stationId);
    validateOpaqueReference(versionId);
    const version = this.versions.get(scopedKey(stationId, versionId));
    if (!version) throw new Error("not_found");
    return version;
  }

  /** Trusted internal callers receive precise cross-station relationship errors. */
  assertCandidateOwnership(
    stationId: StableId,
    candidate: M4PublicationCandidate,
  ): void {
    if (candidate.proposal.stationId !== stationId)
      throw new Error("station_reference_forbidden");
    validateCandidate(candidate);
  }

  private addCandidate(candidate: M4PublicationCandidate): void {
    validateCandidate(candidate);
    const key = scopedKey(candidate.proposal.stationId, candidate.proposal.id);
    if (this.candidates.has(key))
      throw new Error("duplicate_publication_candidate");
    this.candidates.set(key, freezeCandidate(candidate));
  }
}

function validateCandidate(candidate: M4PublicationCandidate): void {
  validateProposal(candidate.proposal);
  validateApproval(candidate.approval);
  const { proposal, approval, compatibility } = candidate;
  validateOpaqueReference(compatibility.id);
  validateOpaqueReference(compatibility.stationId);
  validateOpaqueReference(compatibility.proposalId);
  validateOpaqueReference(compatibility.approvalId);
  validateOpaqueReference(compatibility.previewId);
  if (
    approval.stationId !== proposal.stationId ||
    approval.proposalId !== proposal.id ||
    approval.previewId !== proposal.preview.id ||
    approval.decision !== "approved" ||
    compatibility.stationId !== proposal.stationId ||
    compatibility.proposalId !== proposal.id ||
    compatibility.approvalId !== approval.id ||
    compatibility.previewId !== proposal.preview.id
  )
    throw new Error("station_reference_forbidden");
}

function validateProposal(proposal: M4ProposedSchedule): void {
  validateOpaqueReference(proposal.id);
  validateOpaqueReference(proposal.stationId);
  const preview = proposal.preview;
  validateOpaqueReference(preview.id);
  validateOpaqueReference(preview.stationId);
  if (
    preview.stationId !== proposal.stationId ||
    preview.status !== "complete" ||
    preview.execution !== "unavailable" ||
    preview.assignments.length !== preview.evidence.assignmentCount ||
    preview.assignments.length !== preview.evidence.slotCount
  )
    throw new Error("proposal_not_publishable");
  for (const assignment of preview.assignments) {
    validateOpaqueReference(assignment.slotId);
    validateOpaqueReference(assignment.candidateId);
  }
}

function validateApproval(record: M4ScheduleApprovalRecord): void {
  validateOpaqueReference(record.id);
  validateOpaqueReference(record.stationId);
  validateOpaqueReference(record.proposalId);
  validateOpaqueReference(record.previewId);
  validateOpaqueReference(record.reviewerId);
  if (
    record.publication !== "not_published" ||
    record.execution !== "unavailable" ||
    !isUtcTimestamp(record.reviewedAt)
  )
    throw new Error("invalid_schedule_approval");
}

function validatePublicationRequest(
  request: M4SchedulePublicationRequest,
): void {
  validateOpaqueReference(request.id);
  validateAuthorization(request.authorization);
  if (!isUtcTimestamp(request.publishedAt))
    throw new Error("invalid_publish_time");
}

function validateRollbackRequest(request: M4ScheduleRollbackRequest): void {
  validateOpaqueReference(request.id);
  validateAuthorization(request.authorization);
  if (!isUtcTimestamp(request.rolledBackAt))
    throw new Error("invalid_rollback_time");
}

function validateAuthorization(
  authorization: M4SchedulePublicationAuthorization,
): void {
  validateOpaqueReference(authorization.publisherId);
  if (authorization.csrf !== "validated") throw new Error("csrf_rejected");
  if (authorization.role !== "owner" && authorization.role !== "administrator")
    throw new Error("forbidden");
  for (const stationId of authorization.assignedStationIds)
    validateOpaqueReference(stationId);
}

function assertPublicationAuthorization(
  stationId: StableId,
  authorization: M4SchedulePublicationAuthorization,
): void {
  if (
    authorization.role !== "owner" &&
    !authorization.assignedStationIds.includes(stationId)
  )
    throw new Error("not_found");
}

function isUtcTimestamp(value: string): value is UtcTimestamp {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value);
}

function freezeCandidate(
  candidate: M4PublicationCandidate,
): M4PublicationCandidate {
  return Object.freeze({
    proposal: Object.freeze({
      ...candidate.proposal,
      preview: Object.freeze({
        ...candidate.proposal.preview,
        assignments: Object.freeze(
          candidate.proposal.preview.assignments.map((assignment) =>
            Object.freeze({ ...assignment }),
          ),
        ),
        conflicts: Object.freeze(
          candidate.proposal.preview.conflicts.map((conflict) =>
            Object.freeze({ ...conflict }),
          ),
        ),
        evidence: Object.freeze({ ...candidate.proposal.preview.evidence }),
      }),
    }),
    approval: Object.freeze({
      ...candidate.approval,
      evidence: Object.freeze({ ...candidate.approval.evidence }),
    }),
    compatibility: Object.freeze({ ...candidate.compatibility }),
  });
}

function freezeVersion(
  version: M4PublishedScheduleVersion,
): M4PublishedScheduleVersion {
  return Object.freeze({
    ...version,
    assignments: Object.freeze(
      version.assignments.map((assignment) => Object.freeze({ ...assignment })),
    ),
  });
}

function freezePublication(
  record: M4SchedulePublicationRecord,
): M4SchedulePublicationRecord {
  return Object.freeze({
    ...record,
    evidence: Object.freeze({ ...record.evidence }),
  });
}

function freezeActive(
  version: M4PublishedScheduleVersion,
): M4ActivePublishedSchedule {
  return Object.freeze({
    stationId: version.stationId,
    versionId: version.id,
    version: version.version,
    state: "published",
    execution: "unavailable",
  });
}

function freezeRollback(
  record: M4ScheduleRollbackRecord,
): M4ScheduleRollbackRecord {
  return Object.freeze({
    ...record,
    evidence: Object.freeze({ ...record.evidence }),
  });
}

function scopedKey(stationId: StableId, id: StableId): string {
  return `${stationId}\u0000${id}`;
}
