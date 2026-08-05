import { randomUUID } from "node:crypto";

import {
  assertExplicitRecoveryRetry,
  assertAssetLifecycleTransition,
  type AssetRevision,
  type AssetLifecycleState,
  type M3ImportJob,
  type M3ImportRequest,
  type OpaqueSourceReference,
  validateImportRequestInput,
  validateOpaqueReference,
} from "../domain/m3-assets.js";
import type { SqlExecutor } from "./m1-repositories.js";

export interface M3ImportRequestInput {
  idempotencyKey: string;
  source: OpaqueSourceReference;
}

interface ImportRequestRow {
  id: string;
  stationId: string;
  idempotencyKey: string;
  sourceKind: OpaqueSourceReference["kind"];
  sourceOpaqueId: string;
  lifecycleState: AssetLifecycleState;
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface ImportJobRow {
  id: string;
  stationId: string;
  requestId: string;
  lifecycleState: AssetLifecycleState;
  retryCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * PostgreSQL-only M3 control-plane persistence. No method receives file paths,
 * media bytes, provider payloads, credentials, or runtime/stream references.
 */
export class PostgresM3Repositories {
  public constructor(private readonly database: SqlExecutor) {}

  async createImportRequest(
    actorUserId: string,
    stationId: string,
    input: M3ImportRequestInput,
  ): Promise<{
    request: M3ImportRequest;
    job: M3ImportJob;
    duplicate: boolean;
  }> {
    validateImportRequestInput(input);
    const now = new Date().toISOString();
    const requestId = randomUUID();
    const inserted = await this.database.query<ImportRequestRow>(
      `INSERT INTO m3_import_requests (id,station_id,idempotency_key,source_kind,source_opaque_id,lifecycle_state,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,'proposed',$6,$6)
       ON CONFLICT (station_id,idempotency_key) DO NOTHING
       RETURNING id,station_id AS "stationId",idempotency_key AS "idempotencyKey",source_kind AS "sourceKind",source_opaque_id AS "sourceOpaqueId",lifecycle_state AS "lifecycleState",created_at AS "createdAt",updated_at AS "updatedAt"`,
      [
        requestId,
        stationId,
        input.idempotencyKey,
        input.source.kind,
        input.source.opaqueId,
        now,
      ],
    );
    const duplicate = !inserted.rows[0];
    const requestRow =
      inserted.rows[0] ??
      (
        await this.database.query<ImportRequestRow>(
          `SELECT id,station_id AS "stationId",idempotency_key AS "idempotencyKey",source_kind AS "sourceKind",source_opaque_id AS "sourceOpaqueId",lifecycle_state AS "lifecycleState",created_at AS "createdAt",updated_at AS "updatedAt"
           FROM m3_import_requests WHERE station_id=$1 AND idempotency_key=$2`,
          [stationId, input.idempotencyKey],
        )
      ).rows[0];
    if (!requestRow) throw new Error("internal_error");

    const jobId = randomUUID();
    await this.database.query(
      `INSERT INTO m3_import_jobs (id,station_id,request_id,lifecycle_state,retry_count,created_at,updated_at)
       VALUES ($1,$2,$3,'proposed',0,$4,$4)
       ON CONFLICT (station_id,request_id) DO NOTHING`,
      [jobId, stationId, requestRow.id, now],
    );
    const jobRow = (
      await this.database.query<ImportJobRow>(
        `SELECT id,station_id AS "stationId",request_id AS "requestId",lifecycle_state AS "lifecycleState",retry_count AS "retryCount",created_at AS "createdAt",updated_at AS "updatedAt"
         FROM m3_import_jobs WHERE station_id=$1 AND request_id=$2`,
        [stationId, requestRow.id],
      )
    ).rows[0];
    if (!jobRow) throw new Error("internal_error");
    if (!duplicate)
      await this.audit(
        actorUserId,
        stationId,
        "m3.import_requested",
        "media_import_request",
        requestRow.id,
      );
    return {
      request: this.request(requestRow),
      job: this.job(jobRow),
      duplicate,
    };
  }

  async listImportRequests(stationId: string): Promise<M3ImportRequest[]> {
    const result = await this.database.query<ImportRequestRow>(
      `SELECT id,station_id AS "stationId",idempotency_key AS "idempotencyKey",source_kind AS "sourceKind",source_opaque_id AS "sourceOpaqueId",lifecycle_state AS "lifecycleState",created_at AS "createdAt",updated_at AS "updatedAt"
       FROM m3_import_requests WHERE station_id=$1 ORDER BY id`,
      [stationId],
    );
    return result.rows.map((row) => this.request(row));
  }

  async readImportRequest(
    stationId: string,
    requestId: string,
  ): Promise<M3ImportRequest> {
    const result = await this.database.query<ImportRequestRow>(
      `SELECT id,station_id AS "stationId",idempotency_key AS "idempotencyKey",source_kind AS "sourceKind",source_opaque_id AS "sourceOpaqueId",lifecycle_state AS "lifecycleState",created_at AS "createdAt",updated_at AS "updatedAt"
       FROM m3_import_requests WHERE id=$1 AND station_id=$2`,
      [requestId, stationId],
    );
    if (!result.rows[0]) throw new Error("not_found");
    return this.request(result.rows[0]);
  }

  async transitionImportRequest(
    actorUserId: string,
    stationId: string,
    requestId: string,
    next: AssetLifecycleState,
  ): Promise<M3ImportRequest> {
    const current = await this.readImportRequest(stationId, requestId);
    assertAssetLifecycleTransition(current.lifecycleState, next);
    const result = await this.database.query<ImportRequestRow>(
      `UPDATE m3_import_requests SET lifecycle_state=$1,updated_at=now()
       WHERE id=$2 AND station_id=$3 AND lifecycle_state=$4
       RETURNING id,station_id AS "stationId",idempotency_key AS "idempotencyKey",source_kind AS "sourceKind",source_opaque_id AS "sourceOpaqueId",lifecycle_state AS "lifecycleState",created_at AS "createdAt",updated_at AS "updatedAt"`,
      [next, requestId, stationId, current.lifecycleState],
    );
    if (!result.rows[0]) throw new Error("invalid_lifecycle_transition");
    await this.database.query(
      `UPDATE m3_import_jobs SET lifecycle_state=$1,updated_at=now()
       WHERE request_id=$2 AND station_id=$3`,
      [next, requestId, stationId],
    );
    await this.audit(
      actorUserId,
      stationId,
      `m3.import_${next}`,
      "media_import_request",
      requestId,
    );
    return this.request(result.rows[0]);
  }

  async recordFailure(
    actorUserId: string,
    stationId: string,
    jobId: string,
    category:
      | "validation"
      | "limits"
      | "unsupported_format"
      | "analysis"
      | "metadata"
      | "internal",
    retryable: boolean,
  ): Promise<void> {
    const owned = await this.database.query<ImportJobRow>(
      `SELECT id,station_id AS "stationId",request_id AS "requestId",lifecycle_state AS "lifecycleState",retry_count AS "retryCount",created_at AS "createdAt",updated_at AS "updatedAt"
       FROM m3_import_jobs WHERE id=$1 AND station_id=$2`,
      [jobId, stationId],
    );
    const job = owned.rows[0];
    if (!job) throw new Error("not_found");
    const next = retryable ? "failed" : "quarantined";
    assertAssetLifecycleTransition(job.lifecycleState, next);
    const request = await this.readImportRequest(stationId, job.requestId);
    assertAssetLifecycleTransition(request.lifecycleState, next);
    await this.database.query(
      `INSERT INTO m3_job_failures (id,station_id,job_id,category,retryable,occurred_at)
       VALUES ($1,$2,$3,$4,$5,now())`,
      [randomUUID(), stationId, jobId, category, retryable],
    );
    await this.database.query(
      `UPDATE m3_import_jobs SET lifecycle_state=$1,retry_count=retry_count+1,updated_at=now()
       WHERE id=$2 AND station_id=$3 AND lifecycle_state=$4`,
      [next, jobId, stationId, job.lifecycleState],
    );
    await this.database.query(
      `UPDATE m3_import_requests SET lifecycle_state=$1,updated_at=now()
       WHERE id=$2 AND station_id=$3 AND lifecycle_state=$4`,
      [next, job.requestId, stationId, request.lifecycleState],
    );
    await this.audit(
      actorUserId,
      stationId,
      "m3.processing_failure_recorded",
      "media_import_job",
      jobId,
    );
  }

  /**
   * An explicit control-plane retry records only the legal lifecycle recovery.
   * It does not resolve a source reference or enqueue/dispatch any processing.
   */
  async retryImportRequest(
    actorUserId: string,
    stationId: string,
    requestId: string,
  ): Promise<M3ImportRequest> {
    const current = await this.readImportRequest(stationId, requestId);
    const job = (
      await this.database.query<ImportJobRow>(
        `SELECT id,station_id AS "stationId",request_id AS "requestId",lifecycle_state AS "lifecycleState",retry_count AS "retryCount",created_at AS "createdAt",updated_at AS "updatedAt"
         FROM m3_import_jobs WHERE request_id=$1 AND station_id=$2`,
        [requestId, stationId],
      )
    ).rows[0];
    if (!job) throw new Error("not_found");
    const failure = (
      await this.database.query<{ retryable: boolean }>(
        `SELECT retryable FROM m3_job_failures
         WHERE job_id=$1 AND station_id=$2 ORDER BY occurred_at DESC LIMIT 1`,
        [job.id, stationId],
      )
    ).rows[0];
    const next = assertExplicitRecoveryRetry(
      current.lifecycleState,
      failure?.retryable
        ? "requires_explicit_authorized_retry"
        : "not_eligible",
    );
    const requestResult = await this.database.query<ImportRequestRow>(
      `UPDATE m3_import_requests SET lifecycle_state=$1,updated_at=now()
       WHERE id=$2 AND station_id=$3 AND lifecycle_state=$4
       RETURNING id,station_id AS "stationId",idempotency_key AS "idempotencyKey",source_kind AS "sourceKind",source_opaque_id AS "sourceOpaqueId",lifecycle_state AS "lifecycleState",created_at AS "createdAt",updated_at AS "updatedAt"`,
      [next, requestId, stationId, current.lifecycleState],
    );
    const row = requestResult.rows[0];
    if (!row) throw new Error("invalid_lifecycle_transition");
    await this.database.query(
      `UPDATE m3_import_jobs SET lifecycle_state=$1,updated_at=now()
       WHERE id=$2 AND station_id=$3 AND lifecycle_state=$4`,
      [next, job.id, stationId, job.lifecycleState],
    );
    await this.audit(
      actorUserId,
      stationId,
      "m3.intake_retry_authorized",
      "media_import_request",
      requestId,
    );
    return this.request(row);
  }

  async appendAssetRevision(
    actorUserId: string,
    stationId: string,
    assetId: string,
    source: OpaqueSourceReference,
    provenanceReference: string,
    checksumSha256?: string,
  ): Promise<AssetRevision> {
    if (
      !["operator_staged_reference", "managed_source_reference"].includes(
        source.kind,
      )
    )
      throw new Error("invalid_source_kind");
    validateOpaqueReference(source.opaqueId);
    validateOpaqueReference(provenanceReference);
    if (checksumSha256 !== undefined && !/^[a-f0-9]{64}$/i.test(checksumSha256))
      throw new Error("invalid_checksum");
    const owned = await this.database.query<{ revision: number }>(
      `SELECT COALESCE(MAX(revision),0)::integer AS revision FROM m3_asset_revisions
       WHERE asset_id=$1 AND station_id=$2`,
      [assetId, stationId],
    );
    const asset = await this.database.query(
      `SELECT 1 FROM m3_assets WHERE id=$1 AND station_id=$2`,
      [assetId, stationId],
    );
    if (!asset.rowCount) throw new Error("not_found");
    const revision = (owned.rows[0]?.revision ?? 0) + 1;
    const id = randomUUID();
    const now = new Date().toISOString();
    const result = await this.database.query<{
      id: string;
      stationId: string;
      assetId: string;
      revision: number;
      sourceKind: OpaqueSourceReference["kind"];
      sourceOpaqueId: string;
      provenanceReference: string;
      checksumSha256?: string;
      createdAt: Date | string;
    }>(
      `INSERT INTO m3_asset_revisions (id,station_id,asset_id,revision,source_kind,source_opaque_id,provenance_reference,checksum_sha256,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id,station_id AS "stationId",asset_id AS "assetId",revision,source_kind AS "sourceKind",source_opaque_id AS "sourceOpaqueId",provenance_reference AS "provenanceReference",checksum_sha256 AS "checksumSha256",created_at AS "createdAt"`,
      [
        id,
        stationId,
        assetId,
        revision,
        source.kind,
        source.opaqueId,
        provenanceReference,
        checksumSha256 ?? null,
        now,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error("internal_error");
    await this.audit(
      actorUserId,
      stationId,
      "m3.asset_revision_appended",
      "asset_revision",
      id,
    );
    return {
      id: row.id,
      stationId: row.stationId,
      assetId: row.assetId,
      revision: row.revision,
      source: { kind: row.sourceKind, opaqueId: row.sourceOpaqueId },
      provenanceReference: row.provenanceReference,
      checksumSha256: row.checksumSha256,
      createdAt: timestamp(row.createdAt),
    };
  }

  async resolveMetadataCandidate(
    actorUserId: string,
    stationId: string,
    candidateId: string,
    resolution: "approved" | "rejected",
  ): Promise<void> {
    const candidate = await this.database.query(
      `SELECT 1 FROM m3_metadata_candidates WHERE id=$1 AND station_id=$2`,
      [candidateId, stationId],
    );
    if (!candidate.rowCount) throw new Error("not_found");
    await this.database.query(
      `INSERT INTO m3_metadata_resolutions (id,station_id,candidate_id,resolution_state,actor_user_id,resolved_at)
       VALUES ($1,$2,$3,$4,$5,now())`,
      [randomUUID(), stationId, candidateId, resolution, actorUserId],
    );
    await this.audit(
      actorUserId,
      stationId,
      "m3.metadata_candidate_resolved",
      "metadata_candidate",
      candidateId,
    );
  }

  async auditRejection(
    actorUserId: string | undefined,
    stationId: string,
    entityId = "request",
  ): Promise<void> {
    await this.audit(
      actorUserId,
      stationId,
      "m3.request_rejected",
      "m3_import_request",
      entityId,
    );
  }

  private request(row: ImportRequestRow): M3ImportRequest {
    return {
      id: row.id,
      stationId: row.stationId,
      idempotencyKey: row.idempotencyKey,
      source: { kind: row.sourceKind, opaqueId: row.sourceOpaqueId },
      lifecycleState: row.lifecycleState,
      createdAt: timestamp(row.createdAt),
      updatedAt: timestamp(row.updatedAt),
    };
  }

  private job(row: ImportJobRow): M3ImportJob {
    return {
      id: row.id,
      stationId: row.stationId,
      requestId: row.requestId,
      lifecycleState: row.lifecycleState,
      retryCount: row.retryCount,
      createdAt: timestamp(row.createdAt),
      updatedAt: timestamp(row.updatedAt),
    };
  }

  private async audit(
    actorUserId: string | undefined,
    stationId: string,
    action: string,
    entityType: string,
    entityId: string,
  ): Promise<void> {
    await this.database.query(
      `INSERT INTO audit_events (id,actor_user_id,station_id,occurred_at,action,entity_type,entity_id,detail)
       VALUES ($1,$2,$3,now(),$4,$5,$6,$7)`,
      [
        randomUUID(),
        actorUserId ?? null,
        stationId,
        action,
        entityType,
        entityId,
        "M3 content-free control-plane event",
      ],
    );
  }
}

function timestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
