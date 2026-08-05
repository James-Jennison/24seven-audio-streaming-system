import assert from "node:assert/strict";
import test from "node:test";

import { renderDashboard } from "../src/ui/dashboard.js";
import { seededStations } from "../src/domain/stations.js";

test("operator shell preserves the configured stations and makes the control-plane boundary explicit", () => {
  const html = renderDashboard(seededStations, {
    version: "0.1.0-test",
    buildId: "test-build",
  });
  assert.match(html, /id="operator-shell"/);
  assert.match(html, /Programming control plane/);
  assert.match(html, /Proposed \/ Preview/);
  assert.match(html, /Published \(Versioned\)/);
  assert.match(html, /Executed \(Runtime\)/);
  assert.match(
    html,
    /M3 approval only permits a future sandbox boundary; it starts no worker/,
  );
  assert.match(
    html,
    /M5 runtime controls are unavailable and not rendered here/,
  );
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Station context/);
  assert.match(html, /x-csrf-token/);
  assert.match(html, /station_reference_forbidden/);
  assert.match(html, /not_found/);
  assert.match(html, /Read-only access/);
  assert.match(html, /Deterministic dry-run preview/);
  assert.match(html, /This read-only preview produces proposals only/);
  assert.match(html, /Authorize eligible retry \(no processing\)/);
  assert.match(html, /Rejected requests are terminal/);
  assert.match(html, /--background: #0f1419/);
  assert.match(html, /--primary: #9dcbff/);
  for (const label of [
    "Library metadata",
    "Playlists",
    "Separation rules",
    "Rotations",
    "Clocks",
    "Program blocks",
    "Scheduled events",
    "M3 media import requests",
  ])
    assert.match(html, new RegExp(label));
  for (const station of seededStations)
    assert.match(html, new RegExp(station.name.replace(".", "\\.")));
  assert.doesNotMatch(html, /Icecast|SHOUTcast|Liquidsoap|FFmpeg/);
  assert.match(html, /Version <span data-version>0.1.0-test<\/span>/);
  assert.match(html, /Build <span data-build-id>test-build<\/span>/);
});
