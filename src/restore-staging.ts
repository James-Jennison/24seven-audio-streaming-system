import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { finished } from "node:stream/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

import { Pool } from "pg";

import { seededStations } from "./domain/stations.js";
import {
  StagingRestoreError,
  isWithinRecoveryObjective,
  stagingRestoreFailureReport,
} from "./db/staging-restore.js";

const project = "twentyfourseven-m2-recovery";
const service = "postgres-recovery";
const rpoHours = 24;
const rtoHours = 4;
const migration = "002_m1_control_plane.sql";
const stationScopedTables = [
  "media_assets",
  "playlists",
  "playlist_items",
  "separation_rules",
  "rotation_rules",
  "clocks",
  "program_blocks",
  "scheduled_events",
] as const;
type RestoreStage = ConstructorParameters<typeof StagingRestoreError>[0];

interface Connection {
  database: string;
  host: string;
  password: string;
  port: string;
  user: string;
}
interface BackupManifest {
  authorityClass: "backup";
  checksumValidation: "pass";
  evidenceReference: string;
  format: "postgresql_custom";
  scope: "staging_postgresql_logical";
  sha256: string;
  status: "verified";
  verifiedAt: string;
}

function required(name: string, stage: RestoreStage): string {
  const value = process.env[name];
  if (!value) throw new StagingRestoreError(stage);
  return value;
}

function parseConnection(value: string, stage: RestoreStage): Connection {
  try {
    const url = new URL(value);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !new Set(["127.0.0.1", "::1", "localhost"]).has(url.hostname) ||
      !url.username ||
      !url.password ||
      !url.pathname.slice(1)
    )
      throw new Error();
    return {
      database: decodeURIComponent(url.pathname.slice(1)),
      host: url.hostname,
      password: decodeURIComponent(url.password),
      port: url.port || "5432",
      user: decodeURIComponent(url.username),
    };
  } catch {
    throw new StagingRestoreError(stage);
  }
}

async function safeDirectory(
  value: string,
  stage: RestoreStage,
  create: boolean,
): Promise<string> {
  const home = process.env.HOME;
  const directory = resolve(value);
  const containment = home ? relative(resolve(home), directory) : "..";
  if (!containment || containment.startsWith("..") || isAbsolute(containment))
    throw new StagingRestoreError(stage);
  try {
    if (create) await mkdir(directory, { mode: 0o700, recursive: true });
    await chmod(directory, 0o700);
    const metadata = await lstat(directory);
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      ((await stat(directory)).mode & 0o777) !== 0o700
    )
      throw new Error();
    return directory;
  } catch {
    throw new StagingRestoreError(stage);
  }
}

function containerEnvironment(connection: Connection): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PGDATABASE: connection.database,
    PGHOST: "127.0.0.1",
    PGPASSWORD: connection.password,
    PGPORT: "5432",
    PGUSER: connection.user,
  };
}

function command(
  commandName: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  input: NodeJS.ReadableStream | null = null,
): Promise<void> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(commandName, args, {
      cwd: process.cwd(),
      env,
      stdio: [input ? "pipe" : "ignore", "ignore", "ignore"],
    });
    child.once("error", rejectRun);
    child.once("exit", (code) =>
      code === 0 ? resolveRun() : rejectRun(new Error("command failed")),
    );
    if (input && child.stdin) input.pipe(child.stdin);
  });
}

function restoreFailureStage(detail: string): RestoreStage {
  const normalized = detail.toLowerCase();
  if (
    normalized.includes("permission denied") ||
    normalized.includes("must be owner") ||
    normalized.includes("not owner")
  ) {
    return "archive_restore_privilege";
  }
  if (normalized.includes("extension")) return "archive_restore_extension";
  return "archive_restore";
}

function restoreCommand(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  input: NodeJS.ReadableStream,
): Promise<void> {
  return new Promise((resolveRun, rejectRun) => {
    try {
      const child = spawn("docker", args, {
        cwd: process.cwd(),
        env,
        stdio: ["pipe", "ignore", "pipe"],
      });
      let detail = "";
      child.stderr?.on("data", (chunk: string | Buffer) => {
        detail = `${detail}${chunk.toString()}`.slice(-8_192);
      });
      child.once("error", () =>
        rejectRun(new StagingRestoreError("archive_restore")),
      );
      child.once("exit", (code) => {
        if (code === 0) resolveRun();
        else rejectRun(new StagingRestoreError(restoreFailureStage(detail)));
      });
      if (child.stdin) input.pipe(child.stdin);
    } catch {
      rejectRun(new StagingRestoreError("archive_restore"));
    }
  });
}

function compose(
  args: readonly string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return command(
    "docker",
    ["compose", "-p", project, "-f", "compose.m2-recovery.yaml", ...args],
    env,
  );
}

