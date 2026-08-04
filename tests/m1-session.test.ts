import assert from "node:assert/strict";
import test from "node:test";
import {
  authenticate,
  csrf,
  type SessionLookup,
} from "../src/api/m1-session.js";
test("session middleware rejects missing/revoked and CSRF mismatch", async () => {
  const s: SessionLookup = {
    lookupSession: async () => undefined,
    audit: async () => {},
  };
  await assert.rejects(() => authenticate(s, undefined), /unauthenticated/);
  await assert.rejects(() => csrf(s, "session=x", "bad"), /csrf_rejected/);
});
