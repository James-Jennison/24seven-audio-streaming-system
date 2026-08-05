import type {
  CueFadeMeasurement,
  LoudnessMeasurement,
  MetadataCandidate,
  NormalizationRecommendation,
  ProcessingAnalysisResult,
} from "../domain/m3-assets.js";
import {
  validateCueFadeMeasurement,
  validateLoudnessMeasurement,
  validateMetadataCandidate,
  validateNormalizationRecommendation,
  validateOpaqueReference,
} from "../domain/m3-assets.js";

export type M3ProcessingStage =
  | "normalization_analysis"
  | "cue_fade_analysis"
  | "metadata_enrichment";

export type M3ProcessingFormatCategory =
  | "audio/mpeg"
  | "audio/flac"
  | "audio/wav";

export type M3ProcessingFailureCategory =
  | "reference_size_limit"
  | "input_size_limit"
  | "format_not_allowed"
  | "execution_time_limit"
  | "memory_limit"
  | "concurrency_limit"
  | "retry_limit"
  | "analysis_contract_invalid"
  | "internal_boundary";

export type M3ProcessingAttemptState =
  | "eligible"
  | "pending"
  | "completed"
  | "failed"
  | "quarantined";

export type M3ProcessingRetryEligibility =
  | "not_eligible"
  | "requires_explicit_authorized_retry";

export interface M3ProcessingResourceLimits {
  maxOpaqueReferenceBytes: number;
  maxDeclaredInputBytes: number;
  maxWallClockMilliseconds: number;
  maxMemoryBytes: number;
  maxConcurrentJobs: number;
  maxRetryAttempts: number;
  allowedFormats: readonly M3ProcessingFormatCategory[];
  analysisVersions: Readonly<Record<M3ProcessingStage, string>>;
}

/** Contract values only. They do not configure or start a worker. */
export const M3_PROCESSING_LIMITS: Readonly<M3ProcessingResourceLimits> =
  Object.freeze({
    maxOpaqueReferenceBytes: 128,
    maxDeclaredInputBytes: 2_147_483_648,
    maxWallClockMilliseconds: 120_000,
    maxMemoryBytes: 536_870_912,
    maxConcurrentJobs: 1,
    maxRetryAttempts: 3,
    allowedFormats: ["audio/mpeg", "audio/flac", "audio/wav"] as const,
    analysisVersions: {
      normalization_analysis: "m3-fixture-normalization-v1",
      cue_fade_analysis: "m3-fixture-cue-fade-v1",
      metadata_enrichment: "m3-fixture-metadata-v1",
    },
  });

/**
 * Contains only opaque station-scoped references and safe declared limits. It
 * cannot identify a filesystem object, URL, media payload, tag payload, or
 * provider request.
 */
export interface ApprovedProcessingJobReference {
  id: string;
  stationId: string;
  importRequestId: string;
  assetId: string;
  assetRevisionId: string;
  sourceReferenceId: string;
  lifecycleState: "approved_for_processing";
  assetRevisionState: "approved";
  sourceValidationState: "valid";
  declaredInputBytes: number;
  formatCategory: M3ProcessingFormatCategory;
  retryAttempt: number;
}

export interface M3ProcessingDispatchRequest {
  id: string;
  stationId: string;
  idempotencyKey: string;
  job: ApprovedProcessingJobReference;
  stages: readonly M3ProcessingStage[];
  requestedAt: string;
}

export interface M3ProcessingDispatchOutcome {
  id: string;
  stationId: string;
  jobId: string;
  decision: "accepted_for_future_worker" | "declined";
  boundaryState: "disabled";
  dispatched: false;
  category?: M3ProcessingFailureCategory;
  retryEligibility: M3ProcessingRetryEligibility;
  requestedAt: string;
}

/** Append-only future-worker outcome contract; M3.4 never produces one. */
export interface M3ProcessingAttemptOutcome {
  id: string;
  stationId: string;
  jobId: string;
  from: M3ProcessingAttemptState;
  to: Exclude<M3ProcessingAttemptState, "eligible">;
  category?: M3ProcessingFailureCategory;
  retryEligibility: M3ProcessingRetryEligibility;
  occurredAt: string;
}

