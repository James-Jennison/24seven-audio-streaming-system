import assert from "node:assert/strict";
import test from "node:test";

import {
  hashSecret,
  hasStationAccess,
  newSession,
  verifySecret,
} from "../src/app/auth.js";

test("scrypt password hashes verify without retaining plaintext", async () => {
  const hash = await hashSecret("correct-horse-battery-staple");
  assert.match(hash, /^scrypt\$/);
  assert.equal(await verifySecret("correct-horse-battery-staple", hash), true);
  assert.equal(await verifySecret("wrong-password-value", hash), false);
});

test("session material is random and expires", () => {
  const session = newSession(new Date("2026-08-03T00:00:00.000Z"));
  assert.notEqual(session.token, session.csrfToken);
  assert.equal(session.expiresAt.toISOString(), "2026-08-03T08:00:00.000Z");
});

test("station access does not cross tenant boundaries", () => {
  assert.equal(
    hasStationAccess("programmer", ["station_a"], "station_a"),
    true,
  );
  assert.equal(
    hasStationAccess("programmer", ["station_a"], "station_b"),
    false,
  );
  assert.equal(hasStationAccess("owner", [], "station_b"), true);
});
