import {
  type AssetRecord,
  type AssetRevision,
  validateOpaqueReference,
} from "../domain/m3-assets.js";
import type { StableId } from "../domain/contracts.js";

export interface M4CatalogAssetInput {
  asset: AssetRecord;
  revision: AssetRevision;
}

/** A content-free, immutable M4 reference to an eligible M3 revision. */
export interface M4CatalogCandidate {
  id: StableId;
  stationId: StableId;
  assetId: StableId;
  assetRevisionId: StableId;
  revision: number;
  eligibility: "ready_for_schedule_use";
}

export type M4CatalogRejectionCategory =
  | "asset_not_schedule_eligible"
  | "asset_superseded";

/** Content-free eligibility evidence; it never contains media or metadata. */
export interface M4CatalogEligibilityEvidence {
  action: "m4.catalog_eligibility_evaluated";
  stationId: StableId;
  assetId: StableId;
  assetRevisionId: StableId;
  outcome: "eligible" | "rejected";
  category: "ready_for_schedule_use" | M4CatalogRejectionCategory;
}

export interface M4CatalogEligibilityResult {
  candidate?: M4CatalogCandidate;
  evidence: M4CatalogEligibilityEvidence;
  execution: "unavailable";
}

/**
 * M4.2's local Control Plane query boundary. It accepts only prepared M3
 * records, projects opaque candidate identity, and intentionally has no
 * persistence, media, network, runtime, or dispatch capability.
 */
export class M4CatalogEligibilityBoundary {
  private readonly assets = new Map<string, AssetRecord>();
  private readonly revisions = new Map<string, AssetRevision>();

  public constructor(inputs: readonly M4CatalogAssetInput[]) {
    for (const input of inputs) this.add(input);
  }

  /**
   * Public station-scoped lookup deliberately hides another station's asset
   * and revision ownership. It performs neither lifecycle mutation nor media
   * access.
   */
  evaluate(
    stationId: StableId,
    assetId: StableId,
    assetRevisionId: StableId,
  ): M4CatalogEligibilityResult {
    const asset = this.assets.get(scopedKey(stationId, assetId));
    const revision = this.revisions.get(scopedKey(stationId, assetRevisionId));
    if (!asset || !revision) throw new Error("not_found");
    if (revision.assetId !== asset.id)
      throw new Error("station_reference_forbidden");

    const category =
      asset.lifecycleState === "ready_for_schedule_use"
        ? "ready_for_schedule_use"
        : asset.lifecycleState === "superseded"
          ? "asset_superseded"
          : "asset_not_schedule_eligible";
    const evidence: M4CatalogEligibilityEvidence = Object.freeze({
      action: "m4.catalog_eligibility_evaluated",
      stationId,
      assetId,
      assetRevisionId,
      outcome: category === "ready_for_schedule_use" ? "eligible" : "rejected",
      category,
    });
    if (evidence.outcome === "rejected")
      return Object.freeze({ evidence, execution: "unavailable" });

    return Object.freeze({
      candidate: Object.freeze({
        id: `catalog:${revision.id}`,
        stationId,
        assetId,
        assetRevisionId: revision.id,
        revision: revision.revision,
        eligibility: "ready_for_schedule_use",
      }),
      evidence,
      execution: "unavailable",
    });
  }

  /** Trusted callers must preserve both the candidate ID and station scope. */
  assertCandidateOwnership(
    stationId: StableId,
    candidate: M4CatalogCandidate,
  ): void {
    if (candidate.stationId !== stationId)
      throw new Error("station_reference_forbidden");
    validateCandidate(candidate);
  }

  private add(input: M4CatalogAssetInput): void {
    const { asset, revision } = input;
    validateAssetAndRevision(asset, revision);
    const assetKey = scopedKey(asset.stationId, asset.id);
    const revisionKey = scopedKey(revision.stationId, revision.id);
    if (this.assets.has(assetKey) || this.revisions.has(revisionKey))
      throw new Error("duplicate_catalog_asset_reference");
    this.assets.set(assetKey, Object.freeze({ ...asset }));
    this.revisions.set(
      revisionKey,
      Object.freeze({
        ...revision,
        source: Object.freeze({ ...revision.source }),
      }),
    );
  }
}

function validateAssetAndRevision(
  asset: AssetRecord,
  revision: AssetRevision,
): void {
  validateOpaqueReference(asset.id);
  validateOpaqueReference(asset.stationId);
  validateOpaqueReference(revision.id);
  validateOpaqueReference(revision.stationId);
  validateOpaqueReference(revision.assetId);
  if (asset.stationId !== revision.stationId || asset.id !== revision.assetId)
    throw new Error("station_reference_forbidden");
  if (!Number.isInteger(revision.revision) || revision.revision < 1)
    throw new Error("invalid_asset_revision");
}

function validateCandidate(candidate: M4CatalogCandidate): void {
  validateOpaqueReference(candidate.id);
  validateOpaqueReference(candidate.stationId);
  validateOpaqueReference(candidate.assetId);
  validateOpaqueReference(candidate.assetRevisionId);
  if (
    candidate.eligibility !== "ready_for_schedule_use" ||
    !Number.isInteger(candidate.revision) ||
    candidate.revision < 1
  )
    throw new Error("invalid_catalog_candidate");
}

function scopedKey(stationId: StableId, id: StableId): string {
  return `${stationId}\u0000${id}`;
}
