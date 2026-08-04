import type { ApplicationRole } from "../domain/programming.js";

export type Action = "read" | "program" | "operate" | "admin";

export function allowed(role: ApplicationRole, action: Action): boolean {
  const matrix: Record<ApplicationRole, readonly Action[]> = {
    owner: ["read", "program", "operate", "admin"],
    administrator: ["read", "program", "operate", "admin"],
    programmer: ["read", "program"],
    operator: ["read", "operate"],
    observer: ["read"],
  };
  return matrix[role].includes(action);
}

export function assertAuthorized(
  role: ApplicationRole,
  assignedStations: readonly string[],
  stationId: string,
  action: Action,
): void {
  if (!allowed(role, action)) throw new Error("forbidden");
  if (role !== "owner" && !assignedStations.includes(stationId))
    throw new Error("station_forbidden");
}
