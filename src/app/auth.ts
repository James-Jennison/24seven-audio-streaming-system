import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

import type { ApplicationRole } from "../domain/programming.js";

const keyLength = 64;

function derive(
  secret: string,
  salt: Buffer,
  length: number,
  parameters: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      secret,
      salt,
      length,
      { ...parameters, maxmem: 64 * 1024 * 1024 },
      (error, derived) => (error ? reject(error) : resolve(derived)),
    );
  });
}

export interface SessionMaterial {
  token: string;
  csrfToken: string;
  expiresAt: Date;
}

export function newSession(now = new Date()): SessionMaterial {
  return {
    token: randomBytes(32).toString("base64url"),
    csrfToken: randomBytes(32).toString("base64url"),
    expiresAt: new Date(now.getTime() + 1000 * 60 * 60 * 8),
  };
}

export async function hashSecret(secret: string): Promise<string> {
  if (secret.length < 12)
    throw new Error("Password must be at least 12 characters.");
  const salt = randomBytes(16);
  const derived = await derive(secret, salt, keyLength, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return `scrypt$16384$8$1$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifySecret(
  secret: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, n, r, p, saltValue, digestValue] = stored.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !saltValue || !digestValue)
    return false;
  const digest = Buffer.from(digestValue, "base64url");
  const derived = await derive(
    secret,
    Buffer.from(saltValue, "base64url"),
    digest.length,
    { N: Number(n), r: Number(r), p: Number(p) },
  );
  return digest.length === derived.length && timingSafeEqual(digest, derived);
}

export function canManageProgramming(role: ApplicationRole): boolean {
  return role === "owner" || role === "administrator" || role === "programmer";
}

export function hasStationAccess(
  role: ApplicationRole,
  assignedStationIds: readonly string[],
  stationId: string,
): boolean {
  return role === "owner" || assignedStationIds.includes(stationId);
}

export function secureSessionCookie(token: string, secure = true): string {
  return `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure ? "; Secure" : ""}`;
}
