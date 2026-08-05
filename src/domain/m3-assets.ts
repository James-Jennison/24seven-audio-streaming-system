import type { StableId, UtcTimestamp } from "./contracts.js";

/** M3 records are control-plane only. They never identify a filesystem object. */
export type AssetLifecycleState =
  | "proposed"
  | "validated"
  | "approved_for_processing"
  | "processing"
  | "analyzed"
  | "metadata_pending"
  | "ready_for_schedule_use"
  | "rejected"
  | "quarantined"
  | "failed"
  | "superseded";

export type SourceKind =
  | "operator_staged_reference"
  | "managed_source_reference";
export type MetadataResolutionState = "pending" | "approved" | "rejected";
export type FailureCategory =
  | "validation"
  | "limits"
  | "unsupported_format"
  | "analysis"
  | "metadata"
  | "internal";

/**
 * These categories intentionally describe only boundary outcomes. They must
 * never contain source content, locations, parser output, or exception text.
 */
export type SourceReferenceValidationCategory =
  | "accepted"
  | "invalid_opaque_reference"
  | "unsupported_source_kind"
  | "ownership_unverified"
  | "policy_rejected"
  | "limit_exceeded";

export type SourceReferenceValidationState =
  | "valid"
  | "quarantined"
  | "rejected";

export type RecoveryRetryEligibility =
  | "not_eligible"
  | "requires_explicit_authorized_retry";

export interface OpaqueSourceReference {
  kind: SourceKind;
  /** An opaque, operator-issued handle; never a path, filename, URL, or payload. */
  opaqueId: string;
}

/**
 * A station-scoped source-reference record is an opaque control-plane value,
 * not a filesystem object or a media handle. Its id and stationId travel
 * together in every internal relationship.
 */
export interface StationScopedSourceReference {
  id: StableId;
  stationId: StableId;
  source: OpaqueSourceReference;
  validationState: SourceReferenceValidationState;
  validationCategory: SourceReferenceValidationCategory;
  recoveryEligibility: RecoveryRetryEligibility;
  createdAt: UtcTimestamp;
}

/** An append-only, content-free decision about one intake source reference. */
export interface SourceReferenceValidationOutcome {
  id: StableId;
  stationId: StableId;
  intakeRequestId: StableId;
  sourceReferenceId: StableId;
  state: SourceReferenceValidationState;
  category: SourceReferenceValidationCategory;
  recoveryEligibility: RecoveryRetryEligibility;
  occurredAt: UtcTimestamp;
}

/** Quarantine preserves the safe reason and requires an explicit retry. */
export interface QuarantineRecord extends SourceReferenceValidationOutcome {
  state: "quarantined";
  recoveryEligibility: "requires_explicit_authorized_retry";
}

/** Rejection is terminal for the intake proposal; it cannot be retried. */
export interface RejectionRecord extends SourceReferenceValidationOutcome {
  state: "rejected";
  recoveryEligibility: "not_eligible";
}

/**
 * An append-only operator decision which authorizes a later eligible retry.
 * It is deliberately separate from the original validation/quarantine fact.
 */
export interface SourceReferenceRecoveryRecord {
  id: StableId;
  stationId: StableId;
  intakeRequestId: StableId;
  sourceReferenceId: StableId;
  validationOutcomeId: StableId;
  resultingLifecycleState: "validated";
  createdAt: UtcTimestamp;
}

export interface M3ImportRequest {
  id: StableId;
  stationId: StableId;
  idempotencyKey: string;
  source: OpaqueSourceReference;
  lifecycleState: AssetLifecycleState;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
}

export interface M3ImportJob {
  id: StableId;
  stationId: StableId;
  requestId: StableId;
  lifecycleState: AssetLifecycleState;
  retryCount: number;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
}

export interface AssetRecord {
  id: StableId;
  stationId: StableId;
  lifecycleState: AssetLifecycleState;
  createdAt: UtcTimestamp;
  updatedAt: UtcTimestamp;
}

/** Append-only revision/provenance data. Approved revisions are never overwritten. */
export interface AssetRevision {
  id: StableId;
  stationId: StableId;
  assetId: StableId;
  revision: number;
  source: OpaqueSourceReference;
  provenanceReference: string;
  checksumSha256?: string;
  createdAt: UtcTimestamp;
}

