import { validateOpaqueReference } from "../domain/m3-assets.js";
import {
  M3_PROCESSING_LIMITS,
  type ApprovedProcessingJobReference,
  validateApprovedProcessingJobReference,
} from "./m3-processing-boundary.js";

export type CueFadeAnalysisProfile = "cue-fade-fixture-v1";
export type CueFadeAnalysisAvailability =
  | "disabled"
  | "fixture_preview_available"
  | "unavailable"
  | "quarantined";
export type CueFadeConfidenceCategory = "low" | "medium" | "high";
export type CueFadeQualityCategory = "low" | "medium" | "high";
export type CueFadeFailureCategory =
  | "unsupported_profile"
  | "recommendation_invalid"
  | "job_ineligible"
  | "retry_not_eligible"
  | "quality_indeterminate"
  | "internal_boundary";
export type CueFadeRetryEligibility =
  | "not_eligible"
  | "requires_explicit_authorized_retry";

/** Safe future playout-preparation suggestions; never runtime commands. */
export interface CueFadeRecommendation {
  durationMilliseconds: number;
  cueInMilliseconds: number;
  introEndMilliseconds: number;
  outroStartMilliseconds: number;
  cueOutMilliseconds: number;
  fadeInMilliseconds: number;
  fadeOutMilliseconds: number;
  confidence: number;
  confidenceCategory: CueFadeConfidenceCategory;
  quality: CueFadeQualityCategory;
  analysisVersion: string;
}

export interface CueFadeAnalysisRequest {
  id: string;
  stationId: string;
  idempotencyKey: string;
  processingJob: ApprovedProcessingJobReference;
  assetRevisionId: string;
  profile: CueFadeAnalysisProfile;
  analysisVersion: string;
  retryAttempt: number;
  requestedAt: string;
}

export interface CueFadeAnalysisResult {
  id: string;
  stationId: string;
  requestId: string;
  jobId: string;
  assetRevisionId: string;
  /** Declared profile is retained as a safe opaque identifier even when unsupported. */
  profile: string;
  availability: CueFadeAnalysisAvailability;
  source: "deterministic_fixture" | "none";
  recommendation?: CueFadeRecommendation;
  failureCategory?: CueFadeFailureCategory;
  retryEligibility: CueFadeRetryEligibility;
  retryAttempt: number;
  analysisPerformed: false;
  createdAt: string;
}

export interface CueFadeEvidence {
  action: "m3.cue_fade_previewed" | "m3.cue_fade_declined";
  stationId: string;
  entityId: string;
  profile: string;
  category: "fixture_preview" | CueFadeFailureCategory;
  safeCount: number;
  occurredAt: string;
}

const MAX_DURATION_MILLISECONDS = 7_200_000;

