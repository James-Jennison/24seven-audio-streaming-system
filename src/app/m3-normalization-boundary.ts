import type {
  LoudnessMeasurement,
  NormalizationRecommendation,
} from "../domain/m3-assets.js";
import {
  validateLoudnessMeasurement,
  validateNormalizationRecommendation,
  validateOpaqueReference,
} from "../domain/m3-assets.js";
import {
  type ApprovedProcessingJobReference,
  validateApprovedProcessingJobReference,
} from "./m3-processing-boundary.js";

export type NormalizationProfile = "ebu-r128-v1";
export type NormalizationAvailability =
  | "disabled"
  | "fixture_preview_available"
  | "unavailable";
export type NormalizationFailureCategory =
  | "unsupported_profile"
  | "policy_invalid"
  | "job_ineligible"
  | "retry_not_eligible"
  | "internal_boundary";
export type NormalizationRetryEligibility =
  | "not_eligible"
  | "requires_explicit_authorized_retry";

export interface NormalizationPolicy {
  profile: NormalizationProfile;
  targetLufs: number;
  maximumRecommendedGainDb: number;
  analysisVersion: string;
}

export interface NormalizationAnalysisRequest {
  id: string;
  stationId: string;
  idempotencyKey: string;
  processingJob: ApprovedProcessingJobReference;
  assetRevisionId: string;
  policy: NormalizationPolicy;
  retryAttempt: number;
  requestedAt: string;
}

export interface NormalizationAnalysisResult {
  id: string;
  stationId: string;
  requestId: string;
  assetRevisionId: string;
  availability: NormalizationAvailability;
  source: "deterministic_fixture" | "none";
  measurement?: LoudnessMeasurement;
  recommendation?: NormalizationRecommendation;
  failureCategory?: NormalizationFailureCategory;
  retryEligibility: NormalizationRetryEligibility;
  analysisPerformed: false;
  createdAt: string;
}

export interface NormalizationEvidence {
  action: "m3.normalization_previewed" | "m3.normalization_declined";
  stationId: string;
  entityId: string;
  profile: NormalizationProfile;
  category: "fixture_preview" | NormalizationFailureCategory;
  safeCount: number;
  occurredAt: string;
}

export function validateNormalizationPolicy(policy: NormalizationPolicy): void {
  if (
    policy.profile !== "ebu-r128-v1" ||
    !Number.isFinite(policy.targetLufs) ||
    policy.targetLufs < -70 ||
    policy.targetLufs > 0 ||
    !Number.isFinite(policy.maximumRecommendedGainDb) ||
    policy.maximumRecommendedGainDb < 0 ||
    policy.maximumRecommendedGainDb > 40
  )
    throw new Error("invalid_normalization_policy");
  validateOpaqueReference(policy.analysisVersion);
}

export function validateNormalizationAnalysisRequest(
  request: NormalizationAnalysisRequest,
): void {
  [
    request.id,
    request.stationId,
    request.idempotencyKey,
    request.assetRevisionId,
  ].forEach(validateOpaqueReference);
  if (request.stationId !== request.processingJob.stationId)
    throw new Error("station_reference_forbidden");
  if (request.assetRevisionId !== request.processingJob.assetRevisionId)
    throw new Error("station_reference_forbidden");
  if (
    !Number.isInteger(request.retryAttempt) ||
    request.retryAttempt < 0 ||
    request.retryAttempt > 3
  )
    throw new Error("retry_not_eligible");
  validateApprovedProcessingJobReference(request.processingJob);
  validateNormalizationPolicy(request.policy);
}

