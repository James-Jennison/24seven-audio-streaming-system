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

test("M1 operator UI stops at the proposed preview boundary", () => {
  const html = renderDashboard(seededStations, {
    version: "acceptance-test",
    buildId: "acceptance-test",
  });

  assert.match(html, /Proposed \/ Preview/);
  assert.match(html, /No approval action is exposed by the current M1 API/);
  assert.match(html, /no published version is available/);
  assert.match(html, /Runtime controls are unavailable and not rendered here/);
  assert.match(html, /This read-only preview produces proposals only/);
  assert.match(html, /window\.confirm\(/);
  assert.doesNotMatch(html, /<input[^>]+type="file"/i);
  assert.doesNotMatch(
    html,
    /\/api\/v1\/[^"']*\/(?:approve|publish|execute|playout|encoder|relay|stream)/i,
  );
  assert.doesNotMatch(
    html,
    /<audio|<video|Icecast|SHOUTcast|Liquidsoap|FFmpeg/i,
  );
});

test("M1 live composition is PostgreSQL-only and has no runtime bridge", () => {
  const entrypoint = source("../src/index.js");
  const routes = source("../src/api/m1-programming-routes.js");
  const packageJson = source("../../package.json");

  assert.match(entrypoint, /new PostgresPersistence\(databaseUrl\)/);
  assert.match(entrypoint, /new PostgresM1Repositories\(/);
  assert.doesNotMatch(entrypoint, /m1-store|node:sqlite|SqlitePersistence/i);
  assert.doesNotMatch(
    `${entrypoint}\n${routes}`,
    /child_process|spawn\(|exec\(|Liquidsoap|FFmpeg|Icecast|SHOUTcast|playout|encoder|relay/i,
  );
  assert.doesNotMatch(packageJson, /"check"[^\n]*\bmigrate\b/);
});
