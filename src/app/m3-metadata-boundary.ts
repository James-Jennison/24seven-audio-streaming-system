import { validateOpaqueReference } from "../domain/m3-assets.js";
import {
  M3_PROCESSING_LIMITS,
  type ApprovedProcessingJobReference,
  validateApprovedProcessingJobReference,
} from "./m3-processing-boundary.js";

export type MetadataEnrichmentProfile = "metadata-fixture-v1";
export type MetadataProviderCategory =
  | "deterministic_fixture"
  | "musicbrainz_compatible";
export type MetadataAvailability =
  | "fixture_preview_available"
  | "unavailable"
  | "quarantined";
export type MetadataConfidenceCategory = "low" | "medium" | "high";
export type MetadataResolutionState =
  | "pending"
  | "approved"
  | "rejected"
  | "superseded";
export type MetadataFailureCategory =
  | "unsupported_profile"
  | "provider_disabled"
  | "job_ineligible"
  | "retry_not_eligible"
  | "candidate_quarantined"
  | "internal_boundary";
export type MetadataRetryEligibility =
  | "not_eligible"
  | "requires_explicit_authorized_retry";

/** Opaque request only; it cannot carry provider payloads or media/tag data. */
export interface MetadataEnrichmentRequest {
  id: string;
  stationId: string;
  idempotencyKey: string;
  processingJob: ApprovedProcessingJobReference;
  assetRevisionId: string;
  profile: MetadataEnrichmentProfile;
  providerCategory: MetadataProviderCategory;
  providerVersion: string;
  analysisVersion: string;
  retryAttempt: number;
  requestedAt: string;
}

/** A content-free candidate for later review, never an asset metadata update. */
export interface MetadataCandidateRecord {
  id: string;
  stationId: string;
  requestId: string;
  jobId: string;
  assetRevisionId: string;
  profile: MetadataEnrichmentProfile;
  providerCategory: "deterministic_fixture";
  providerVersion: string;
  provenanceReference: string;
  availability: "fixture_preview_available";
  confidence: number;
  confidenceCategory: MetadataConfidenceCategory;
  resolutionState: "pending";
  enrichmentPerformed: false;
  createdAt: string;
}

export interface MetadataEnrichmentOutcome {
  id: string;
  stationId: string;
  requestId: string;
  jobId: string;
  assetRevisionId: string;
  /** Safe declared profile retained even when it is unsupported. */
  profile: string;
  providerCategory: MetadataProviderCategory;
  availability: MetadataAvailability;
  source: "deterministic_fixture" | "none";
  candidateIds: readonly string[];
  failureCategory?: MetadataFailureCategory;
  retryEligibility: MetadataRetryEligibility;
  retryAttempt: number;
  enrichmentPerformed: false;
  createdAt: string;
}

/** Append-only operator decision; it never changes the immutable candidate. */
export interface MetadataResolutionRecord {
  id: string;
  stationId: string;
  candidateId: string;
  idempotencyKey: string;
  operatorId: string;
  priorState: "pending";
  resolutionState: Exclude<MetadataResolutionState, "pending">;
  recordedAt: string;
}

/** Append-only no-dispatch record for a future, explicitly authorized retry. */
export interface MetadataRetryRecord {
  id: string;
  stationId: string;
  outcomeId: string;
  jobId: string;
  eligibility: "requires_explicit_authorized_retry";
  boundaryState: "disabled";
  occurredAt: string;
}

export interface MetadataEvidence {
  action:
    | "m3.metadata_previewed"
    | "m3.metadata_declined"
    | "m3.metadata_resolution_recorded"
    | "m3.metadata_retry_eligible";
  stationId: string;
  entityId: string;
  profile: string;
  providerCategory: MetadataProviderCategory;
  category:
    | "fixture_preview"
    | MetadataFailureCategory
    | MetadataResolutionState;
  safeCount: number;
  occurredAt: string;
}

export function validateMetadataEnrichmentRequest(
  request: MetadataEnrichmentRequest,
): void {
  [
    request.id,
    request.stationId,
    request.idempotencyKey,
    request.assetRevisionId,
    request.profile,
    request.providerVersion,
    request.analysisVersion,
  ].forEach(validateOpaqueReference);
  if (request.profile !== "metadata-fixture-v1")
    throw new Error("unsupported_metadata_profile");
  if (
    !["deterministic_fixture", "musicbrainz_compatible"].includes(
      request.providerCategory,
    )
  )
    throw new Error("unsupported_metadata_provider");
  if (request.stationId !== request.processingJob.stationId)
    throw new Error("station_reference_forbidden");
  if (request.assetRevisionId !== request.processingJob.assetRevisionId)
    throw new Error("station_reference_forbidden");
  if (
    !Number.isInteger(request.retryAttempt) ||
    request.retryAttempt < 0 ||
    request.retryAttempt > M3_PROCESSING_LIMITS.maxRetryAttempts
  )
    throw new Error("retry_not_eligible");
  validateApprovedProcessingJobReference(request.processingJob);
}

