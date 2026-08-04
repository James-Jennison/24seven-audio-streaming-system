import type { ApplicationRole } from "../domain/programming.js";

export function renderM1State(
  state:
    | "unauthenticated"
    | "forbidden"
    | "empty"
    | "loading"
    | "validation-error"
    | "read-only",
  role?: ApplicationRole,
): string {
  const labels = {
    unauthenticated: "Sign in is required to access administration.",
    forbidden: "You do not have permission for this station or action.",
    empty:
      "No records exist for this station yet. Audio runtime remains unavailable.",
    loading: "Loading station-scoped programming data…",
    "validation-error":
      "The change was not saved. Correct the highlighted validation errors.",
    "read-only": "Your role provides read-only access.",
  };
  return `<section class="m1-state" data-state="${state}"><p>${labels[state]}</p>${role ? `<p>Role: ${role}</p>` : ""}</section>`;
}
