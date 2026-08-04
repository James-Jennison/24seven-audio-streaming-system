/* global console, process */

import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);
const stagedFiles = execFileSync(
  "git",
  ["diff", "--cached", "--name-only", "-z"],
  {
    encoding: "utf8",
  },
)
  .split("\0")
  .filter(Boolean);
const files = [...new Set([...trackedFiles, ...stagedFiles])];

const violations = [];
const forbiddenExtensions =
  /\.(?:mp3|flac|wav|aac|ogg|sqlite|sqlite3|db|pem|key|p12|pfx)$/i;
const privateIp =
  /\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[0-1])\.(?:\d{1,3}\.)\d{1,3})\b/;
const quotedSecretAssignment =
  /(?:api[_-]?key|token|password|secret)\s*[=:]\s*["'](?!\$\{|<|replace-locally|example)[A-Za-z0-9_\-/]{8,}["']/i;
const environmentSecretAssignment =
  /(?:API[_-]?KEY|TOKEN|PASSWORD|SECRET)\s*=\s*(?!\$\{|<|replace-locally|example)[A-Za-z0-9_\-/]{8,}/;
const privatePath = /\/(?:home|Users)\/[A-Za-z0-9_.-]+\//;

for (const file of files) {
  if (forbiddenExtensions.test(file))
    violations.push(`${file}: forbidden tracked artifact extension`);
  const metadata = statSync(file);
  if (metadata.size > 2_000_000)
    violations.push(`${file}: tracked file exceeds 2 MB M0 limit`);
  if (metadata.size === 0 || metadata.size > 2_000_000) continue;
  const content = readFileSync(file, "utf8");
  if (privateIp.test(content))
    violations.push(`${file}: contains a private IP address`);
  if (
    quotedSecretAssignment.test(content) ||
    environmentSecretAssignment.test(content)
  )
    violations.push(`${file}: appears to contain a secret assignment`);
  if (privatePath.test(content))
    violations.push(`${file}: contains a private filesystem path`);
}

if (violations.length > 0) {
  console.error(
    "Public-repository hygiene check failed:\n" +
      violations.map((item) => `- ${item}`).join("\n"),
  );
  process.exit(1);
}

console.log(
  `Public-repository hygiene check passed (${files.length} tracked or staged files inspected).`,
);
