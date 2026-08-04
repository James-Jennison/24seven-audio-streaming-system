import assert from "node:assert/strict";
import test from "node:test";
import { renderM1State } from "../src/ui/m1-states.js";

test("M1 UI states remain explicit", () => {
  for (const state of [
    "unauthenticated",
    "forbidden",
    "empty",
    "loading",
    "validation-error",
    "read-only",
  ] as const) {
    assert.match(
      renderM1State(state, "observer"),
      new RegExp(`data-state="${state}"`),
    );
  }
});