async function removeRecoveryDataDirectory(
  dataDirectory: string,
): Promise<void> {
  try {
    const parent = resolve(dataDirectory, "..");
    const leaf = dataDirectory.slice(parent.length + 1);
    if (!leaf || leaf.includes("/")) throw new Error();
    await command(
      "docker",
      [
        "run",
        "--rm",
        "--entrypoint",
        "rm",
        "-v",
        `${parent}:/m2-recovery-parent`,
        "postgres:17.5-bookworm",
        "-rf",
        "--",
        `/m2-recovery-parent/${leaf}`,
      ],
      process.env,
    );
    try {
      await lstat(dataDirectory);
      throw new Error();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  } catch {
    throw new StagingRestoreError("recovery_target_cleanup");
  }
}

async function digest(path: string): Promise<string> {
  try {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk: string | Buffer) => hash.update(chunk));
    await finished(stream);
    return hash.digest("hex");
  } catch {
    throw new StagingRestoreError("backup_attribution");
  }
}

async function backup(
  destination: string,
): Promise<{ archive: string; manifest: BackupManifest }> {
  const expectedReference = required(
    "M2_RECOVERY_BACKUP_EVIDENCE_REFERENCE",
    "backup_attribution",
  );
  try {
    for (const entry of (await readdir(destination)).filter((item) =>
      item.endsWith(".manifest.json"),
    )) {
      const manifest = JSON.parse(
        await readFile(join(destination, entry), "utf8"),
      ) as BackupManifest;
      if (
        manifest.evidenceReference !== expectedReference ||
        manifest.status !== "verified" ||
        manifest.authorityClass !== "backup" ||
        manifest.format !== "postgresql_custom" ||
        manifest.scope !== "staging_postgresql_logical" ||
        manifest.checksumValidation !== "pass"
      )
        continue;
      const artifact = entry
        .replace(/^backup-/, "")
        .replace(/\.manifest\.json$/, "");
      const archive = join(destination, `backup-${artifact}.dump`);
      const checksum = (
        await readFile(join(destination, `backup-${artifact}.sha256`), "utf8")
      )
        .trim()
        .split(/\s+/)[0];
      if (
        checksum !== manifest.sha256 ||
        (await digest(archive)) !== manifest.sha256
      )
        throw new Error();
      await command(
        "docker",
        ["compose", "exec", "-T", "postgres", "pg_restore", "--list"],
        process.env,
        createReadStream(archive),
      );
      return { archive, manifest };
    }
  } catch (error) {
    if (error instanceof StagingRestoreError) throw error;
  }
  throw new StagingRestoreError("backup_attribution");
}

async function waitForTarget(connection: Connection): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      await compose(
        ["exec", "-T", service, "pg_isready"],
        containerEnvironment(connection),
      );
      return;
    } catch {
      await new Promise((resolveWait) => setTimeout(resolveWait, 1_000));
    }
  }
  throw new StagingRestoreError("recovery_target_start");
}

async function validate(
  platformUrl: string,
  restoreUser: string,
): Promise<void> {
  const pool = new Pool({ connectionString: platformUrl, max: 1 });
  try {
    const [extension, ledger, stations, columns, authority] = await Promise.all(
      [
        pool.query("SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'"),
        pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [
          migration,
        ]),
        pool.query("SELECT id FROM stations ORDER BY id"),
        pool.query(
          "SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'station_id'",
        ),
        pool.query(
          "SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = $1",
          [restoreUser],
        ),
      ],
    );
    const expected = seededStations.map(({ id }) => id).sort();
    const actual = stations.rows.map((row: { id: string }) => row.id).sort();
    const scoped = new Set(
      columns.rows.map((row: { table_name: string }) => row.table_name),
    );
    if (extension.rowCount !== 1)
      throw new StagingRestoreError("recovery_extension");
    if (ledger.rowCount !== 1) throw new StagingRestoreError("recovery_ledger");
    if (
      actual.length !== expected.length ||
      actual.some((id, index) => id !== expected[index])
    )
      throw new StagingRestoreError("recovery_stations");
    if (stationScopedTables.some((table) => !scoped.has(table)))
      throw new StagingRestoreError("recovery_station_isolation");
    if (
      authority.rowCount !== 1 ||
      Object.values(authority.rows[0] as Record<string, boolean>).some(Boolean)
    )
      throw new StagingRestoreError("recovery_authority");
  } catch (error) {
    if (error instanceof StagingRestoreError) throw error;
    throw new StagingRestoreError("recovery_validation");
  } finally {
    await pool.end();
  }
}

async function evidence(
  destination: string,
  backupEvidenceReference: string,
  elapsedMilliseconds: number,
): Promise<string> {
  const evidenceReference = `m2-restore-${new Date().toISOString().replaceAll(/[-:.]/g, "")}-${randomBytes(8).toString("hex")}`;
  try {
    await writeFile(
      join(destination, `${evidenceReference}.json`),
      `${JSON.stringify({ authorityClass: "restore", backupEvidenceReference, cleanup: "pass", evidenceReference, ledger: "pass", rpo: "pass", rto: "pass", schema: "pass", stationIsolation: "pass", stations: "pass", status: "verified", target: "isolated_loopback", verifiedAt: new Date().toISOString(), recoveryMilliseconds: elapsedMilliseconds })}\n`,
      { flag: "wx", mode: 0o600 },
    );
    return evidenceReference;
  } catch {
    throw new StagingRestoreError("recovery_evidence");
  }
}