export function validateMetadataCandidateRecord(
  candidate: MetadataCandidateRecord,
): void {
  [
    candidate.id,
    candidate.stationId,
    candidate.requestId,
    candidate.jobId,
    candidate.assetRevisionId,
    candidate.providerVersion,
    candidate.provenanceReference,
  ].forEach(validateOpaqueReference);
  if (
    candidate.profile !== "metadata-fixture-v1" ||
    candidate.providerCategory !== "deterministic_fixture" ||
    candidate.availability !== "fixture_preview_available" ||
    candidate.resolutionState !== "pending" ||
    candidate.enrichmentPerformed !== false ||
    !Number.isFinite(candidate.confidence) ||
    candidate.confidence < 0 ||
    candidate.confidence > 1 ||
    confidenceCategoryFor(candidate.confidence) !== candidate.confidenceCategory
  )
    throw new Error("invalid_metadata_candidate");
}

export function validateMetadataEnrichmentOutcome(
  outcome: MetadataEnrichmentOutcome,
): void {
  [
    outcome.id,
    outcome.stationId,
    outcome.requestId,
    outcome.jobId,
    outcome.assetRevisionId,
    outcome.profile,
    ...outcome.candidateIds,
  ].forEach(validateOpaqueReference);
  if (
    !["deterministic_fixture", "musicbrainz_compatible"].includes(
      outcome.providerCategory,
    ) ||
    outcome.enrichmentPerformed !== false ||
    !Number.isInteger(outcome.retryAttempt) ||
    outcome.retryAttempt < 0 ||
    outcome.retryAttempt > M3_PROCESSING_LIMITS.maxRetryAttempts
  )
    throw new Error("invalid_metadata_outcome");
  if (outcome.availability === "fixture_preview_available") {
    if (
      outcome.source !== "deterministic_fixture" ||
      outcome.candidateIds.length !== 1 ||
      outcome.failureCategory ||
      outcome.retryEligibility !== "not_eligible" ||
      outcome.providerCategory !== "deterministic_fixture"
    )
      throw new Error("invalid_metadata_outcome");
    return;
  }
  if (
    outcome.source !== "none" ||
    outcome.candidateIds.length !== 0 ||
    !outcome.failureCategory
  )
    throw new Error("invalid_metadata_outcome");
  if (
    outcome.availability === "quarantined" &&
    (outcome.failureCategory !== "candidate_quarantined" ||
      outcome.retryEligibility !== "requires_explicit_authorized_retry")
  )
    throw new Error("invalid_metadata_outcome");
}

export function validateMetadataResolutionRecord(
  record: MetadataResolutionRecord,
): void {
  [
    record.id,
    record.stationId,
    record.candidateId,
    record.idempotencyKey,
    record.operatorId,
  ].forEach(validateOpaqueReference);
  if (
    record.priorState !== "pending" ||
    !["approved", "rejected", "superseded"].includes(record.resolutionState)
  )
    throw new Error("invalid_metadata_resolution");
}

/**
 * Disabled deterministic fixture boundary. It has no filesystem, tag parser,
 * network, provider, worker, or downstream-plane capability.
 */
export class DisabledMetadataEnrichmentBoundary {
  private readonly jobs = new Map<string, ApprovedProcessingJobReference>();
  private readonly outcomes = new Map<string, MetadataEnrichmentOutcome>();
  private readonly outcomesById = new Map<string, MetadataEnrichmentOutcome>();
  private readonly candidates = new Map<string, MetadataCandidateRecord>();
  private readonly resolutions = new Map<string, MetadataResolutionRecord>();
  private readonly resolutionsByCandidate = new Map<
    string,
    MetadataResolutionRecord
  >();
  private readonly retries = new Map<string, MetadataRetryRecord>();
  private readonly evidence: MetadataEvidence[] = [];

  public constructor(jobs: readonly ApprovedProcessingJobReference[]) {
    for (const job of jobs) {
      validateApprovedProcessingJobReference(job);
      const key = scoped(job.stationId, job.id);
      if (this.jobs.has(key)) throw new Error("duplicate_processing_job");
      this.jobs.set(key, Object.freeze({ ...job }));
    }
  }

  status(
    stationId: string,
    jobId: string,
  ): { stationId: string; jobId: string; availability: "disabled" } {
    if (!this.jobs.has(scoped(stationId, jobId))) throw new Error("not_found");
    return { stationId, jobId, availability: "disabled" };
  }