export interface LoudnessMeasurement {
  integratedLufs: number;
  loudnessRangeLu: number;
  truePeakDbtp: number;
}

/** A recommendation is separate from both the measured fact and future DSP settings. */
export interface NormalizationRecommendation {
  targetLufs: number;
  recommendedGainDb: number;
  analysisVersion: string;
}

export interface CueFadeMeasurement {
  cueInMilliseconds: number;
  cueOutMilliseconds: number;
  fadeInMilliseconds: number;
  fadeOutMilliseconds: number;
  confidence: number;
  quality: "low" | "medium" | "high";
  analysisVersion: string;
}

export interface ProcessingAnalysisResult {
  id: StableId;
  stationId: StableId;
  assetRevisionId: StableId;
  loudness: LoudnessMeasurement;
  recommendation: NormalizationRecommendation;
  cueFade: CueFadeMeasurement;
  createdAt: UtcTimestamp;
}

export interface MetadataCandidate {
  id: StableId;
  stationId: StableId;
  assetRevisionId: StableId;
  provider: "musicbrainz_compatible" | "deterministic_fixture";
  candidateReference: string;
  confidence: number;
  resolutionState: MetadataResolutionState;
  createdAt: UtcTimestamp;
}

export interface JobFailureRecord {
  id: StableId;
  stationId: StableId;
  jobId: StableId;
  category: FailureCategory;
  retryable: boolean;
  occurredAt: UtcTimestamp;
}

const transitions: Readonly<
  Record<AssetLifecycleState, readonly AssetLifecycleState[]>
> = {
  proposed: ["validated", "rejected"],
  validated: ["approved_for_processing", "rejected"],
  approved_for_processing: ["processing", "rejected"],
  processing: ["analyzed", "quarantined", "failed"],
  analyzed: ["metadata_pending", "quarantined", "failed"],
  metadata_pending: ["ready_for_schedule_use", "quarantined", "failed"],
  ready_for_schedule_use: ["superseded"],
  rejected: [],
  quarantined: ["validated", "rejected"],
  failed: ["validated", "rejected"],
  superseded: [],
};

export function canTransitionAssetLifecycle(
  from: AssetLifecycleState,
  to: AssetLifecycleState,
): boolean {
  return transitions[from].includes(to);
}

export function assertAssetLifecycleTransition(
  from: AssetLifecycleState,
  to: AssetLifecycleState,
): void {
  if (!canTransitionAssetLifecycle(from, to))
    throw new Error("invalid_lifecycle_transition");
}

export function validateOpaqueReference(value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(value))
    throw new Error("invalid_opaque_reference");
  if (/[/\\]/.test(value) || value.includes(".."))
    throw new Error("invalid_opaque_reference");
}

export function validateImportRequestInput(input: {
  idempotencyKey: string;
  source: OpaqueSourceReference;
}): void {
  validateOpaqueReference(input.idempotencyKey);
  if (
    !["operator_staged_reference", "managed_source_reference"].includes(
      input.source.kind,
    )
  )
    throw new Error("invalid_source_kind");
  validateOpaqueReference(input.source.opaqueId);
}

export function assertStationScopedSourceReference(
  stationId: StableId,
  reference: StationScopedSourceReference,
): void {
  if (reference.stationId !== stationId)
    throw new Error("station_reference_forbidden");
  validateImportRequestInput({
    idempotencyKey: reference.id,
    source: reference.source,
  });
  if (
    (reference.validationState === "valid" &&
      (reference.validationCategory !== "accepted" ||
        reference.recoveryEligibility !== "not_eligible")) ||
    (reference.validationState === "quarantined" &&
      reference.recoveryEligibility !== "requires_explicit_authorized_retry") ||
    (reference.validationState === "rejected" &&
      reference.recoveryEligibility !== "not_eligible")
  )
    throw new Error("invalid_source_reference_outcome");
}