async function run(): Promise<{ evidenceReference: string }> {
  const started = Date.now();
  const backupDirectory = await safeDirectory(
    required("M2_BACKUP_DIRECTORY", "backup_attribution"),
    "backup_attribution",
    false,
  );
  const evidenceDirectory = await safeDirectory(
    required("M2_RECOVERY_EVIDENCE_DIRECTORY", "recovery_evidence"),
    "recovery_evidence",
    true,
  );
  const dataDirectory = resolve(
    required("M2_RECOVERY_DATA_DIRECTORY", "recovery_target_configuration"),
  );
  const recoveryPort = required(
    "M2_RECOVERY_PORT",
    "recovery_target_configuration",
  );
  const restore = parseConnection(
    required("DATABASE_RESTORE_URL", "restore_reference"),
    "restore_reference",
  );
  const platform = parseConnection(
    required("M2_RECOVERY_PLATFORM_URL", "recovery_target_configuration"),
    "recovery_target_configuration",
  );
  if (
    restore.host !== platform.host ||
    restore.port !== recoveryPort ||
    platform.port !== recoveryPort ||
    restore.database !== platform.database ||
    restore.user === platform.user ||
    dataDirectory === backupDirectory ||
    dataDirectory === evidenceDirectory
  )
    throw new StagingRestoreError("recovery_target_configuration");
  const home = process.env.HOME;
  const containment = home ? relative(resolve(home), dataDirectory) : "..";
  if (!containment || containment.startsWith("..") || isAbsolute(containment))
    throw new StagingRestoreError("recovery_target_configuration");
  try {
    await lstat(dataDirectory);
    throw new Error();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new StagingRestoreError("recovery_target_configuration");
  }
  const selected = await backup(backupDirectory);
  if (
    !isWithinRecoveryObjective(
      Date.now() - Date.parse(selected.manifest.verifiedAt),
      rpoHours,
    )
  )
    throw new StagingRestoreError("rpo_window");
  try {
    await mkdir(dataDirectory, { mode: 0o700, recursive: false });
    await chmod(dataDirectory, 0o700);
  } catch {
    throw new StagingRestoreError("recovery_target_configuration");
  }
  let startedTarget = false;
  try {
    try {
      await compose(["up", "-d", service], process.env);
    } catch {
      throw new StagingRestoreError("recovery_target_start");
    }
    startedTarget = true;
    await waitForTarget(platform);
    await restoreCommand(
      [
        "compose",
        "-p",
        project,
        "-f",
        "compose.m2-recovery.yaml",
        "exec",
        "-T",
        "-e",
        "PGDATABASE",
        "-e",
        "PGHOST",
        "-e",
        "PGPASSWORD",
        "-e",
        "PGPORT",
        "-e",
        "PGUSER",
        "-e",
        "M2_RESTORE_AUTHORITY_PASSWORD",
        service,
        "psql",
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        "m2_restore_authority_phase=provision",
      ],
      {
        ...containerEnvironment(platform),
        M2_RESTORE_AUTHORITY_PASSWORD: restore.password,
      },
      createReadStream("docs/M2.4_STAGING_RESTORE_AUTHORITY.sql"),
    ).catch(() => {
      throw new StagingRestoreError("restore_authority_configuration");
    });
    await restoreCommand(
      [
        "compose",
        "-p",
        project,
        "-f",
        "compose.m2-recovery.yaml",
        "exec",
        "-T",
        "-e",
        "PGPASSWORD",
        service,
        "pg_restore",
        "--exit-on-error",
        "--no-owner",
        "--no-privileges",
        "-h",
        "127.0.0.1",
        "-p",
        "5432",
        "-U",
        restore.user,
        "-d",
        restore.database,
      ],
      containerEnvironment(restore),
      createReadStream(selected.archive),
    );
    await validate(
      required("M2_RECOVERY_PLATFORM_URL", "recovery_target_configuration"),
      restore.user,
    );
    const elapsed = Date.now() - started;
    if (!isWithinRecoveryObjective(elapsed, rtoHours))
      throw new StagingRestoreError("rto_window");
    await compose(["down", "--volumes"], process.env).catch(() => {
      throw new StagingRestoreError("recovery_target_cleanup");
    });
    startedTarget = false;
    await removeRecoveryDataDirectory(dataDirectory);
    return {
      evidenceReference: await evidence(
        evidenceDirectory,
        selected.manifest.evidenceReference,
        elapsed,
      ),
    };
  } finally {
    if (startedTarget) {
      /* preserve a failed isolated target for separately approved diagnosis */
    }
  }
}

try {
  const result = await run();
  console.log(
    JSON.stringify({
      event: "m2.staging_restore_verified",
      evidenceReference: result.evidenceReference,
    }),
  );
} catch (error) {
  console.error(JSON.stringify(stagingRestoreFailureReport(error)));
  process.exitCode = 1;
}