  preview(request: MetadataEnrichmentRequest): MetadataEnrichmentOutcome {
    const key = scoped(request.stationId, request.idempotencyKey);
    const existing = this.outcomes.get(key);
    if (existing) {
      if (
        existing.assetRevisionId !== request.assetRevisionId ||
        existing.jobId !== request.processingJob.id ||
        existing.profile !== request.profile ||
        existing.providerCategory !== request.providerCategory ||
        existing.retryAttempt !== request.retryAttempt
      )
        throw new Error("idempotency_conflict");
      return existing;
    }
    try {
      validateMetadataEnrichmentRequest(request);
      const stored = this.jobs.get(
        scoped(request.stationId, request.processingJob.id),
      );
      if (!stored) throw new Error("not_found");
      if (stored.assetRevisionId !== request.assetRevisionId)
        throw new Error("station_reference_forbidden");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "internal_boundary";
      if (
        [
          "not_found",
          "station_reference_forbidden",
          "idempotency_conflict",
          "invalid_opaque_reference",
          "unsupported_metadata_provider",
        ].includes(message)
      )
        throw error;
      return this.decline(request, key, categoryFor(message));
    }
    if (request.providerCategory !== "deterministic_fixture")
      return this.decline(request, key, "provider_disabled");

    const candidate: MetadataCandidateRecord = Object.freeze({
      id: `${request.id}:candidate`,
      stationId: request.stationId,
      requestId: request.id,
      jobId: request.processingJob.id,
      assetRevisionId: request.assetRevisionId,
      profile: request.profile,
      providerCategory: "deterministic_fixture",
      providerVersion: request.providerVersion,
      provenanceReference: "metadata-fixture-v1",
      availability: "fixture_preview_available",
      confidence: 0.8,
      confidenceCategory: "high" as const,
      resolutionState: "pending",
      enrichmentPerformed: false,
      createdAt: request.requestedAt,
    });
    validateMetadataCandidateRecord(candidate);
    const outcome: MetadataEnrichmentOutcome = Object.freeze({
      id: request.id,
      stationId: request.stationId,
      requestId: request.id,
      jobId: request.processingJob.id,
      assetRevisionId: request.assetRevisionId,
      profile: request.profile,
      providerCategory: request.providerCategory,
      availability: "fixture_preview_available",
      source: "deterministic_fixture",
      candidateIds: Object.freeze([candidate.id]),
      retryEligibility: "not_eligible",
      retryAttempt: request.retryAttempt,
      enrichmentPerformed: false,
      createdAt: request.requestedAt,
    });
    validateMetadataEnrichmentOutcome(outcome);
    this.candidates.set(scoped(candidate.stationId, candidate.id), candidate);
    this.storeOutcome(key, outcome);
    this.evidence.push(
      Object.freeze({
        action: "m3.metadata_previewed",
        stationId: request.stationId,
        entityId: request.processingJob.id,
        profile: request.profile,
        providerCategory: request.providerCategory,
        category: "fixture_preview",
        safeCount: 1,
        occurredAt: request.requestedAt,
      }),
    );
    return outcome;
  }

  /** Public scoped lookup intentionally hides a candidate owned by another station. */
  readCandidate(
    stationId: string,
    candidateId: string,
  ): MetadataCandidateRecord {
    const candidate = this.candidates.get(scoped(stationId, candidateId));
    if (!candidate) throw new Error("not_found");
    return candidate;
  }

  /** Internal relationship validation exposes an explicit cross-station error. */
  assertCandidateOwnership(
    stationId: string,
    candidate: MetadataCandidateRecord,
  ): void {
    if (stationId !== candidate.stationId)
      throw new Error("station_reference_forbidden");
    validateMetadataCandidateRecord(candidate);
  }

  resolve(record: MetadataResolutionRecord): MetadataResolutionRecord {
    validateMetadataResolutionRecord(record);
    const candidate = this.candidates.get(
      scoped(record.stationId, record.candidateId),
    );
    if (!candidate) throw new Error("not_found");
    this.assertCandidateOwnership(record.stationId, candidate);
    const idempotencyKey = scoped(record.stationId, record.idempotencyKey);
    const existing = this.resolutions.get(idempotencyKey);
    if (existing) {
      if (
        existing.candidateId !== record.candidateId ||
        existing.resolutionState !== record.resolutionState ||
        existing.operatorId !== record.operatorId
      )
        throw new Error("idempotency_conflict");
      return existing;
    }
    if (
      this.resolutionsByCandidate.has(
        scoped(record.stationId, record.candidateId),
      )
    )
      throw new Error("invalid_metadata_resolution_transition");
    const immutable = Object.freeze({ ...record });
    this.resolutions.set(idempotencyKey, immutable);
    this.resolutionsByCandidate.set(
      scoped(record.stationId, record.candidateId),
      immutable,
    );
    this.evidence.push(
      Object.freeze({
        action: "m3.metadata_resolution_recorded",
        stationId: record.stationId,
        entityId: record.candidateId,
        profile: candidate.profile,
        providerCategory: candidate.providerCategory,
        category: record.resolutionState,
        safeCount: 1,
        occurredAt: record.recordedAt,
      }),
    );
    return immutable;
  }

