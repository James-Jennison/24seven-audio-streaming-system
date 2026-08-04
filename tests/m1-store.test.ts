import assert from "node:assert/strict";
import test from "node:test";
import { M1Store } from "../src/app/m1-store.js";

test("bootstrap, auth lifecycle, CSRF, audit, and station boundaries", async () => {
  const store = new M1Store();
  await store.bootstrap("owner@example.test", "correct-horse-battery-staple");
  assert.equal(store.audits[0]?.action, "auth.bootstrap");
  const session = await store.login(
    "owner@example.test",
    "correct-horse-battery-staple",
  );
  const principal = store.principal(session.token);
  principal.csrfToken = session.csrfToken;
  assert.throws(
    () =>
      store.createMedia(principal, "wrong", {
        stationId: "a",
        title: "T",
        artist: "A",
        category: "c",
        genreTags: [],
        tags: [],
        sourceReference: "x",
        lifecycleState: "draft",
      }),
    /csrf_rejected/,
  );
  store.createMedia(principal, session.csrfToken, {
    stationId: "a",
    title: "T",
    artist: "A",
    category: "c",
    genreTags: [],
    tags: [],
    sourceReference: "x",
    lifecycleState: "draft",
  });
  assert.equal(store.listMedia(principal, "a").length, 1);
  assert.match(
    store.audits.map((x) => x.action).join(" "),
    /programming.media_created/,
  );
  store.logout(session.token);
  assert.throws(() => store.principal(session.token), /unauthenticated/);
});