/** Content-free evidence only; it has no media, source, or adapter detail. */
export interface M3ProcessingBoundaryEvidence {
  action:
    | "m3.processing_previewed"
    | "m3.processing_declined"
    | "m3.processing_retry_eligible";
  stationId: string;
  entityId: string;
  category: "disabled" | M3ProcessingFailureCategory;
  safeCount: number;
  occurredAt: string;
}

/** Append-only, no-dispatch record of a future retry eligibility decision. */
export interface M3ProcessingRetryEligibilityRecord {
  id: string;
  stationId: string;
  jobId: string;
  attemptOutcomeId: string;
  eligibility: "requires_explicit_authorized_retry";
  boundaryState: "disabled";
  occurredAt: string;
}

export interface M3ProcessingBoundaryStatus {
  stationId: string;
  jobId: string;
  state: "disabled";
  execution: "unavailable";
  stages: readonly M3ProcessingStage[];
}

export interface NormalizationAnalysisAdapter {
  analyze(job: ApprovedProcessingJobReference): Promise<{
    loudness: LoudnessMeasurement;
    recommendation: NormalizationRecommendation;
  }>;
}

export interface CueFadeAnalysisAdapter {
  analyze(job: ApprovedProcessingJobReference): Promise<CueFadeMeasurement>;
}

export interface MetadataEnrichmentAdapter {
  findCandidates(
    job: ApprovedProcessingJobReference,
  ): Promise<MetadataCandidate[]>;
}

export interface M3AnalysisAdapters {
  normalization: NormalizationAnalysisAdapter;
  cueFade: CueFadeAnalysisAdapter;
  metadata: MetadataEnrichmentAdapter;
}

const attemptTransitions: Readonly<
  Record<M3ProcessingAttemptState, readonly M3ProcessingAttemptState[]>
> = {
  eligible: ["pending"],
  pending: ["completed", "failed", "quarantined"],
  completed: [],
  failed: ["eligible"],
  quarantined: ["eligible"],
};

export function assertM3ProcessingAttemptTransition(
  from: M3ProcessingAttemptState,
  to: M3ProcessingAttemptState,
): void {
  if (!attemptTransitions[from].includes(to))
    throw new Error("invalid_processing_transition");
}

export function retryEligibilityFor(
  category: M3ProcessingFailureCategory,
  retryAttempt: number,
  limits: M3ProcessingResourceLimits = M3_PROCESSING_LIMITS,
): M3ProcessingRetryEligibility {
  validateM3ProcessingResourceLimits(limits);
  if (retryAttempt >= limits.maxRetryAttempts) return "not_eligible";
  return [
    "execution_time_limit",
    "memory_limit",
    "concurrency_limit",
    "internal_boundary",
  ].includes(category)
    ? "requires_explicit_authorized_retry"
    : "not_eligible";
}

export function validateM3ProcessingResourceLimits(
  limits: M3ProcessingResourceLimits,
): void {
  if (
    [
      limits.maxOpaqueReferenceBytes,
      limits.maxDeclaredInputBytes,
      limits.maxWallClockMilliseconds,
      limits.maxMemoryBytes,
      limits.maxConcurrentJobs,
      limits.maxRetryAttempts,
    ].some((value) => !Number.isInteger(value) || value < 1) ||
    !limits.allowedFormats.length ||
    new Set(limits.allowedFormats).size !== limits.allowedFormats.length
  )
    throw new Error("invalid_processing_limits");
  for (const stage of [
    "normalization_analysis",
    "cue_fade_analysis",
    "metadata_enrichment",
  ] as const)
    validateOpaqueReference(limits.analysisVersions[stage]);
}

export function validateApprovedProcessingJobReference(
  job: ApprovedProcessingJobReference,
  limits: M3ProcessingResourceLimits = M3_PROCESSING_LIMITS,
): void {
  validateM3ProcessingResourceLimits(limits);
  [
    job.id,
    job.stationId,
    job.importRequestId,
    job.assetId,
    job.assetRevisionId,
    job.sourceReferenceId,
  ].forEach(validateOpaqueReference);
  if (
    job.lifecycleState !== "approved_for_processing" ||
    job.assetRevisionState !== "approved" ||
    job.sourceValidationState !== "valid"
  )
    throw new Error("processing_not_approved");
  if (
    !Number.isInteger(job.declaredInputBytes) ||
    job.declaredInputBytes < 0 ||
    job.declaredInputBytes > limits.maxDeclaredInputBytes
  )
    throw new Error("input_size_limit");
  if (!limits.allowedFormats.includes(job.formatCategory))
    throw new Error("format_not_allowed");
  if (
    !Number.isInteger(job.retryAttempt) ||
    job.retryAttempt < 0 ||
    job.retryAttempt > limits.maxRetryAttempts
  )
    throw new Error("retry_limit");
}

