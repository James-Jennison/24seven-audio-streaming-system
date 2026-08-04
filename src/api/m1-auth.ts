import { createHash } from "node:crypto";
import {
  hashSecret,
  newSession,
  secureSessionCookie,
  verifySecret,
} from "../app/auth.js";

export interface AuthPersistence {
  hasUsers(): Promise<boolean>;
  bootstrap(email: string, hash: string): Promise<string>;
  findUser(
    email: string,
  ): Promise<
    { id: string; passwordHash: string; enabled: boolean } | undefined
  >;
  createSession(
    userId: string,
    tokenHash: string,
    csrfHash: string,
    expiresAt: Date,
  ): Promise<void>;
  revoke(tokenHash: string): Promise<void>;
  audit(action: string, entityId: string, actorId?: string): Promise<void>;
}
const digest = (value: string) =>
  createHash("sha256").update(value).digest("base64url");
export async function bootstrap(
  store: AuthPersistence,
  email: string,
  password: string,
) {
  if (await store.hasUsers()) throw new Error("bootstrap_unavailable");
  const id = await store.bootstrap(email, await hashSecret(password));
  await store.audit("auth.bootstrap", id, id);
  return id;
}
export async function login(
  store: AuthPersistence,
  email: string,
  password: string,
  secure = false,
) {
  const user = await store.findUser(email);
  if (
    !user ||
    !user.enabled ||
    !(await verifySecret(password, user.passwordHash))
  ) {
    await store.audit("auth.login_failed", "none");
    throw new Error("invalid_credentials");
  }
  const session = newSession();
  await store.createSession(
    user.id,
    digest(session.token),
    digest(session.csrfToken),
    session.expiresAt,
  );
  await store.audit("auth.login", user.id, user.id);
  return {
    csrfToken: session.csrfToken,
    cookie: secureSessionCookie(session.token, secure),
  };
}
export async function logout(store: AuthPersistence, token: string) {
  await store.revoke(digest(token));
  await store.audit("auth.logout", "session");
  return "session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";
}
