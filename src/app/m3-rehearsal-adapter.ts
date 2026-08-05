/**
 * M3.12 rehearsal-only contract. This is intentionally an in-memory,
 * deterministic double: it has no filesystem, process, database, provider,
 * network, UI, or API adapter. Production/default dispatch remains disabled.
 */
export const M3_REHEARSAL_OPT_IN = "m3.12-isolated-rehearsal-v1" as const;

export type M3RehearsalOutcome =
  | "completed_deterministic_double"
  | "quarantined"
  | "unavailable";

export interface M3RehearsalRequest {
  id: string;
  stationId: string;
  idempotencyKey: string;
  actionId: string;
  fixtureReference: string;
  activation: string;
  metadataMode: "deterministic_double" | "unavailable" | "failed";
}

export interface M3RehearsalEvidence {
  action: "m3.rehearsal.completed" | "m3.rehearsal.quarantined";
  id: string;
  stationId: string;
  outcome: M3RehearsalOutcome;
  processing: "deterministic_double" | "not_run";
  metadata: "deterministic_double" | "unavailable" | "failed" | "not_run";
  cleanup: "established";
  recovery: "established";
}

export class M3RehearsalAdapter {
  readonly #requests = new Map<string, M3RehearsalEvidence>();

  public run(request: M3RehearsalRequest): M3RehearsalEvidence {
    if (request.activation !== M3_REHEARSAL_OPT_IN)
      return this.quarantine(request, "unavailable", "not_run");
    if (
      !request.id ||
      !request.stationId ||
      !request.actionId ||
      !request.fixtureReference
    )
      throw new Error("invalid_rehearsal_request");
    const key = `${request.stationId}:${request.idempotencyKey}`;
    const existing = this.#requests.get(key);
    if (existing) return existing;
    const evidence =
      request.metadataMode === "failed"
        ? this.quarantine(request, "quarantined", "failed")
        : request.metadataMode === "unavailable"
          ? this.quarantine(request, "unavailable", "unavailable")
          : Object.freeze({
              action: "m3.rehearsal.completed" as const,
              id: request.id,
              stationId: request.stationId,
              outcome: "completed_deterministic_double" as const,
              processing: "deterministic_double" as const,
              metadata: "deterministic_double" as const,
              cleanup: "established" as const,
              recovery: "established" as const,
            });
    this.#requests.set(key, evidence);
    return evidence;
  }

  public read(stationId: string, idempotencyKey: string): M3RehearsalEvidence {
    const evidence = this.#requests.get(`${stationId}:${idempotencyKey}`);
    if (!evidence) throw new Error("not_found");
    return evidence;
  }

  public assertSameStation(
    stationId: string,
    evidence: M3RehearsalEvidence,
  ): void {
    if (stationId !== evidence.stationId)
      throw new Error("station_reference_forbidden");
  }

  private quarantine(
    request: M3RehearsalRequest,
    outcome: "quarantined" | "unavailable",
    metadata: "failed" | "unavailable" | "not_run",
  ): M3RehearsalEvidence {
    return Object.freeze({
      action: "m3.rehearsal.quarantined",
      id: request.id,
      stationId: request.stationId,
      outcome,
      processing: "not_run",
      metadata,
      cleanup: "established",
      recovery: "established",
    });
  }
}
