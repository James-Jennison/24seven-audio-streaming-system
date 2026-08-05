import assert from "node:assert/strict";
import test from "node:test";

import {
  PostgresM3Repositories,
  type M3ImportRequestInput,
} from "../src/db/m3-repositories.js";
import type { SqlExecutor } from "../src/db/m1-repositories.js";

const input: M3ImportRequestInput = {
  idempotencyKey: "request:0001",
  source: { kind: "operator_staged_reference", opaqueId: "source:0001" },
};

test("M3 repository scopes request, job, and metadata operations by station", async () => {
  const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
  const db: SqlExecutor = {
    async query<T>(text: string, values?: readonly unknown[]) {
      calls.push({ text, values });
      if (text.startsWith("INSERT INTO m3_import_requests"))
        return { rows: [requestRow()] as unknown as T[], rowCount: 1 };
      if (
        text.startsWith("SELECT id,station_id") &&
        text.includes("m3_import_jobs")
      )
        return { rows: [jobRow()] as unknown as T[], rowCount: 1 };
      if (text.includes("FROM m3_import_requests WHERE id=$1"))
        return { rows: [requestRow()] as unknown as T[], rowCount: 1 };
      if (text.startsWith("UPDATE m3_import_requests"))
        return {
          rows: [
            { ...requestRow(), lifecycleState: "validated" },
          ] as unknown as T[],
          rowCount: 1,
        };
      return { rows: [] as T[], rowCount: 1 };
    },
  };
  const repo = new PostgresM3Repositories(db);
  const created = await repo.createImportRequest("user-a", "station-a", input);
  assert.equal(created.request.stationId, "station-a");
  assert.equal(created.job.requestId, "request-a");
  await repo.transitionImportRequest(
    "user-a",
    "station-a",
    "request-a",
    "validated",
  );
  await repo.resolveMetadataCandidate(
    "user-a",
    "station-a",
    "candidate-a",
    "approved",
  );
  const allSql = calls.map((call) => call.text).join("\n");
  assert.match(allSql, /WHERE id=\$1 AND station_id=\$2/);
  const auditValues = calls
    .filter((call) => call.text.includes("audit_events"))
    .map((call) => JSON.stringify(call.values))
    .join(" ");
  assert.doesNotMatch(auditValues, /source:0001|request:0001|unsafe\.mp3/);
  assert.doesNotMatch(allSql, /UPDATE m3_metadata_candidates/);
});

test("M3 import requests are idempotent within one station", async () => {
  const calls: string[] = [];
  const repo = new PostgresM3Repositories({
    async query<T>(text: string) {
      calls.push(text);
      if (text.startsWith("INSERT INTO m3_import_requests"))
        return { rows: [] as T[], rowCount: 0 };
      if (text.includes("FROM m3_import_requests WHERE station_id=$1"))
        return { rows: [requestRow()] as unknown as T[], rowCount: 1 };
      if (text.includes("FROM m3_import_jobs"))
        return { rows: [jobRow()] as unknown as T[], rowCount: 1 };
      return { rows: [] as T[], rowCount: 1 };
    },
  });
  const result = await repo.createImportRequest("user-a", "station-a", input);
  assert.equal(result.duplicate, true);
  assert.equal(result.request.id, "request-a");
  assert.equal(calls.filter((text) => text.includes("audit_events")).length, 0);
});

test("M3 repository returns not_found for an out-of-scope request without ownership disclosure", async () => {
  const repo = new PostgresM3Repositories({
    async query<T>() {
      return { rows: [] as T[], rowCount: 0 };
    },
  });
  await assert.rejects(
    () => repo.readImportRequest("station-b", "request-a"),
    /not_found/,
  );
});

