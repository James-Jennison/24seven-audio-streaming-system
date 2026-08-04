import assert from "node:assert/strict";
import test from "node:test";

import { createMedia, dryRunSelection } from "../src/domain/programming.js";

const common = {
  stationId: "station_a",
  title: "Title",
  artist: "Artist",
  category: "music",
  genreTags: ["score"],
  tags: ["instrumental"],
  sourceReference: "draft:one",
  lifecycleState: "available" as const,
};

test("media validation rejects duplicate tags and invalid duration", () => {
  assert.throws(
    () => createMedia({ ...common, tags: ["duplicate", "duplicate"] }),
    /duplicates/,
  );
  assert.throws(
    () => createMedia({ ...common, durationMilliseconds: 0 }),
    /positive/,
  );
});

test("dry-run selection is deterministic and station-isolated", () => {
  const first = createMedia(
    { ...common, sourceReference: "draft:a" },
    "2026-08-03T00:00:00.000Z",
  );
  const other = createMedia(
    { ...common, stationId: "station_b", sourceReference: "draft:b" },
    "2026-08-03T00:00:00.000Z",
  );
  const plan = dryRunSelection("station_a", [other, first], [first], 30);
  assert.equal(plan.length, 1);
  assert.equal(plan[0]?.eligible, false);
  assert.match(plan[0]?.reasons.join(" ") ?? "", /separation/);
});
