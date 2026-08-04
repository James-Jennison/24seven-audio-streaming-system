import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createControlPlaneServer } from "../src/api/server.js";
import { seededStations } from "../src/domain/stations.js";

class ManagedSandboxLoopbackRestriction extends Error {}

function isManagedSandboxLoopbackRestriction(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return (
    candidate.code === "EPERM" &&
    candidate.message === "listen EPERM: operation not permitted 127.0.0.1"
  );
}

async function withServer(
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const controlPlane = createControlPlaneServer(
    { list: () => seededStations },
    {
      version: "0.1.0-test",
      buildId: "test-build",
    },
  );
  try {
    await new Promise<void>((resolve, reject) => {
      controlPlane.server.once("error", reject);
      controlPlane.server.listen(0, "127.0.0.1", () => {
        controlPlane.server.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    if (isManagedSandboxLoopbackRestriction(error)) {
      throw new ManagedSandboxLoopbackRestriction();
    }
    throw error;
  }
  const address = controlPlane.server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      controlPlane.server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function withLoopbackOrSkip(
  context: { skip(message?: string): void },
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  try {
    await withServer(run);
  } catch (error) {
    if (error instanceof ManagedSandboxLoopbackRestriction) {
      context.skip("managed sandbox denies loopback listener creation");
      return;
    }
    throw error;
  }
}

test("loopback sandbox handling is limited to the exact denied listener", () => {
  assert.equal(
    isManagedSandboxLoopbackRestriction({
      code: "EPERM",
      message: "listen EPERM: operation not permitted 127.0.0.1",
    }),
    true,
  );
  assert.equal(
    isManagedSandboxLoopbackRestriction({
      code: "EPERM",
      message: "listen EPERM: operation not permitted 0.0.0.0",
    }),
    false,
  );
  assert.equal(
    isManagedSandboxLoopbackRestriction({
      code: "EADDRINUSE",
      message: "listen EADDRINUSE: address already in use 127.0.0.1",
    }),
    false,
  );
});

test("health, readiness, and version endpoints return expected contracts", async (context) => {
  await withLoopbackOrSkip(context, async (baseUrl) => {
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

test("station API lists all seeded stations and explicit unavailable runtime", async (context) => {
  await withLoopbackOrSkip(context, async (baseUrl) => {
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

test("operator root exposes only the programming-control UI shell", async (context) => {
  await withLoopbackOrSkip(context, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /id="operator-shell"/);
    assert.match(html, /Programming control plane/);
    assert.match(html, /Deterministic dry-run preview/);
    assert.match(
      html,
      /Runtime controls are unavailable and not rendered here/,
    );
    assert.doesNotMatch(html, /Icecast|SHOUTcast|Liquidsoap|FFmpeg/);
  });
});
