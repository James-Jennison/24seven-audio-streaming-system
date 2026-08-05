import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { renderDashboard } from "../src/ui/dashboard.js";
import { seededStations } from "../src/domain/stations.js";

function source(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

test("operator UI keeps the accepted control-plane boundary in the M3.8 visual shell", () => {
  const html = renderDashboard(seededStations, {
    version: "acceptance-test",
    buildId: "acceptance-test",
  });

  assert.match(html, /Programming state remains Proposed\/Preview \(Dry-Run\)/);
  assert.match(
    html,
    /M3 asset readiness is separate from publication and execution/,
  );
  assert.match(html, /This M3\.8 dashboard shell is read-only/);
  assert.match(
    html,
    /No worker, subprocess, parser, or media-processing dispatch/,
  );
  assert.match(
    html,
    /No encoder profile, relay, or source operation is reachable from this dashboard/,
  );
  assert.doesNotMatch(html, /<input[^>]+type="file"/i);
  assert.doesNotMatch(html, /\/api\/v1\/stations\//i);
  assert.doesNotMatch(html, /<audio|<video|SHOUTcast|Liquidsoap|FFmpeg/i);
});

test("M1 live composition is PostgreSQL-only and has no runtime bridge", () => {
  const entrypoint = source("../src/index.js");
  const routes = source("../src/api/m1-programming-routes.js");
  const m3Routes = source("../src/api/m3-asset-routes.js");
  const packageJson = source("../../package.json");

  assert.match(entrypoint, /new PostgresPersistence\(databaseUrl\)/);
  assert.match(entrypoint, /new PostgresM1Repositories\(/);
  assert.doesNotMatch(entrypoint, /m1-store|node:sqlite|SqlitePersistence/i);
  assert.doesNotMatch(
    `${entrypoint}\n${routes}`,
    /child_process|spawn\(|exec\(|Liquidsoap|FFmpeg|Icecast|SHOUTcast|playout|encoder|relay/i,
  );
  assert.doesNotMatch(m3Routes, /child_process|spawn\(|exec\(|fetch\(/i);
  assert.doesNotMatch(packageJson, /"check"[^\n]*\bmigrate\b/);
});