export function validateM3ProcessingDispatchRequest(
  request: M3ProcessingDispatchRequest,
  limits: M3ProcessingResourceLimits = M3_PROCESSING_LIMITS,
): void {
  validateOpaqueReference(request.id);
  validateOpaqueReference(request.stationId);
  validateOpaqueReference(request.idempotencyKey);
  if (request.stationId !== request.job.stationId)
    throw new Error("station_reference_forbidden");
  if (
    !request.stages.length ||
    request.stages.some(
      (stage) =>
        ![
          "normalization_analysis",
          "cue_fade_analysis",
          "metadata_enrichment",
        ].includes(stage),
    ) ||
    new Set(request.stages).size !== request.stages.length
  )
    throw new Error("invalid_processing_stages");
  const referenceBytes = new TextEncoder().encode(
    [
      request.id,
      request.idempotencyKey,
      request.job.id,
      request.job.importRequestId,
      request.job.assetId,
      request.job.assetRevisionId,
      request.job.sourceReferenceId,
    ].join("|"),
  ).byteLength;
  if (referenceBytes > limits.maxOpaqueReferenceBytes)
    throw new Error("reference_size_limit");
  validateApprovedProcessingJobReference(request.job, limits);
}

export function validateM3ProcessingAttemptOutcome(
  outcome: M3ProcessingAttemptOutcome,
  limits: M3ProcessingResourceLimits = M3_PROCESSING_LIMITS,
): void {
  validateOpaqueReference(outcome.id);
  validateOpaqueReference(outcome.stationId);
  validateOpaqueReference(outcome.jobId);
  assertM3ProcessingAttemptTransition(outcome.from, outcome.to);
  if (outcome.to === "completed") {
    if (outcome.category || outcome.retryEligibility !== "not_eligible")
      throw new Error("invalid_processing_outcome");
    return;
  }
  if (!outcome.category) throw new Error("invalid_processing_outcome");
  if (
    outcome.retryEligibility !==
    retryEligibilityFor(outcome.category, 0, limits)
  )
    throw new Error("invalid_processing_outcome");
}

/**
 * The default M3.4 boundary is deliberately disabled. It validates an opaque,
 * approved job and records a deterministic preview only; no method can invoke
 * an analysis adapter, process, filesystem, network, provider, or other plane.
 */
export class DisabledM3AsyncProcessingBoundary {
  private readonly jobs = new Map<string, ApprovedProcessingJobReference>();
  private readonly dispatches = new Map<string, M3ProcessingDispatchOutcome>();
  private readonly retryRecords = new Map<
    string,
    M3ProcessingRetryEligibilityRecord
  >();
  private readonly evidence: M3ProcessingBoundaryEvidence[] = [];

  public constructor(
    jobs: readonly ApprovedProcessingJobReference[],
    private readonly limits: M3ProcessingResourceLimits = M3_PROCESSING_LIMITS,
  ) {
    validateM3ProcessingResourceLimits(limits);
    for (const job of jobs) {
      validateApprovedProcessingJobReference(job, limits);
      const key = scopedKey(job.stationId, job.id);
      if (this.jobs.has(key)) throw new Error("duplicate_processing_job");
      this.jobs.set(key, Object.freeze({ ...job }));
    }
  }

  /** Public station-scoped lookup intentionally hides another station's job. */
  status(stationId: string, jobId: string): M3ProcessingBoundaryStatus {
    const job = this.jobs.get(scopedKey(stationId, jobId));
    if (!job) throw new Error("not_found");
    return {
      stationId: job.stationId,
      jobId: job.id,
      state: "disabled",
      execution: "unavailable",
      stages: [
        "normalization_analysis",
        "cue_fade_analysis",
        "metadata_enrichment",
      ],
    };
  }

