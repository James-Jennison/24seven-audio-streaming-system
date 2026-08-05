import type { StableId } from "../domain/contracts.js";
import { validateOpaqueReference } from "../domain/m3-assets.js";
import type { M4CatalogCandidate } from "./m4-catalog-eligibility-boundary.js";

export type M4SeparationScope = "artist" | "title" | "album" | "category";

export interface M4SeparationPolicy {
  id: StableId;
  stationId: StableId;
  scope: M4SeparationScope;
  minimumCandidateDistance: number;
  precedence: number;
  status: "approved";
}

/** Opaque matching keys supplied by an approved upstream metadata boundary. */
export interface M4CandidateSeparationKeys {
  candidateId: StableId;
  stationId: StableId;
  keys: Partial<Record<M4SeparationScope, StableId>>;
}

export type M4SeparationOutcome =
  | "eligible"
  | "conflict"
  | "indeterminate"
  | "catalog_empty";

export interface M4SeparationEvidence {
  action: "m4.separation_evaluated";
  stationId: StableId;
  candidateId?: StableId;
  outcome: M4SeparationOutcome;
  category:
    | "separation_clear"
    | "separation_conflict"
    | "separation_key_unavailable"
    | "catalog_empty";
  policyId?: StableId;
}

export interface M4SeparationEvaluation {
  outcome: M4SeparationOutcome;
  evidence: M4SeparationEvidence;
  execution: "unavailable";
}

/**
 * Local-only deterministic M4.4 policy evaluation. It never reads metadata,
 * generates a schedule, alters catalog state, or dispatches a later plane.
 */
export class M4SeparationPolicyBoundary {
  private readonly candidates = new Map<string, M4CatalogCandidate>();
  private readonly keys = new Map<string, M4CandidateSeparationKeys>();
  private readonly policies = new Map<string, readonly M4SeparationPolicy[]>();

  public constructor(input: {
    candidates: readonly M4CatalogCandidate[];
    separationKeys: readonly M4CandidateSeparationKeys[];
    policies: readonly M4SeparationPolicy[];
  }) {
    for (const candidate of input.candidates) this.addCandidate(candidate);
    for (const keys of input.separationKeys) this.addKeys(keys);
    for (const policy of input.policies) this.addPolicy(policy);
  }

  /**
   * `priorCandidateIds` is ordered nearest-to-farthest by a future preview
   * generator. This method only evaluates the supplied order; it does not
   * choose candidates, assign slots, or infer a replacement.
   */
  evaluate(
    stationId: StableId,
    candidateId: StableId | undefined,
    priorCandidateIds: readonly StableId[],
  ): M4SeparationEvaluation {
    if (candidateId === undefined) {
      if (priorCandidateIds.length) throw new Error("invalid_empty_catalog");
      return result(stationId, "catalog_empty", "catalog_empty");
    }
    const candidate = this.candidates.get(scopedKey(stationId, candidateId));
    if (!candidate) throw new Error("not_found");
    const candidateKeys = this.keys.get(scopedKey(stationId, candidateId));
    const policies = this.policies.get(stationId) ?? [];

    for (const policy of policies) {
      const key = candidateKeys?.keys[policy.scope];
      if (!key)
        return result(
          stationId,
          "indeterminate",
          "separation_key_unavailable",
          candidate.id,
          policy.id,
        );
      const relevantPrior = priorCandidateIds.slice(
        0,
        policy.minimumCandidateDistance,
      );
      for (const priorCandidateId of relevantPrior) {
        const prior = this.candidates.get(
          scopedKey(stationId, priorCandidateId),
        );
        if (!prior) throw new Error("not_found");
        const priorKey = this.keys.get(scopedKey(stationId, prior.id))?.keys[
          policy.scope
        ];
        if (!priorKey)
          return result(
            stationId,
            "indeterminate",
            "separation_key_unavailable",
            candidate.id,
            policy.id,
          );
        if (key === priorKey)
          return result(
            stationId,
            "conflict",
            "separation_conflict",
            candidate.id,
            policy.id,
          );
      }
    }
    return result(stationId, "eligible", "separation_clear", candidate.id);
  }

