import {
  isUtcTimestamp,
  type StableId,
  type UtcTimestamp,
} from "../domain/contracts.js";
import { validateOpaqueReference } from "../domain/m3-assets.js";

export const M5_RUNTIME_OBSERVATION_CONTRACT =
  "m5.runtime-observation.v1" as const;

export type M5Plane =
  | "programming_control_plane"
  | "playout_automation_runtime"
  | "source_encoder_layer"
  | "listener_facing_icecast_layer";

export type M5Authority = "write" | "read_only" | "none";

export interface M5RuntimeAuthorityMatrixEntry {
  plane: M5Plane;
  programmingState: M5Authority;
  runtimeObservation: M5Authority;
  outputControl: M5Authority;
}

/**
 * The complete M5.1 writer matrix. It is a contract, not a dispatch table:
 * no entry creates a process, route, connection, or output capability.
 */
export const M5_RUNTIME_AUTHORITY_MATRIX: readonly M5RuntimeAuthorityMatrixEntry[] =
  Object.freeze([
    Object.freeze({
      plane: "programming_control_plane",
      programmingState: "write",
      runtimeObservation: "read_only",
      outputControl: "none",
    }),
    Object.freeze({
      plane: "playout_automation_runtime",
      programmingState: "read_only",
      runtimeObservation: "write",
      outputControl: "none",
    }),
    Object.freeze({
      plane: "source_encoder_layer",
      programmingState: "none",
      runtimeObservation: "read_only",
      outputControl: "none",
    }),
    Object.freeze({
      plane: "listener_facing_icecast_layer",
      programmingState: "none",
      runtimeObservation: "read_only",
      outputControl: "none",
    }),
  ]);

/** A content-free, runtime-originated safe-stop observation. */
export interface M5RuntimeUnavailableObservation {
  id: StableId;
  stationId: StableId;
  contract: typeof M5_RUNTIME_OBSERVATION_CONTRACT;
  runtimeInstanceId: StableId;
  observedAt: UtcTimestamp;
  sequence: number;
  availability: "unavailable";
  status: "safe_stop";
}

/** The Control Plane may display this record but may not write it. */
export interface M5RuntimeUnavailableStatus {
  id: StableId;
  stationId: StableId;
  observationId: StableId;
  availability: "unavailable";
  status: "safe_stop";
}

/**
 * A local-only, read-only M5.1 boundary. Future runtime transport and daemon
 * work remain separately gated; this class intentionally accepts observations
 * only at construction and exposes no command or execution API.
 */
export class M5RuntimeAuthorityBoundary {
  private readonly observations = new Map<
    string,
    M5RuntimeUnavailableObservation
  >();

  public constructor(observations: readonly M5RuntimeUnavailableObservation[]) {
    for (const observation of observations) this.addObservation(observation);
  }

  public unavailableStatus(
    stationId: StableId,
    observationId: StableId,
  ): M5RuntimeUnavailableStatus {
    validateOpaqueReference(stationId);
    validateOpaqueReference(observationId);
    const observation = this.observations.get(
      scopedKey(stationId, observationId),
    );
    if (!observation) throw new Error("not_found");
    return Object.freeze({
      id: `runtime-status:${observation.id}`,
      stationId: observation.stationId,
      observationId: observation.id,
      availability: "unavailable",
      status: "safe_stop",
    });
  }

  /** Trusted internal callers must reject a mismatched station explicitly. */
  public assertObservationOwnership(
    stationId: StableId,
    observation: M5RuntimeUnavailableObservation,
  ): void {
    if (stationId !== observation.stationId)
      throw new Error("station_reference_forbidden");
    validateM5RuntimeUnavailableObservation(observation);
  }

  private addObservation(observation: M5RuntimeUnavailableObservation): void {
    validateM5RuntimeUnavailableObservation(observation);
    const key = scopedKey(observation.stationId, observation.id);
    if (this.observations.has(key))
      throw new Error("duplicate_runtime_observation");
    this.observations.set(key, Object.freeze({ ...observation }));
  }
}

export function validateM5RuntimeUnavailableObservation(
  observation: M5RuntimeUnavailableObservation,
): void {
  validateOpaqueReference(observation.id);
  validateOpaqueReference(observation.stationId);
  validateOpaqueReference(observation.runtimeInstanceId);
  if (
    observation.contract !== M5_RUNTIME_OBSERVATION_CONTRACT ||
    !isUtcTimestamp(observation.observedAt) ||
    !Number.isSafeInteger(observation.sequence) ||
    observation.sequence < 0 ||
    observation.availability !== "unavailable" ||
    observation.status !== "safe_stop"
  )
    throw new Error("invalid_runtime_unavailable_observation");
}

function scopedKey(stationId: StableId, id: StableId): string {
  return `${stationId}\u0000${id}`;
}