test("M3 retry requires retained eligibility, scopes every lookup, and records no dispatch", async () => {
  const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
  const repo = new PostgresM3Repositories({
    async query<T>(text: string, values?: readonly unknown[]) {
      calls.push({ text, values });
      if (text.includes("FROM m3_import_requests WHERE id=$1"))
        return {
          rows: [
            { ...requestRow(), lifecycleState: "quarantined" },
          ] as unknown as T[],
          rowCount: 1,
        };
      if (text.includes("FROM m3_import_jobs WHERE request_id=$1"))
        return {
          rows: [
            { ...jobRow(), lifecycleState: "quarantined" },
          ] as unknown as T[],
          rowCount: 1,
        };
      if (text.includes("FROM m3_job_failures"))
        return {
          rows: [{ retryable: true }] as unknown as T[],
          rowCount: 1,
        };
      if (text.startsWith("UPDATE m3_import_requests"))
        return {
          rows: [
            { ...requestRow(), lifecycleState: "validated" },
          ] as unknown as T[],
          rowCount: 1,
        };
      return { rows: [] as T[], rowCount: 1 };
    },
  });

  const retried = await repo.retryImportRequest(
    "user-a",
    "station-a",
    "request-a",
  );
  assert.equal(retried.lifecycleState, "validated");
  const allSql = calls.map((call) => call.text).join("\n");
  assert.match(allSql, /m3_job_failures[\s\S]*job_id=\$1 AND station_id=\$2/);
  assert.match(
    allSql,
    /UPDATE m3_import_requests[\s\S]*id=\$2 AND station_id=\$3/,
  );
  const auditValues = calls
    .filter((call) => call.text.includes("audit_events"))
    .flatMap((call) => call.values ?? [])
    .join(" ");
  assert.match(auditValues, /m3\.intake_retry_authorized/);
  assert.doesNotMatch(
    allSql,
    /worker|ffmpeg|network|playout|encoder|relay|icecast/i,
  );
});

test("M3 retry returns not_found for an out-of-scope request", async () => {
  const repo = new PostgresM3Repositories({
    async query<T>() {
      return { rows: [] as T[], rowCount: 0 };
    },
  });
  await assert.rejects(
    () => repo.retryImportRequest("user-a", "station-b", "request-a"),
    /not_found/,
  );
});

test("M3 revision persistence appends provenance and never updates an approved revision", async () => {
  const calls: string[] = [];
  const repo = new PostgresM3Repositories({
    async query<T>(text: string) {
      calls.push(text);
      if (text.startsWith("SELECT COALESCE(MAX"))
        return { rows: [{ revision: 2 }] as unknown as T[], rowCount: 1 };
      if (text.startsWith("INSERT INTO m3_asset_revisions"))
        return {
          rows: [
            {
              id: "revision-a",
              stationId: "station-a",
              assetId: "asset-a",
              revision: 3,
              sourceKind: "operator_staged_reference",
              sourceOpaqueId: "source:0002",
              provenanceReference: "provenance:0002",
              checksumSha256: undefined,
              createdAt: "2026-08-04T00:00:00.000Z",
            },
          ] as unknown as T[],
          rowCount: 1,
        };
      return { rows: [] as T[], rowCount: 1 };
    },
  });
  const revision = await repo.appendAssetRevision(
    "user-a",
    "station-a",
    "asset-a",
    { kind: "operator_staged_reference", opaqueId: "source:0002" },
    "provenance:0002",
  );
  assert.equal(revision.revision, 3);
  assert.match(calls.join("\n"), /INSERT INTO m3_asset_revisions/);
  assert.doesNotMatch(calls.join("\n"), /UPDATE m3_asset_revisions/);
});

test("M3 migration enforces same-station foreign references and append-only records", async () => {
  const migration = await import("node:fs/promises").then(({ readFile }) =>
    readFile(
      new URL("../migrations/003_m3_asset_lifecycle.sql", import.meta.url),
      "utf8",
    ),
  );
  assert.match(
    migration,
    /FOREIGN KEY \(request_id, station_id\) REFERENCES m3_import_requests\(id, station_id\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \(asset_id, station_id\) REFERENCES m3_assets\(id, station_id\)/,
  );
  assert.match(migration, /m3_asset_revisions_immutable/);
  assert.match(migration, /m3_assert_lifecycle_transition/);
  assert.doesNotMatch(migration, /SQLite/i);
});

function requestRow() {
  return {
    id: "request-a",
    stationId: "station-a",
    idempotencyKey: "request:0001",
    sourceKind: "operator_staged_reference" as const,
    sourceOpaqueId: "source:0001",
    lifecycleState: "proposed" as const,
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
  };
}

function jobRow() {
  return {
    id: "job-a",
    stationId: "station-a",
    requestId: "request-a",
    lifecycleState: "proposed" as const,
    retryCount: 0,
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
  };
}
