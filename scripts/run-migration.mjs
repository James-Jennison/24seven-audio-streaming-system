/* global console, process */

import { spawn } from "node:child_process";

function report(stage) {
  console.error(JSON.stringify({ event: "m2.migration_failed", stage }));
  process.exitCode = 1;
}

function build() {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) return Promise.resolve(false);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [npmCli, "run", "build"], {
      stdio: "ignore",
    });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
}

if (await build()) {
  try {
    await import("../dist/src/migrate.js");
  } catch {
    report("migration_runner_initialization");
  }
} else {
  report("migration_build");
}
