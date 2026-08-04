import assert from "node:assert/strict";
import test from "node:test";

import {
  assertStation,
  isUtcTimestamp,
  type Station,
} from "../src/domain/contracts.js";
import { seededStations } from "../src/domain/stations.js";

test("seeded stations satisfy stable-ID and timezone contract", () => {
  assert.equal(seededStations.length, 5);
  assert.equal(new Set(seededStations.map((station) => station.id)).size, 5);
  assert.deepEqual(
    seededStations.map((station) => station.name),
    [
      "StreamingSoundtracks",
      "1980s.FM",
      "Adagio.FM",
      "Death.FM",
      "Entranced.FM",
    ],
  );
  for (const station of seededStations) assertStation(station);
});

test("UTC timestamps require the UTC designator", () => {
  assert.equal(isUtcTimestamp("2026-08-03T00:00:00.000Z"), true);
  assert.equal(isUtcTimestamp("2026-08-03T00:00:00.000+02:00"), false);
});

test("station contract rejects an invalid timezone", () => {
  const invalid: Station = {
    ...seededStations[0]!,
    timezone: "not/a-timezone",
  };
  assert.throws(() => assertStation(invalid), /IANA timezone/);
});