  /** Internal relationship validation reports a cross-station reference. */
  assertJobOwnership(
    stationId: string,
    job: ApprovedProcessingJobReference,
  ): void {
    if (stationId !== job.stationId)
      throw new Error("station_reference_forbidden");
    validateApprovedProcessingJobReference(job, this.limits);
  }

  preview(request: M3ProcessingDispatchRequest): M3ProcessingDispatchOutcome {
    const key = scopedKey(request.stationId, request.idempotencyKey);
    const existing = this.dispatches.get(key);
    if (existing) {
      if (existing.jobId !== request.job.id)
        throw new Error("idempotency_conflict");
      return existing;
    }
    try {
      validateM3ProcessingDispatchRequest(request, this.limits);
      this.assertJobOwnership(request.stationId, request.job);
      const stored = this.jobs.get(
        scopedKey(request.stationId, request.job.id),
      );
      if (!stored) throw new Error("not_found");
      if (!sameJob(stored, request.job))
        throw new Error("station_reference_forbidden");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "internal_boundary";
      if (
        [
          "not_found",
          "station_reference_forbidden",
          "idempotency_conflict",
        ].includes(message)
      )
        throw error;
      return this.decline(request, key, failureCategoryFor(message));
    }
    const outcome: M3ProcessingDispatchOutcome = Object.freeze({
      id: request.id,
      stationId: request.stationId,
      jobId: request.job.id,
      decision: "accepted_for_future_worker",
      boundaryState: "disabled",
      dispatched: false,
      retryEligibility: "not_eligible",
      requestedAt: request.requestedAt,
    });
    this.dispatches.set(key, outcome);
    this.evidence.push(
      Object.freeze({
        action: "m3.processing_previewed",
        stationId: request.stationId,
        entityId: request.job.id,
        category: "disabled",
        safeCount: request.stages.length,
        occurredAt: request.requestedAt,
      }),
    );
    return outcome;
  }

  /** Returns safe, station-scoped evidence and never exposes a source reference. */
  readEvidence(stationId: string): readonly M3ProcessingBoundaryEvidence[] {
    return this.evidence.filter((event) => event.stationId === stationId);
  }

  recordRetryEligibility(
    record: M3ProcessingRetryEligibilityRecord,
    outcome: M3ProcessingAttemptOutcome,
  ): M3ProcessingRetryEligibilityRecord {
    if (
      record.stationId !== outcome.stationId ||
      record.jobId !== outcome.jobId
    )
      throw new Error("station_reference_forbidden");
    validateOpaqueReference(record.id);
    validateOpaqueReference(record.stationId);
    validateOpaqueReference(record.jobId);
    validateOpaqueReference(record.attemptOutcomeId);
    if (
      record.attemptOutcomeId !== outcome.id ||
      record.eligibility !== "requires_explicit_authorized_retry" ||
      record.boundaryState !== "disabled"
    )
      throw new Error("recovery_not_eligible");
    validateM3ProcessingAttemptOutcome(outcome, this.limits);
    if (
      !["failed", "quarantined"].includes(outcome.to) ||
      outcome.retryEligibility !== "requires_explicit_authorized_retry"
    )
      throw new Error("recovery_not_eligible");
    if (!this.jobs.has(scopedKey(record.stationId, record.jobId)))
      throw new Error("not_found");
    const key = scopedKey(record.stationId, record.attemptOutcomeId);
    const existing = this.retryRecords.get(key);
    if (existing) {
      if (existing.id !== record.id) throw new Error("idempotency_conflict");
      return existing;
    }
    const immutable = Object.freeze({ ...record });
    this.retryRecords.set(key, immutable);
    this.evidence.push(
      Object.freeze({
        action: "m3.processing_retry_eligible",
        stationId: record.stationId,
        entityId: record.jobId,
        category: outcome.category ?? "internal_boundary",
        safeCount: 1,
        occurredAt: record.occurredAt,
      }),
    );
    return immutable;
  }

  private decline(
    request: M3ProcessingDispatchRequest,
    key: string,
    category: M3ProcessingFailureCategory,
  ): M3ProcessingDispatchOutcome {
    const outcome: M3ProcessingDispatchOutcome = Object.freeze({
      id: request.id,
      stationId: request.stationId,
      jobId: request.job.id,
      decision: "declined",
      boundaryState: "disabled",
      dispatched: false,
      category,
      retryEligibility: retryEligibilityFor(category, request.job.retryAttempt),
      requestedAt: request.requestedAt,
    });
    this.dispatches.set(key, outcome);
    this.evidence.push(
      Object.freeze({
        action: "m3.processing_declined",
        stationId: request.stationId,
        entityId: request.job.id,
        category,
        safeCount: request.stages.length,
        occurredAt: request.requestedAt,
      }),
    );
    return outcome;
  }
}