export function validateSourceReferenceValidationOutcome(
  outcome: SourceReferenceValidationOutcome,
): void {
  validateOpaqueReference(outcome.id);
  validateOpaqueReference(outcome.intakeRequestId);
  validateOpaqueReference(outcome.sourceReferenceId);
  if (
    ![
      "accepted",
      "invalid_opaque_reference",
      "unsupported_source_kind",
      "ownership_unverified",
      "policy_rejected",
      "limit_exceeded",
    ].includes(outcome.category)
  )
    throw new Error("invalid_source_reference_outcome");
  if (
    (outcome.state === "valid" &&
      (outcome.category !== "accepted" ||
        outcome.recoveryEligibility !== "not_eligible")) ||
    (outcome.state === "quarantined" &&
      outcome.recoveryEligibility !== "requires_explicit_authorized_retry") ||
    (outcome.state === "rejected" &&
      outcome.recoveryEligibility !== "not_eligible")
  )
    throw new Error("invalid_source_reference_outcome");
}

/**
 * Recovery is a state-recording control-plane action only. It never reads the
 * source or dispatches a worker, and rejected proposals remain terminal.
 */
export function assertExplicitRecoveryRetry(
  state: AssetLifecycleState,
  recoveryEligibility: RecoveryRetryEligibility,
): "validated" {
  if (
    recoveryEligibility !== "requires_explicit_authorized_retry" ||
    !["quarantined", "failed"].includes(state)
  )
    throw new Error("recovery_not_eligible");
  return "validated";
}

export function validateSourceReferenceRecoveryRecord(
  record: SourceReferenceRecoveryRecord,
): void {
  validateOpaqueReference(record.id);
  validateOpaqueReference(record.intakeRequestId);
  validateOpaqueReference(record.sourceReferenceId);
  validateOpaqueReference(record.validationOutcomeId);
  if (record.resultingLifecycleState !== "validated")
    throw new Error("invalid_recovery_record");
}

export function validateLoudnessMeasurement(value: LoudnessMeasurement): void {
  if (
    !Number.isFinite(value.integratedLufs) ||
    value.integratedLufs < -70 ||
    value.integratedLufs > 0 ||
    !Number.isFinite(value.loudnessRangeLu) ||
    value.loudnessRangeLu < 0 ||
    value.loudnessRangeLu > 70 ||
    !Number.isFinite(value.truePeakDbtp) ||
    value.truePeakDbtp < -120 ||
    value.truePeakDbtp > 6
  )
    throw new Error("invalid_loudness_measurement");
}

export function validateNormalizationRecommendation(
  value: NormalizationRecommendation,
): void {
  if (
    !Number.isFinite(value.targetLufs) ||
    value.targetLufs < -70 ||
    value.targetLufs > 0 ||
    !Number.isFinite(value.recommendedGainDb) ||
    value.recommendedGainDb < -40 ||
    value.recommendedGainDb > 40 ||
    !value.analysisVersion.trim()
  )
    throw new Error("invalid_normalization_recommendation");
}

export function validateCueFadeMeasurement(value: CueFadeMeasurement): void {
  const timing = [
    value.cueInMilliseconds,
    value.cueOutMilliseconds,
    value.fadeInMilliseconds,
    value.fadeOutMilliseconds,
  ];
  if (
    timing.some((item) => !Number.isInteger(item) || item < 0) ||
    value.cueOutMilliseconds <= value.cueInMilliseconds ||
    value.fadeInMilliseconds >
      value.cueOutMilliseconds - value.cueInMilliseconds ||
    value.fadeOutMilliseconds >
      value.cueOutMilliseconds - value.cueInMilliseconds ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    !["low", "medium", "high"].includes(value.quality) ||
    !value.analysisVersion.trim()
  )
    throw new Error("invalid_cue_fade_measurement");
}

export function validateMetadataCandidate(value: MetadataCandidate): void {
  if (
    !["musicbrainz_compatible", "deterministic_fixture"].includes(
      value.provider,
    ) ||
    !Number.isFinite(value.confidence) ||
    value.confidence < 0 ||
    value.confidence > 1 ||
    !["pending", "approved", "rejected"].includes(value.resolutionState)
  )
    throw new Error("invalid_metadata_candidate");
  validateOpaqueReference(value.candidateReference);
}
