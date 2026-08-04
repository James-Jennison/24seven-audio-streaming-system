import assert from "node:assert/strict";
import test from "node:test";

import { renderDashboard } from "../src/ui/dashboard.js";
import { seededStations } from "../src/domain/stations.js";

test("dashboard displays every seeded station and the M0 unavailable state", () => {
  const html = renderDashboard(seededStations, {
    version: "0.1.0-test",
    buildId: "test-build",
  });
  assert.equal((html.match(/class="station-card"/g) ?? []).length, 5);
  for (const station of seededStations)
    assert.match(html, new RegExp(station.name.replace(".", "\\.")));
  assert.match(html, /Audio runtime not implemented\./);
  assert.match(html, /Not implemented in M0/);
  assert.match(html, /Version <span data-version>0.1.0-test<\/span>/);
  assert.match(html, /Build <span data-build-id>test-build<\/span>/);
});
