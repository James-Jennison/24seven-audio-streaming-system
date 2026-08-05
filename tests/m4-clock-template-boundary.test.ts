import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  M4_CIVIL_DAY_MINUTES,
  M4ClockTemplateBoundary,
  type M4ClockTemplate,
} from "../src/app/m4-clock-template-boundary.js";

const template = (
  id: string,
  stationId: string,
  timezone = "America/Los_Angeles",
): M4ClockTemplate => ({
  id,
  stationId,
  timezone,
  revision: 1,
  slots: [
    { id: "slot:late", localStartMinute: 720, durationMinutes: 720 },
    { id: "slot:early", localStartMinute: 0, durationMinutes: 720 },
  ],
});

test("M4.3 produces repeatable ordered station-local civil-day input", () => {
  const clock = template("template:0001", "station:0001");
  const boundary = new M4ClockTemplateBoundary([clock]);
  const first = boundary.prepareDayInput(
    clock.stationId,
    clock.id,
    "2026-08-05",
  );
  const second = boundary.prepareDayInput(
    clock.stationId,
    clock.id,
    "2026-08-05",
  );

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.slots.map((slot) => slot.id),
    ["slot:early", "slot:late"],
  );
  assert.equal(first.civilDayMinutes, M4_CIVIL_DAY_MINUTES);
  assert.equal(first.summary.totalLocalMinutes, M4_CIVIL_DAY_MINUTES);
  assert.equal(first.summary.execution, "unavailable");
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.slots), true);
});

test("M4.3 handles DST dates as unresolved 24-hour civil templates", () => {
  const clock = template("template:0001", "station:0001");
  const boundary = new M4ClockTemplateBoundary([clock]);
  const spring = boundary.prepareDayInput(
    clock.stationId,
    clock.id,
    "2026-03-08",
  );
  const fall = boundary.prepareDayInput(
    clock.stationId,
    clock.id,
    "2026-11-01",
  );

  for (const input of [spring, fall]) {
    assert.equal(input.timezone, "America/Los_Angeles");
    assert.equal(input.civilDayMinutes, 1_440);
    assert.equal(input.dstTreatment, "civil_time_unresolved");
    assert.equal(input.summary.execution, "unavailable");
  }
});

test("M4.3 enforces template completeness, timezone validity, and station isolation", () => {
  const owned = template("template:0001", "station:0001");
  const other = template("template:0002", "station:0002", "UTC");
  const boundary = new M4ClockTemplateBoundary([owned, other]);

  assert.throws(
    () => boundary.prepareDayInput(owned.stationId, other.id, "2026-08-05"),
    /not_found/,
  );
  assert.throws(
    () => boundary.assertTemplateOwnership(other.stationId, owned),
    /station_reference_forbidden/,
  );
  assert.throws(
    () =>
      new M4ClockTemplateBoundary([{ ...owned, timezone: "not/a-timezone" }]),
    /invalid_timezone/,
  );
  assert.throws(
    () =>
      new M4ClockTemplateBoundary([
        {
          ...owned,
          slots: [{ id: "slot:gap", localStartMinute: 1, durationMinutes: 1 }],
        },
      ]),
    /invalid_clock_template_slots/,
  );
  assert.throws(
    () => boundary.prepareDayInput(owned.stationId, owned.id, "2026-02-30"),
    /invalid_local_date/,
  );
});

test("M4.3 summaries are content-free and source imports no operational adapter", async () => {
  const clock = template("template:0001", "station:0001");
  const boundary = new M4ClockTemplateBoundary([clock]);
  const input = boundary.prepareDayInput(
    clock.stationId,
    clock.id,
    "2026-08-05",
  );
  assert.doesNotMatch(
    JSON.stringify(input),
    /title|artist|filename|path|metadata|token|credential|sql/i,
  );
  const source = await readFile(
    new URL("../src/app/m4-clock-template-boundary.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /^import .*?(node:|postgres|sqlite|child_process|worker|ffmpeg|icecast)/m,
  );
  assert.doesNotMatch(source, /fetch\(|http\.request|https\.request/);
});