  readResolution(
    stationId: string,
    candidateId: string,
  ): MetadataResolutionRecord | undefined {
    this.readCandidate(stationId, candidateId);
    return this.resolutionsByCandidate.get(scoped(stationId, candidateId));
  }

  recordRetry(
    record: MetadataRetryRecord,
    outcome: MetadataEnrichmentOutcome,
  ): MetadataRetryRecord {
    [record.id, record.stationId, record.outcomeId, record.jobId].forEach(
      validateOpaqueReference,
    );
    if (
      record.stationId !== outcome.stationId ||
      record.outcomeId !== outcome.id ||
      record.jobId !== outcome.jobId
    )
      throw new Error("station_reference_forbidden");
    if (
      record.eligibility !== "requires_explicit_authorized_retry" ||
      record.boundaryState !== "disabled" ||
      !["unavailable", "quarantined"].includes(outcome.availability) ||
      outcome.retryEligibility !== "requires_explicit_authorized_retry"
    )
      throw new Error("recovery_not_eligible");
    validateMetadataEnrichmentOutcome(outcome);
    if (!this.outcomesById.has(scoped(record.stationId, record.outcomeId)))
      throw new Error("not_found");
    const key = scoped(record.stationId, record.outcomeId);
    const existing = this.retries.get(key);
    if (existing) {
      if (existing.id !== record.id) throw new Error("idempotency_conflict");
      return existing;
    }
    const immutable = Object.freeze({ ...record });
    this.retries.set(key, immutable);
    this.evidence.push(
      Object.freeze({
        action: "m3.metadata_retry_eligible",
        stationId: record.stationId,
        entityId: record.jobId,
        profile: outcome.profile,
        providerCategory: outcome.providerCategory,
        category: outcome.failureCategory ?? "internal_boundary",
        safeCount: 1,
        occurredAt: record.occurredAt,
      }),
    );
    return immutable;
  }

  readEvidence(stationId: string): readonly MetadataEvidence[] {
    return this.evidence.filter((entry) => entry.stationId === stationId);
  }

  private decline(
    request: MetadataEnrichmentRequest,
    key: string,
    category: MetadataFailureCategory,
  ): MetadataEnrichmentOutcome {
    const outcome: MetadataEnrichmentOutcome = Object.freeze({
      id: request.id,
      stationId: request.stationId,
      requestId: request.id,
      jobId: request.processingJob.id,
      assetRevisionId: request.assetRevisionId,
      profile: request.profile,
      providerCategory: request.providerCategory,
      availability: "unavailable",
      source: "none",
      candidateIds: Object.freeze([]),
      failureCategory: category,
      retryEligibility:
        category === "internal_boundary" &&
        safeRetryAttempt(request.retryAttempt) <
          M3_PROCESSING_LIMITS.maxRetryAttempts
          ? "requires_explicit_authorized_retry"
          : "not_eligible",
      retryAttempt: safeRetryAttempt(request.retryAttempt),
      enrichmentPerformed: false,
      createdAt: request.requestedAt,
    });
    validateMetadataEnrichmentOutcome(outcome);
    this.storeOutcome(key, outcome);
    this.evidence.push(
      Object.freeze({
        action: "m3.metadata_declined",
        stationId: request.stationId,
        entityId: request.processingJob.id,
        profile: request.profile,
        providerCategory: request.providerCategory,
        category,
        safeCount: 1,
        occurredAt: request.requestedAt,
      }),
    );
    return outcome;
  }

  private storeOutcome(key: string, outcome: MetadataEnrichmentOutcome): void {
    this.outcomes.set(key, outcome);
    this.outcomesById.set(scoped(outcome.stationId, outcome.id), outcome);
  }
}

function confidenceCategoryFor(confidence: number): MetadataConfidenceCategory {
  if (confidence < 0.5) return "low";
  if (confidence < 0.8) return "medium";
  return "high";
}

function scoped(stationId: string, id: string): string {
  return `${stationId}\u0000${id}`;
}

function safeRetryAttempt(value: number): number {
  return Number.isInteger(value) &&
    value >= 0 &&
    value <= M3_PROCESSING_LIMITS.maxRetryAttempts
    ? value
    : 0;
}

function categoryFor(message: string): MetadataFailureCategory {
  if (message === "unsupported_metadata_profile") return "unsupported_profile";
  if (message === "retry_not_eligible") return "retry_not_eligible";
  if (message === "processing_not_approved") return "job_ineligible";
  return "internal_boundary";
}
