import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  StagingBackupError,
  artifactIdsToPrune,
  stagingBackupFailureReport,
  type VerifiedBackupSet,
} from "./db/staging-backup.js";

interface BackupManifest extends VerifiedBackupSet {
  format: "postgresql_custom";
  scope: "staging_postgresql_logical";
  sha256: string;
  status: "verified";
  verifiedAt: string;
}

interface BackupConnection {
  database: string;
  host: string;
  password: string;
  port: string;
  user: string;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new StagingBackupError("backup_reference");
  return value;
}

function parseConnection(value: string): BackupConnection {
  try {
    const url = new URL(value);
    const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost"]);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !loopbackHosts.has(url.hostname) ||
      !url.username ||
      !url.password ||
      !url.pathname.slice(1)
    ) {
      throw new Error("invalid backup reference");
    }
    return {
      database: decodeURIComponent(url.pathname.slice(1)),
      host: url.hostname,
      password: decodeURIComponent(url.password),
      port: url.port || "5432",
      user: decodeURIComponent(url.username),
    };
  } catch {
    throw new StagingBackupError("backup_reference");
  }
}

async function restrictedDestination(): Promise<string> {
  const home = process.env.HOME;
  if (!home) throw new StagingBackupError("backup_destination");
  const destination = resolve(required("M2_BACKUP_DIRECTORY"));
  const withinHome = relative(resolve(home), destination);
  if (!withinHome || withinHome.startsWith("..") || isAbsolute(withinHome)) {
    throw new StagingBackupError("backup_destination");
  }
  try {
    await mkdir(destination, { mode: 0o700, recursive: true });
    await chmod(destination, 0o700);
    const metadata = await lstat(destination);
    const permissions = (await stat(destination)).mode & 0o777;
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      permissions !== 0o700
    ) {
      throw new Error("unsafe destination");
    }
  } catch {
    throw new StagingBackupError("backup_destination");
  }
  return destination;
}

function commandEnvironment(connection: BackupConnection): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PGDATABASE: connection.database,
    PGHOST: connection.host,
    PGPASSWORD: connection.password,
    PGPORT: connection.port,
    PGUSER: connection.user,
  };
}

function runDocker(
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
  stdin: NodeJS.ReadableStream | null,
  stdout: NodeJS.WritableStream | null,
): Promise<void> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn("docker", args, {
      cwd: process.cwd(),
      env: environment,
      stdio: [stdin ? "pipe" : "ignore", stdout ? "pipe" : "ignore", "ignore"],
    });
    child.once("error", rejectRun);
    child.once("exit", (code) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error("backup command failed"));
    });
    if (stdin && child.stdin) stdin.pipe(child.stdin);
    if (stdout && child.stdout) child.stdout.pipe(stdout);
  });
}

async function verifyArchive(
  archive: string,
  environment: NodeJS.ProcessEnv,
): Promise<void> {
  try {
    await runDocker(
      ["compose", "exec", "-T", "postgres", "pg_restore", "--list"],
      environment,
      createReadStream(archive),
      null,
    );
  } catch {
    throw new StagingBackupError("backup_archive_validation");
  }
}

async function sha256(path: string): Promise<string> {
  try {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk: string | Buffer) => {
      hash.update(chunk);
    });
    await finished(stream);
    return hash.digest("hex");
  } catch {
    throw new StagingBackupError("backup_checksum");
  }
}

async function verifyChecksum(
  archive: string,
  checksumFile: string,
  expected: string,
): Promise<void> {
  try {
    const recorded = (await readFile(checksumFile, "utf8"))
      .trim()
      .split(/\s+/)[0];
    const actual = await sha256(archive);
    if (recorded !== expected || actual !== expected) {
      throw new Error("checksum mismatch");
    }
  } catch {
    throw new StagingBackupError("backup_checksum");
  }
}