  /** Trusted internal callers must keep approved inputs in station scope. */
  assertPolicyOwnership(stationId: StableId, policy: M4SeparationPolicy): void {
    if (policy.stationId !== stationId)
      throw new Error("station_reference_forbidden");
    validatePolicy(policy);
  }

  assertCandidateOwnership(
    stationId: StableId,
    candidate: M4CatalogCandidate,
  ): void {
    if (candidate.stationId !== stationId)
      throw new Error("station_reference_forbidden");
    validateCandidate(candidate);
  }

  private addCandidate(candidate: M4CatalogCandidate): void {
    validateCandidate(candidate);
    const key = scopedKey(candidate.stationId, candidate.id);
    if (this.candidates.has(key))
      throw new Error("duplicate_catalog_candidate");
    this.candidates.set(key, Object.freeze({ ...candidate }));
  }

  private addKeys(keys: M4CandidateSeparationKeys): void {
    validateKeys(keys);
    if (!this.candidates.has(scopedKey(keys.stationId, keys.candidateId)))
      throw new Error("not_found");
    const key = scopedKey(keys.stationId, keys.candidateId);
    if (this.keys.has(key)) throw new Error("duplicate_separation_keys");
    this.keys.set(
      key,
      Object.freeze({ ...keys, keys: Object.freeze({ ...keys.keys }) }),
    );
  }

  private addPolicy(policy: M4SeparationPolicy): void {
    validatePolicy(policy);
    const current = this.policies.get(policy.stationId) ?? [];
    if (current.some((item) => item.id === policy.id))
      throw new Error("duplicate_separation_policy");
    this.policies.set(
      policy.stationId,
      Object.freeze(
        [...current, Object.freeze({ ...policy })].sort(
          (left, right) =>
            left.precedence - right.precedence ||
            left.id.localeCompare(right.id),
        ),
      ),
    );
  }
}

function result(
  stationId: StableId,
  outcome: M4SeparationOutcome,
  category: M4SeparationEvidence["category"],
  candidateId?: StableId,
  policyId?: StableId,
): M4SeparationEvaluation {
  return Object.freeze({
    outcome,
    evidence: Object.freeze({
      action: "m4.separation_evaluated",
      stationId,
      ...(candidateId === undefined ? {} : { candidateId }),
      outcome,
      category,
      ...(policyId === undefined ? {} : { policyId }),
    }),
    execution: "unavailable",
  });
}

function validateCandidate(candidate: M4CatalogCandidate): void {
  validateOpaqueReference(candidate.id);
  validateOpaqueReference(candidate.stationId);
  validateOpaqueReference(candidate.assetId);
  validateOpaqueReference(candidate.assetRevisionId);
  if (candidate.eligibility !== "ready_for_schedule_use")
    throw new Error("invalid_catalog_candidate");
}

function validateKeys(keys: M4CandidateSeparationKeys): void {
  validateOpaqueReference(keys.candidateId);
  validateOpaqueReference(keys.stationId);
  for (const key of Object.values(keys.keys)) {
    if (key !== undefined) validateOpaqueReference(key);
  }
}

function validatePolicy(policy: M4SeparationPolicy): void {
  validateOpaqueReference(policy.id);
  validateOpaqueReference(policy.stationId);
  if (
    !(["artist", "title", "album", "category"] as const).includes(policy.scope)
  )
    throw new Error("invalid_separation_scope");
  if (
    policy.status !== "approved" ||
    !Number.isInteger(policy.minimumCandidateDistance) ||
    policy.minimumCandidateDistance < 1 ||
    !Number.isInteger(policy.precedence) ||
    policy.precedence < 0
  )
    throw new Error("invalid_separation_policy");
}

function scopedKey(stationId: StableId, id: StableId): string {
  return `${stationId}\u0000${id}`;
}
