import { createHash, timingSafeEqual } from "node:crypto";
export interface SessionLookup {
  lookupSession(
    tokenHash: string,
  ): Promise<
    | { userId: string; role: string; stationIds: string[]; csrfHash: string }
    | undefined
  >;
  audit(action: string, entityId: string, actorId?: string): Promise<void>;
}
export interface SessionContext {
  userId: string;
  role: string;
  stationIds: string[];
}
const digest = (value: string) =>
  createHash("sha256").update(value).digest("base64url");
export async function authenticate(
  store: SessionLookup,
  cookie: string | undefined,
): Promise<SessionContext> {
  const token = cookie?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  if (!token) {
    await store.audit("auth.session_rejected", "missing");
    throw new Error("unauthenticated");
  }
  const found = await store.lookupSession(digest(token));
  if (!found) {
    await store.audit("auth.session_rejected", "invalid");
    throw new Error("unauthenticated");
  }
  return {
    userId: found.userId,
    role: found.role,
    stationIds: found.stationIds,
  };
}
export async function csrf(
  store: SessionLookup,
  cookie: string | undefined,
  token: string | undefined,
): Promise<void> {
  const raw = cookie?.match(/(?:^|;\s*)session=([^;]+)/)?.[1],
    found = raw ? await store.lookupSession(digest(raw)) : undefined;
  const expected = found ? Buffer.from(found.csrfHash) : undefined;
  const received = token ? Buffer.from(digest(token)) : undefined;
  if (
    !found ||
    !expected ||
    !received ||
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    await store.audit("auth.csrf_rejected", "request", found?.userId);
    throw new Error("csrf_rejected");
  }
}
