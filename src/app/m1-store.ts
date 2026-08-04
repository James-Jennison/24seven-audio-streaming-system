import { createHash, randomUUID } from "node:crypto";
import { hashSecret, newSession, verifySecret } from "./auth.js";
import { assertAuthorized, type Action } from "./authorization.js";
import {
  createMedia,
  type ApplicationRole,
  type MediaMetadata,
  type MediaMetadataInput,
} from "../domain/programming.js";

export interface Principal {
  userId: string;
  role: ApplicationRole;
  stationIds: string[];
  sessionId: string;
  csrfToken: string;
}
interface User {
  id: string;
  email: string;
  hash: string;
  role: ApplicationRole;
  stationIds: string[];
  enabled: boolean;
}
interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  csrfHash: string;
  expiresAt: Date;
  revoked: boolean;
}
export interface Audit {
  action: string;
  entityType: string;
  entityId: string;
  stationId?: string;
  actorUserId?: string;
}

/** Safe test double mirroring M1 repository boundaries; runtime uses PostgreSQLPersistence. */
export class M1Store {
  private readonly users = new Map<string, User>();
  private readonly sessions = new Map<string, Session>();
  private readonly media = new Map<string, MediaMetadata>();
  public readonly audits: Audit[] = [];
  private digest(value: string): string {
    return createHash("sha256").update(value).digest("base64url");
  }
  private audit(
    action: string,
    entityType: string,
    entityId: string,
    actorUserId?: string,
    stationId?: string,
  ): void {
    this.audits.push({ action, entityType, entityId, actorUserId, stationId });
  }
  async bootstrap(email: string, password: string): Promise<void> {
    if (this.users.size) throw new Error("bootstrap_unavailable");
    const id = randomUUID();
    this.users.set(id, {
      id,
      email,
      hash: await hashSecret(password),
      role: "owner",
      stationIds: [],
      enabled: true,
    });
    this.audit("auth.bootstrap", "user", id, id);
  }
  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; csrfToken: string }> {
    const user = [...this.users.values()].find(
      (value) => value.email === email,
    );
    if (!user || !user.enabled || !(await verifySecret(password, user.hash))) {
      this.audit("auth.login_failed", "session", "none");
      throw new Error("invalid_credentials");
    }
    const material = newSession();
    const id = randomUUID();
    this.sessions.set(id, {
      id,
      userId: user.id,
      tokenHash: this.digest(material.token),
      csrfHash: this.digest(material.csrfToken),
      expiresAt: material.expiresAt,
      revoked: false,
    });
    this.audit("auth.login", "session", id, user.id);
    return { token: material.token, csrfToken: material.csrfToken };
  }
  principal(token: string): Principal {
    const session = [...this.sessions.values()].find(
      (value) => value.tokenHash === this.digest(token),
    );
    if (!session || session.revoked || session.expiresAt <= new Date()) {
      this.audit("auth.session_rejected", "session", session?.id ?? "unknown");
      throw new Error("unauthenticated");
    }
    const user = this.users.get(session.userId)!;
    return {
      userId: user.id,
      role: user.role,
      stationIds: user.stationIds,
      sessionId: session.id,
      csrfToken: "",
    };
  }
  logout(token: string): void {
    const session = [...this.sessions.values()].find(
      (value) => value.tokenHash === this.digest(token),
    );
    if (session) {
      session.revoked = true;
      this.audit("auth.logout", "session", session.id, session.userId);
    }
  }
  createMedia(
    principal: Principal,
    csrf: string,
    input: MediaMetadataInput,
  ): MediaMetadata {
    if (csrf !== principal.csrfToken) throw new Error("csrf_rejected");
    assertAuthorized(
      principal.role,
      principal.stationIds,
      input.stationId,
      "program" as Action,
    );
    const media = createMedia(input);
    if (
      [...this.media.values()].some(
        (value) =>
          value.stationId === input.stationId &&
          value.sourceReference === input.sourceReference,
      )
    )
      throw new Error("duplicate_source_reference");
    this.media.set(media.id, media);
    this.audit(
      "programming.media_created",
      "media_asset",
      media.id,
      principal.userId,
      input.stationId,
    );
    return media;
  }
  listMedia(principal: Principal, stationId: string): readonly MediaMetadata[] {
    assertAuthorized(
      principal.role,
      principal.stationIds,
      stationId,
      "read" as Action,
    );
    return [...this.media.values()].filter(
      (value) => value.stationId === stationId,
    );
  }
}
