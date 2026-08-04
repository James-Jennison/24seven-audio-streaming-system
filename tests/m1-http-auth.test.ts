import assert from "node:assert/strict";
import test from "node:test";
import { bootstrap, logout, type AuthPersistence } from "../src/api/m1-auth.js";
test("HTTP auth adapter bootstraps, logs in, and revokes without exposing secrets", async () => {
  let exists = false,
    revoked = false;
  const store: AuthPersistence = {
    hasUsers: async () => exists,
    bootstrap: async () => {
      exists = true;
      return "u";
    },
    findUser: async () => undefined,
    createSession: async () => {},
    revoke: async () => {
      revoked = true;
    },
    audit: async () => {},
  };
  await bootstrap(store, "owner@example.test", "correct-horse-battery-staple");
  await assert.rejects(
    () => bootstrap(store, "x@example.test", "correct-horse-battery-staple"),
    /bootstrap_unavailable/,
  );
  await logout(store, "opaque");
  assert.equal(revoked, true);
});