async function verifiedSets(
  destination: string,
): Promise<readonly BackupManifest[]> {
  try {
    const files = await readdir(destination);
    const manifests = await Promise.all(
      files
        .filter((file) => /^backup-\d{8}-[a-f0-9]+\.manifest\.json$/.test(file))
        .map(async (file) => {
          try {
            const parsed = JSON.parse(
              await readFile(join(destination, file), "utf8"),
            ) as BackupManifest;
            return parsed.status === "verified" &&
              /^\d{8}-[a-f0-9]+$/.test(parsed.artifactId) &&
              /^\d{8}$/.test(parsed.backupDay) &&
              parsed.artifactId.startsWith(`${parsed.backupDay}-`)
              ? parsed
              : undefined;
          } catch {
            return undefined;
          }
        }),
    );
    return manifests.filter((manifest): manifest is BackupManifest =>
      Boolean(manifest),
    );
  } catch {
    throw new StagingBackupError("backup_retention");
  }
}

async function pruneVerifiedSets(destination: string): Promise<number> {
  try {
    const sets = await verifiedSets(destination);
    const artifactIds = artifactIdsToPrune(sets);
    for (const artifactId of artifactIds) {
      await Promise.all(
        [".dump", ".sha256", ".manifest.json"].map((suffix) =>
          rm(join(destination, `backup-${artifactId}${suffix}`), {
            force: true,
          }),
        ),
      );
    }
    return artifactIds.length;
  } catch {
    throw new StagingBackupError("backup_retention");
  }
}

async function run(): Promise<{
  artifactId: string;
  backupDay: string;
  pruned: number;
}> {
  const connection = parseConnection(required("DATABASE_BACKUP_URL"));
  const destination = await restrictedDestination();
  const backupDay = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const currentSets = await verifiedSets(destination);
  if (currentSets.some((set) => set.backupDay === backupDay)) {
    throw new StagingBackupError("backup_retention");
  }
  const artifactId = `${backupDay}-${randomBytes(10).toString("hex")}`;
  const archive = join(destination, `backup-${artifactId}.dump`);
  const checksumFile = join(destination, `backup-${artifactId}.sha256`);
  const manifestFile = join(destination, `backup-${artifactId}.manifest.json`);
  const output = createWriteStream(archive, { flags: "wx", mode: 0o600 });
  const environment = commandEnvironment(connection);
  let verified = false;
  try {
    await runDocker(
      [
        "compose",
        "exec",
        "-T",
        "-e",
        "PGHOST",
        "-e",
        "PGPORT",
        "-e",
        "PGUSER",
        "-e",
        "PGPASSWORD",
        "-e",
        "PGDATABASE",
        "postgres",
        "pg_dump",
        "--format=custom",
        "--no-owner",
        "--no-privileges",
      ],
      environment,
      null,
      output,
    );
    await finished(output);
    await verifyArchive(archive, environment);
    const digest = await sha256(archive);
    const manifest: BackupManifest = {
      artifactId,
      backupDay,
      format: "postgresql_custom",
      scope: "staging_postgresql_logical",
      sha256: digest,
      status: "verified",
      verifiedAt: new Date().toISOString(),
    };
    try {
      await writeFile(checksumFile, `${digest}  ${artifactId}\n`, {
        flag: "wx",
        mode: 0o600,
      });
      await verifyChecksum(archive, checksumFile, digest);
      await writeFile(manifestFile, `${JSON.stringify(manifest)}\n`, {
        flag: "wx",
        mode: 0o600,
      });
    } catch (error) {
      if (error instanceof StagingBackupError) throw error;
      throw new StagingBackupError("backup_manifest");
    }
    const pruned = await pruneVerifiedSets(destination);
    verified = true;
    return { artifactId, backupDay, pruned };
  } catch (error) {
    output.destroy();
    if (error instanceof StagingBackupError) throw error;
    throw new StagingBackupError("backup_dump");
  } finally {
    if (!verified) {
      await Promise.all(
        [archive, checksumFile, manifestFile].map((path) =>
          rm(path, { force: true }),
        ),
      );
    }
  }
}

try {
  const result = await run();
  console.log(
    JSON.stringify({
      event: "m2.staging_backup_verified",
      artifactId: result.artifactId,
      backupDay: result.backupDay,
      pruned: result.pruned,
    }),
  );
} catch (error) {
  console.error(JSON.stringify(stagingBackupFailureReport(error)));
  process.exitCode = 1;
}
