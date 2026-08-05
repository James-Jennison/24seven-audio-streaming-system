import assert from "node:assert/strict";
import test from "node:test";

import { renderDashboard } from "../src/ui/dashboard.js";
import { seededStations } from "../src/domain/stations.js";

test("M3.8 dashboard renders a station-scoped, accessible visual shell", () => {
  const html = renderDashboard(seededStations, {
    version: "0.1.0-test",
    buildId: "test-build",
  });
  assert.match(html, /id="operator-shell"/);
  assert.match(html, /24Seven\.FM Operator Dashboard/);
  assert.match(html, /Local-only visual workspace/);
  assert.match(html, /href="#dashboard-content"/);
  assert.match(html, /"aria-label": "Operator dashboard sections"/);
  assert.match(html, /Station context/);
  assert.match(html, /System overview/);
  assert.match(html, /Programming Control Plane/);
  assert.match(html, /Media Workspace/);
  assert.match(html, /Playout & Automation Runtime/);
  assert.match(html, /Source Encoder Layer/);
  assert.match(html, /Listener-Facing Icecast Layer/);
  assert.match(html, /Audit \/ operational evidence/);
  assert.match(html, /Fixture\/example status is never live station data/);
  assert.match(html, /state\.session\.stationIds\.includes\(stationId\)/);
  assert.match(
    html,
    /requested station context is unavailable for this session/,
  );
  assert.match(html, /station_reference_forbidden/);
  assert.match(html, /not_found/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-current/);
  assert.match(html, /tabindex: "-1"/);
  for (const station of seededStations)
    assert.match(html, new RegExp(station.name.replace(".", "\\.")));
});

test("M3.8 dashboard labels fixtures and unavailable planes without operational paths", () => {
  const html = renderDashboard(seededStations, {
    version: "0.1.0-test",
    buildId: "test-build",
  });
  assert.match(html, /No asset is selected/);
  assert.match(html, /Opaque station-scoped reference validation only/);
  assert.match(
    html,
    /No worker, subprocess, parser, or media-processing dispatch/,
  );
  assert.match(
    html,
    /No EBU R128 measurement, audio read, DSP, or gain application/,
  );
  assert.match(
    html,
    /No detection, waveform access, or playout setting application/,
  );
  assert.match(
    html,
    /No provider lookup, media-tag extraction, automatic overwrite, or stream metadata publication/,
  );
  assert.match(html, /No live evidence record is loaded/);
  assert.match(
    html,
    /Operational activation requires a separately approved milestone/,
  );
  assert.match(html, /Published \(Versioned\)/);
  assert.match(html, /Executed \(Runtime\)/);
  assert.match(html, /--background: #0b1118/);
  assert.match(html, /--primary: #91d4ff/);
  assert.doesNotMatch(html, /api\/v1\/stations\//);
  assert.doesNotMatch(
    html,
    /Process now|Run now|Publish schedule|Start runtime|Restart encoder/,
  );
  assert.doesNotMatch(html, /SHOUTcast|Liquidsoap|FFmpeg|MusicBrainz/);
  assert.match(html, /Version <span data-version>0.1.0-test<\/span>/);
  assert.match(html, /Build <span data-build-id>test-build<\/span>/);
});
