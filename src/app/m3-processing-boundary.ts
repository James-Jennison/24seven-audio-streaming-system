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
} from "../domain/m3-assets.js";

/** Contract values for a future sandbox. They are not an active worker configuration. */
export const M3_PROCESSING_LIMITS = Object.freeze({
  maxInputBytes: 2_147_483_648,
  maxWallClockMilliseconds: 120_000,
  maxMemoryBytes: 536_870_912,
  allowedFormats: ["audio/mpeg", "audio/flac", "audio/wav"] as const,
});

export interface ApprovedProcessingJobReference {
  id: string;
  stationId: string;
  lifecycleState: "approved_for_processing";
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

/**
 * An injectable, side-effect-free boundary. It knows neither paths nor bytes,
 * cannot reach a schedule/runtime/encoder, and performs no network activity.
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
    if (job.lifecycleState !== "approved_for_processing")
      throw new Error("processing_not_approved");
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

/** Safe fixture adapter: deterministic values only; no process, filesystem, or network access. */
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