/**
 * Fixture-only analysis contract retained from the earlier local M3 foundation.
 * It is not the M3.4 dispatcher and must only be supplied with deterministic
 * test adapters; it has no default construction path in the control plane.
 */
export class DeterministicM3ProcessingBoundary {
  public constructor(private readonly adapters: M3AnalysisAdapters) {}

  async analyze(job: ApprovedProcessingJobReference): Promise<
    Pick<
      ProcessingAnalysisResult,
      "loudness" | "recommendation" | "cueFade"
    > & {
      metadataCandidates: MetadataCandidate[];
    }
  > {
    validateApprovedProcessingJobReference(job);
    const [normalization, cueFade, metadataCandidates] = await Promise.all([
      this.adapters.normalization.analyze(job),
      this.adapters.cueFade.analyze(job),
      this.adapters.metadata.findCandidates(job),
    ]);
    validateLoudnessMeasurement(normalization.loudness);
    validateNormalizationRecommendation(normalization.recommendation);
    validateCueFadeMeasurement(cueFade);
    metadataCandidates.forEach(validateMetadataCandidate);
    if (
      metadataCandidates.some(
        (candidate) =>
          candidate.stationId !== job.stationId ||
          candidate.resolutionState !== "pending",
      )
    )
      throw new Error("station_reference_forbidden");
    return { ...normalization, cueFade, metadataCandidates };
  }
}

/** Deterministic test fakes only; no process, filesystem, or network access. */
export function deterministicM3Adapters(): M3AnalysisAdapters {
  return {
    normalization: {
      analyze: async () => ({
        loudness: { integratedLufs: -18, loudnessRangeLu: 6, truePeakDbtp: -1 },
        recommendation: {
          targetLufs: -16,
          recommendedGainDb: 2,
          analysisVersion: "m3-fixture-v1",
        },
      }),
    },
    cueFade: {
      analyze: async () => ({
        cueInMilliseconds: 0,
        cueOutMilliseconds: 180_000,
        fadeInMilliseconds: 0,
        fadeOutMilliseconds: 3_000,
        confidence: 0.9,
        quality: "high",
        analysisVersion: "m3-fixture-v1",
      }),
    },
    metadata: {
      findCandidates: async (job) => [
        {
          id: `candidate-${job.id}`,
          stationId: job.stationId,
          assetRevisionId: `revision-${job.id}`,
          provider: "deterministic_fixture",
          candidateReference: `candidate:${job.id}`,
          confidence: 0.8,
          resolutionState: "pending",
          createdAt: "2026-08-04T00:00:00.000Z",
        },
      ],
    },
  };
}

function scopedKey(stationId: string, id: string): string {
  return `${stationId}\u0000${id}`;
}

function sameJob(
  first: ApprovedProcessingJobReference,
  second: ApprovedProcessingJobReference,
): boolean {
  return (
    first.id === second.id &&
    first.stationId === second.stationId &&
    first.importRequestId === second.importRequestId &&
    first.assetId === second.assetId &&
    first.assetRevisionId === second.assetRevisionId &&
    first.sourceReferenceId === second.sourceReferenceId &&
    first.lifecycleState === second.lifecycleState &&
    first.assetRevisionState === second.assetRevisionState &&
    first.sourceValidationState === second.sourceValidationState &&
    first.declaredInputBytes === second.declaredInputBytes &&
    first.formatCategory === second.formatCategory &&
    first.retryAttempt === second.retryAttempt
  );
}

function failureCategoryFor(message: string): M3ProcessingFailureCategory {
  const categories: Readonly<Record<string, M3ProcessingFailureCategory>> = {
    reference_size_limit: "reference_size_limit",
    input_size_limit: "input_size_limit",
    format_not_allowed: "format_not_allowed",
    retry_limit: "retry_limit",
  };
  return categories[message] ?? "analysis_contract_invalid";
}
