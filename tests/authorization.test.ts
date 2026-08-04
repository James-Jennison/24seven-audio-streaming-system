import assert from "node:assert/strict";
import test from "node:test";
import { assertAuthorized, allowed } from "../src/app/authorization.js";

test("RBAC limits programming and station scope", () => {
  assert.equal(allowed("observer", "program"), false);
  assert.equal(allowed("programmer", "program"), true);
  assert.throws(
    () => assertAuthorized("programmer", ["a"], "b", "program"),
    /station_forbidden/,
  );
  assert.throws(
    () => assertAuthorized("operator", ["a"], "a", "program"),
    /forbidden/,
  );
  assert.doesNotThrow(() => assertAuthorized("owner", [], "b", "admin"));
});
