import type { IncomingMessage, ServerResponse } from "node:http";
import { bootstrap, login, logout, type AuthPersistence } from "./m1-auth.js";
import { csrf, type SessionLookup } from "./m1-session.js";

export async function handleM1Auth(
  request: IncomingMessage,
  response: ServerResponse,
  store: AuthPersistence,
  sessions?: SessionLookup,
): Promise<boolean> {
  const url = new URL(request.url ?? "/", "http://localhost");
  if (
    request.method !== "POST" ||
    !["/api/v1/bootstrap", "/api/v1/login", "/api/v1/logout"].includes(
      url.pathname,
    )
  )
    return false;
  const body = await readJson(request);
  try {
    if (url.pathname === "/api/v1/bootstrap") {
      await bootstrap(
        store,
        String(body.email ?? ""),
        String(body.password ?? ""),
      );
      json(response, 201, { status: "bootstrapped" });
    } else if (url.pathname === "/api/v1/login") {
      const result = await login(
        store,
        String(body.email ?? ""),
        String(body.password ?? ""),
        false,
      );
      response.setHeader("set-cookie", result.cookie);
      json(response, 200, { csrfToken: result.csrfToken });
    } else {
      if (!sessions) throw new Error("csrf_rejected");
      await csrf(
        sessions,
        request.headers.cookie,
        request.headers["x-csrf-token"] as string | undefined,
      );
      await logout(store, readCookie(request));
      response.setHeader(
        "set-cookie",
        "session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
      );
      json(response, 200, { status: "logged_out" });
    }
  } catch (error) {
    json(
      response,
      error instanceof Error && error.message === "bootstrap_unavailable"
        ? 409
        : 401,
      { error: error instanceof Error ? error.message : "invalid_request" },
    );
  }
  return true;
}
function readCookie(request: IncomingMessage): string {
  const value = request.headers.cookie?.match(/(?:^|;\s*)session=([^;]+)/)?.[1];
  if (!value) throw new Error("unauthenticated");
  return value;
}
function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let value = "";
    request.on("data", (chunk) => (value += String(chunk)));
    request.on("end", () => {
      try {
        resolve(value ? (JSON.parse(value) as Record<string, unknown>) : {});
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    request.on("error", reject);
  });
}
function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}