export function validateNormalizationAnalysisResult(
  result: NormalizationAnalysisResult,
): void {
  [
    result.id,
    result.stationId,
    result.requestId,
    result.assetRevisionId,
  ].forEach(validateOpaqueReference);
  if (result.analysisPerformed !== false)
    throw new Error("invalid_normalization_result");
  if (result.availability === "fixture_preview_available") {
    if (
      !result.measurement ||
      !result.recommendation ||
      result.source !== "deterministic_fixture"
    )
      throw new Error("invalid_normalization_result");
    validateLoudnessMeasurement(result.measurement);
    validateNormalizationRecommendation(result.recommendation);
    if (result.retryEligibility !== "not_eligible")
      throw new Error("invalid_normalization_result");
    return;
  }
  if (
    result.measurement ||
    result.recommendation ||
    result.source !== "none" ||
    !result.failureCategory
  )
    throw new Error("invalid_normalization_result");
}

/** Disabled, deterministic preview boundary. It has no media or execution capability. */
export class DisabledNormalizationAnalysisBoundary {
  private readonly jobs = new Map<string, ApprovedProcessingJobReference>();
  private readonly results = new Map<string, NormalizationAnalysisResult>();
  private readonly evidence: NormalizationEvidence[] = [];

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

  preview(request: NormalizationAnalysisRequest): NormalizationAnalysisResult {
    const key = scoped(request.stationId, request.idempotencyKey);
    const existing = this.results.get(key);
    if (existing) {
      if (existing.assetRevisionId !== request.assetRevisionId)
        throw new Error("idempotency_conflict");
      return existing;
    }
    try {
      validateNormalizationAnalysisRequest(request);
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
        ].includes(message)
      )
        throw error;
      return this.decline(request, key, categoryFor(message));
    }
    const result: NormalizationAnalysisResult = Object.freeze({
      id: request.id,
      stationId: request.stationId,
      requestId: request.id,
      assetRevisionId: request.assetRevisionId,
      availability: "fixture_preview_available",
      source: "deterministic_fixture",
      measurement: {
        integratedLufs: -18,
        loudnessRangeLu: 6,
        truePeakDbtp: -1,
      },
      recommendation: {
        targetLufs: request.policy.targetLufs,
        recommendedGainDb: 2,
        analysisVersion: request.policy.analysisVersion,
      },
      retryEligibility: "not_eligible",
      analysisPerformed: false,
      createdAt: request.requestedAt,
    });
    validateNormalizationAnalysisResult(result);
    this.results.set(key, result);
    this.evidence.push(
      Object.freeze({
        action: "m3.normalization_previewed",
        stationId: request.stationId,
        entityId: request.processingJob.id,
        profile: request.policy.profile,
        category: "fixture_preview",
        safeCount: 1,
        occurredAt: request.requestedAt,
      }),
    );
    return result;
  }

  readEvidence(stationId: string): readonly NormalizationEvidence[] {
    return this.evidence.filter((entry) => entry.stationId === stationId);
  }

  private decline(
    request: NormalizationAnalysisRequest,
    key: string,
    category: NormalizationFailureCategory,
  ): NormalizationAnalysisResult {
    const result: NormalizationAnalysisResult = Object.freeze({
      id: request.id,
      stationId: request.stationId,
      requestId: request.id,
      assetRevisionId: request.assetRevisionId,
      availability: "unavailable",
      source: "none",
      failureCategory: category,
      retryEligibility:
        category === "internal_boundary" && request.retryAttempt < 3
          ? "requires_explicit_authorized_retry"
          : "not_eligible",
      analysisPerformed: false,
      createdAt: request.requestedAt,
    });
    validateNormalizationAnalysisResult(result);
    this.results.set(key, result);
    this.evidence.push(
      Object.freeze({
        action: "m3.normalization_declined",
        stationId: request.stationId,
        entityId: request.processingJob.id,
        profile: request.policy.profile,
        category,
        safeCount: 1,
        occurredAt: request.requestedAt,
      }),
    );
    return result;
  }
}

function scoped(stationId: string, id: string): string {
  return `${stationId}\u0000${id}`;
}
function categoryFor(message: string): NormalizationFailureCategory {
  if (message === "invalid_normalization_policy") return "policy_invalid";
  if (message === "retry_not_eligible") return "retry_not_eligible";
  if (message === "processing_not_approved") return "job_ineligible";
  return "internal_boundary";
}