export function validateCueFadeAnalysisRequest(
  request: CueFadeAnalysisRequest,
): void {
  [
    request.id,
    request.stationId,
    request.idempotencyKey,
    request.assetRevisionId,
    request.analysisVersion,
  ].forEach(validateOpaqueReference);
  if (request.profile !== "cue-fade-fixture-v1")
    throw new Error("unsupported_cue_fade_profile");
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

export function validateCueFadeRecommendation(
  recommendation: CueFadeRecommendation,
): void {
  const offsets = [
    recommendation.durationMilliseconds,
    recommendation.cueInMilliseconds,
    recommendation.introEndMilliseconds,
    recommendation.outroStartMilliseconds,
    recommendation.cueOutMilliseconds,
    recommendation.fadeInMilliseconds,
    recommendation.fadeOutMilliseconds,
  ];
  if (
    offsets.some(
      (offset) =>
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > MAX_DURATION_MILLISECONDS,
    ) ||
    recommendation.durationMilliseconds === 0 ||
    recommendation.cueInMilliseconds > recommendation.introEndMilliseconds ||
    recommendation.introEndMilliseconds >
      recommendation.outroStartMilliseconds ||
    recommendation.outroStartMilliseconds > recommendation.cueOutMilliseconds ||
    recommendation.cueOutMilliseconds <= recommendation.cueInMilliseconds ||
    recommendation.cueOutMilliseconds > recommendation.durationMilliseconds ||
    recommendation.fadeInMilliseconds >
      recommendation.introEndMilliseconds - recommendation.cueInMilliseconds ||
    recommendation.fadeOutMilliseconds >
      recommendation.cueOutMilliseconds -
        recommendation.outroStartMilliseconds ||
    !Number.isFinite(recommendation.confidence) ||
    recommendation.confidence < 0 ||
    recommendation.confidence > 1 ||
    confidenceCategoryFor(recommendation.confidence) !==
      recommendation.confidenceCategory ||
    !["low", "medium", "high"].includes(recommendation.quality)
  )
    throw new Error("invalid_cue_fade_recommendation");
  validateOpaqueReference(recommendation.analysisVersion);
}

export function validateCueFadeAnalysisResult(
  result: CueFadeAnalysisResult,
): void {
  [
    result.id,
    result.stationId,
    result.requestId,
    result.jobId,
    result.assetRevisionId,
  ].forEach(validateOpaqueReference);
  if (result.analysisPerformed !== false)
    throw new Error("invalid_cue_fade_result");
  validateOpaqueReference(result.profile);
  if (
    !Number.isInteger(result.retryAttempt) ||
    result.retryAttempt < 0 ||
    result.retryAttempt > M3_PROCESSING_LIMITS.maxRetryAttempts
  )
    throw new Error("invalid_cue_fade_result");
  if (result.availability === "fixture_preview_available") {
    if (
      !result.recommendation ||
      result.source !== "deterministic_fixture" ||
      result.retryEligibility !== "not_eligible" ||
      result.failureCategory
    )
      throw new Error("invalid_cue_fade_result");
    validateCueFadeRecommendation(result.recommendation);
    return;
  }
  if (
    result.recommendation ||
    result.source !== "none" ||
    !result.failureCategory
  )
    throw new Error("invalid_cue_fade_result");
  if (
    result.availability === "quarantined" &&
    (result.failureCategory !== "quality_indeterminate" ||
      result.retryEligibility !== "requires_explicit_authorized_retry")
  )
    throw new Error("invalid_cue_fade_result");
}

/** Disabled, deterministic preview boundary. It has no media or execution capability. */
export class DisabledCueFadeAnalysisBoundary {
  private readonly jobs = new Map<string, ApprovedProcessingJobReference>();
  private readonly results = new Map<string, CueFadeAnalysisResult>();
  private readonly evidence: CueFadeEvidence[] = [];

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

  preview(request: CueFadeAnalysisRequest): CueFadeAnalysisResult {
    const key = scoped(request.stationId, request.idempotencyKey);
    const existing = this.results.get(key);
    if (existing) {
      if (
        existing.assetRevisionId !== request.assetRevisionId ||
        existing.jobId !== request.processingJob.id ||
        existing.profile !== request.profile ||
        existing.retryAttempt !== request.retryAttempt
      )
        throw new Error("idempotency_conflict");
      return existing;
    }
    try {
      validateCueFadeAnalysisRequest(request);
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
        ].includes(message)
      )
        throw error;
      return this.decline(request, key, categoryFor(message));
    }
    const result: CueFadeAnalysisResult = Object.freeze({
      id: request.id,
      stationId: request.stationId,
      requestId: request.id,
      jobId: request.processingJob.id,
      assetRevisionId: request.assetRevisionId,
      profile: request.profile,
      availability: "fixture_preview_available",
      source: "deterministic_fixture",
      recommendation: {
        durationMilliseconds: 180_000,
        cueInMilliseconds: 0,
        introEndMilliseconds: 12_000,
        outroStartMilliseconds: 165_000,
        cueOutMilliseconds: 180_000,
        fadeInMilliseconds: 0,
        fadeOutMilliseconds: 5_000,
        confidence: 0.9,
        confidenceCategory: "high" as const,
        quality: "high" as const,
        analysisVersion: request.analysisVersion,
      },
      retryEligibility: "not_eligible",
      retryAttempt: request.retryAttempt,
      analysisPerformed: false,
      createdAt: request.requestedAt,
    });
    validateCueFadeAnalysisResult(result);
    this.results.set(key, result);
    this.evidence.push(
      Object.freeze({
        action: "m3.cue_fade_previewed",
        stationId: request.stationId,
        entityId: request.processingJob.id,
        profile: request.profile,
        category: "fixture_preview",
        safeCount: 1,
        occurredAt: request.requestedAt,
      }),
    );
    return result;
  }

  readEvidence(stationId: string): readonly CueFadeEvidence[] {
    return this.evidence.filter((entry) => entry.stationId === stationId);
  }

  private decline(
    request: CueFadeAnalysisRequest,
    key: string,
    category: CueFadeFailureCategory,
  ): CueFadeAnalysisResult {
    const result: CueFadeAnalysisResult = Object.freeze({
      id: request.id,
      stationId: request.stationId,
      requestId: request.id,
      jobId: request.processingJob.id,
      assetRevisionId: request.assetRevisionId,
      profile: request.profile,
      availability: "unavailable",
      source: "none",
      failureCategory: category,
      retryEligibility:
        category === "internal_boundary" &&
        safeRetryAttempt(request.retryAttempt) <
          M3_PROCESSING_LIMITS.maxRetryAttempts
          ? "requires_explicit_authorized_retry"
          : "not_eligible",
      retryAttempt: safeRetryAttempt(request.retryAttempt),
      analysisPerformed: false,
      createdAt: request.requestedAt,
    });
    validateCueFadeAnalysisResult(result);
    this.results.set(key, result);
    this.evidence.push(
      Object.freeze({
        action: "m3.cue_fade_declined",
        stationId: request.stationId,
        entityId: request.processingJob.id,
        profile: request.profile,
        category,
        safeCount: 1,
        occurredAt: request.requestedAt,
      }),
    );
    return result;
  }
}

function confidenceCategoryFor(confidence: number): CueFadeConfidenceCategory {
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

function categoryFor(message: string): CueFadeFailureCategory {
  if (message === "unsupported_cue_fade_profile") return "unsupported_profile";
  if (message === "retry_not_eligible") return "retry_not_eligible";
  if (message === "processing_not_approved") return "job_ineligible";
  if (message === "invalid_cue_fade_recommendation")
    return "recommendation_invalid";
  return "internal_boundary";
}
