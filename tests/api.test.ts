import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createControlPlaneServer } from "../src/api/server.js";
import { SqlitePersistence } from "../src/db/persistence.js";

async function withServer(
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const persistence = new SqlitePersistence(":memory:");
  persistence.migrate();
  persistence.seed();
  const controlPlane = createControlPlaneServer(persistence, {
    version: "0.1.0-test",
    buildId: "test-build",
  });
  await new Promise<void>((resolve) =>
    controlPlane.server.listen(0, "127.0.0.1", resolve),
  );
  const address = controlPlane.server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      controlPlane.server.close((error) => (error ? reject(error) : resolve())),
    );
    persistence.close();
  }
}

test("health, readiness, and version endpoints return expected contracts", async () => {
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });

    const ready = await fetch(`${baseUrl}/readyz`);
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { status: "ready" });

    const version = await fetch(`${baseUrl}/api/v1/version`);
    assert.deepEqual(await version.json(), {
      contractVersion: "v1",
      version: "0.1.0-test",
      buildId: "test-build",
    });
  });
});

test("station API lists all seeded stations and explicit unavailable runtime", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/stations`);
    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      contractVersion: string;
      stations: Array<{
        name: string;
        runtime: { status: string; authoritativeWriter: string };
      }>;
    };
    assert.equal(payload.contractVersion, "v1");
    assert.equal(payload.stations.length, 5);
    assert.equal(payload.stations[0]?.runtime.status, "unavailable");
    assert.equal(
      payload.stations[0]?.runtime.authoritativeWriter,
      "audio-runtime",
    );
  });
});
