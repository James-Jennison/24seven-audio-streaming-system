import type { ApplicationVersion } from "../app/version.js";
import type { Station } from "../domain/contracts.js";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return replacements[character] ?? character;
  });
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Local-only M3.8 visual shell. It uses session-scoped station context but
 * intentionally renders contract status rather than media, runtime, or service
 * data. There are no dashboard actions for programming, ingestion, processing,
 * scheduling, playout, encoding, or listener-facing systems.
 */
export function renderDashboard(
  stations: readonly Station[],
  version: ApplicationVersion,
): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>24Seven.FM — Operator Dashboard</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --background: #0b1118;
      --surface: #141d27;
      --surface-raised: #1c2835;
      --border: #365067;
      --text: #f2f7fb;
      --muted: #b5c6d5;
      --primary: #91d4ff;
      --primary-container: #143f5d;
      --success: #95dbad;
      --warning: #f3ca78;
      --disabled: #9eabb7;
      --danger: #ffb4ab;
    }
    * { box-sizing: border-box; }
    body { min-width: 20rem; margin: 0; background: var(--background); color: var(--text); }
    a, button, input, select { font: inherit; }
    a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible { outline: 3px solid var(--primary); outline-offset: 3px; }
    button, input, select { border-radius: .5rem; }
    button { cursor: pointer; border: 1px solid var(--primary); padding: .65rem .9rem; background: var(--primary); color: #00344e; font-weight: 700; }
    button.secondary { background: transparent; color: var(--primary); }
    button:disabled { cursor: not-allowed; opacity: .72; }
    input, select { width: 100%; border: 1px solid var(--border); background: var(--background); color: var(--text); padding: .6rem; }
    label { display: grid; gap: .4rem; color: var(--muted); font-size: .92rem; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { margin-bottom: .25rem; font-size: clamp(1.6rem, 4vw, 2.35rem); }
    h2 { margin-bottom: .65rem; font-size: 1.25rem; }
    h3 { margin-bottom: .35rem; font-size: 1rem; }
    .skip-link { position: absolute; top: -5rem; left: 1rem; z-index: 10; background: var(--primary); color: #00344e; padding: .65rem .85rem; border-radius: .45rem; font-weight: 700; }
    .skip-link:focus { top: 1rem; }
    .shell { max-width: 90rem; margin: 0 auto; padding: clamp(1rem, 3vw, 2rem); }
    .topbar { display: flex; justify-content: space-between; align-items: start; gap: 1.25rem; border-bottom: 1px solid var(--border); padding-bottom: 1.25rem; }
    .eyebrow { margin: 0 0 .35rem; color: var(--primary); font-size: .8rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .muted { color: var(--muted); }
    .card { border: 1px solid var(--border); border-radius: .8rem; background: var(--surface); padding: 1rem; }
    .notice { margin: 1rem 0; border-left: .3rem solid var(--warning); }
    .notice[data-state="success"] { border-left-color: var(--success); }
    .notice[data-state="error"] { border-left-color: var(--danger); }
    .toolbar { display: flex; flex-wrap: wrap; align-items: end; gap: 1rem; margin: 1rem 0; }
    .toolbar label { min-width: min(100%, 20rem); }
    .toolbar .role { margin: 0 0 .2rem; color: var(--muted); }
    .dashboard-grid { display: grid; grid-template-columns: minmax(13rem, 17rem) minmax(0, 1fr); gap: 1rem; }
    nav { display: grid; align-content: start; gap: .4rem; }
    nav a { display: flex; gap: .55rem; align-items: center; border: 1px solid transparent; border-radius: .55rem; padding: .65rem .75rem; color: var(--muted); text-decoration: none; }
    nav a:hover { background: var(--surface-raised); color: var(--text); }
    nav a[aria-current="page"] { border-color: var(--primary); background: var(--primary-container); color: var(--text); }
    .nav-state { margin-left: auto; color: var(--warning); font-size: .75rem; }
    .content { display: grid; gap: 1rem; min-width: 0; }
    .hero { display: grid; gap: .7rem; }
    .hero p { margin-bottom: 0; }
    .badge { display: inline-flex; width: fit-content; border: 1px solid var(--border); border-radius: 999px; padding: .2rem .55rem; color: var(--muted); font-size: .78rem; font-weight: 700; }
    .badge.local { border-color: var(--success); color: var(--success); }
    .badge.disabled { border-color: var(--warning); color: var(--warning); }
    .plane-grid, .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: .75rem; }
    .plane-card, .status-card { border: 1px solid var(--border); border-radius: .65rem; background: var(--surface-raised); padding: .9rem; }
    .plane-card p, .status-card p { margin: .45rem 0 0; color: var(--muted); font-size: .92rem; }
    .plane-card[data-state="unavailable"] { opacity: .9; }
    .status-card[data-state="fixture"] { border-left: .25rem solid var(--success); }
    .status-card[data-state="disabled"] { border-left: .25rem solid var(--warning); }
    .lifecycle { display: flex; flex-wrap: wrap; gap: .45rem; list-style: none; padding: 0; margin: .85rem 0 0; }
    .lifecycle li { border: 1px solid var(--border); border-radius: 999px; padding: .35rem .6rem; color: var(--muted); font-size: .82rem; }
    .unavailable-affordance { display: inline-flex; align-items: center; border: 1px dashed var(--disabled); border-radius: .5rem; padding: .55rem .7rem; color: var(--disabled); font-size: .9rem; }
    .evidence-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
    .evidence-table th, .evidence-table td { border-bottom: 1px solid var(--border); padding: .65rem; text-align: left; vertical-align: top; }
    .evidence-table th { color: var(--muted); }
    .empty { color: var(--muted); }
    .login { max-width: 32rem; display: grid; gap: 1rem; }
    .login form { display: grid; gap: .8rem; }
    footer { padding-top: 1rem; color: var(--muted); font-size: .86rem; }
    @media (max-width: 54rem) { .topbar { flex-direction: column; } .dashboard-grid { grid-template-columns: 1fr; } nav { grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); } }
  </style>
</head>
<body>
  <a class="skip-link" href="#dashboard-content">Skip to dashboard content</a>
  <main class="shell" id="operator-shell" aria-label="24Seven.FM operator dashboard">
    <header class="topbar">
      <div>
        <p class="eyebrow">Local-only visual workspace</p>
        <h1>24Seven.FM Operator Dashboard</h1>
        <p class="muted">A station-scoped view of implemented control-plane contracts and intentionally unavailable future planes.</p>
      </div>
      <p class="muted">Version <span data-version>${escapeHtml(version.version)}</span> · Build <span data-build-id>${escapeHtml(version.buildId)}</span></p>
    </header>
    <section id="app-status" class="card notice" data-state="loading" role="status" aria-live="polite">Loading local access context…</section>
    <section id="operator-app" aria-live="polite"></section>
    <footer>Fixture/example status is never live station data. This shell cannot ingest media, start processing, publish schedules, control runtime, encode audio, change Icecast, or reach listeners.</footer>
  </main>
  <script>
  (() => {
    "use strict";
    const seededStations = ${safeJson(stations)};
    const views = [
      ["overview", "System overview", "local"],
      ["programming", "Programming Control Plane", "local"],
      ["media", "Media Workspace", "local"],
      ["playout", "Playout & Automation Runtime", "unavailable"],
      ["encoder", "Source Encoder Layer", "unavailable"],
      ["icecast", "Listener-Facing Icecast Layer", "unavailable"],
      ["audit", "Audit / operational evidence", "local"]
    ];
    const app = document.getElementById("operator-app");
    const status = document.getElementById("app-status");
    const state = { session: null, station: "", view: "overview", csrf: sessionStorage.getItem("24seven.m1.csrf") || "", notice: "" };
    const el = (tag, attributes, text) => { const node = document.createElement(tag); for (const [key, value] of Object.entries(attributes || {})) { if (key === "class") node.className = value; else if (key.startsWith("on")) node.addEventListener(key.slice(2), value); else if (value !== undefined && value !== null) node.setAttribute(key, String(value)); } if (text !== undefined) node.textContent = text; return node; };
    const reset = () => { while (app.firstChild) app.firstChild.remove(); };
    const setStatus = (message, kind) => { status.textContent = message; status.dataset.state = kind || "loading"; };
    const api = async (path, options) => { const response = await fetch(path, Object.assign({ credentials: "same-origin", headers: { "accept": "application/json" } }, options || {})); const payload = response.status === 204 ? undefined : await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(payload && payload.error || "request_failed"); error.code = payload && payload.error; throw error; } return payload; };
    const safeMessage = (error) => { const code = error && error.code || error && error.message; const messages = { unauthenticated: ["Sign in is required before a station-scoped dashboard context is available.", "loading"], forbidden: ["This station context is unavailable for the current role.", "error"], not_found: ["The requested dashboard context is unavailable for this station.", "error"], station_reference_forbidden: ["The selected reference is unavailable for this station.", "error"], csrf_rejected: ["Local access changed; sign in again before retrying.", "error"] }; return messages[code] || ["The dashboard context is unavailable. No operational action was requested.", "error"]; };
    const stationAllowed = (stationId) => state.session && (state.session.role === "owner" || state.session.stationIds.includes(stationId));
    const authorizedStations = () => seededStations.filter((station) => stationAllowed(station.id));
    const card = (title, stateText, description, stateClass) => { const item = el("article", { class: "plane-card", "data-state": stateClass || "local" }); item.append(el("h3", {}, title), el("span", { class: "badge " + (stateClass === "unavailable" ? "disabled" : "local") }, stateText), el("p", {}, description)); return item; };
    const heading = (title, intro) => { const section = el("section", { class: "card hero" }); section.append(el("h2", {}, title), el("p", { class: "muted" }, intro)); return section; };
    const renderOverview = () => { const section = heading("System overview", "This is a local-only visual shell. Status labels describe documented contract availability, not live service health or station activity."); const planes = el("div", { class: "plane-grid", "aria-label": "Four-plane architecture" }); planes.append(
      card("Programming Control Plane", "Local contract", "M1 and M3 records are separate from scheduling, runtime, encoding, and listener effects."),
      card("Playout & Automation Runtime", "Unavailable", "M5 is not started. No playout, DSP, device, or process control is present.", "unavailable"),
      card("Source Encoder Layer", "Unavailable", "M7 authority is not present. No encoder, relay, or source output is connected.", "unavailable"),
      card("Listener-Facing Icecast Layer", "Unavailable", "Icecast 2.x remains a future platform direction; no mounts or listeners are connected.", "unavailable")
    ); section.append(planes); const boundary = el("section", { class: "card" }); boundary.append(el("h2", {}, "Control-plane boundary"), el("p", { class: "muted" }, "Programming state remains Proposed/Preview (Dry-Run) → Approved → Published (Versioned) → Executed (Runtime). M3 asset readiness is separate from publication and execution."), el("span", { class: "unavailable-affordance", "aria-disabled": "true" }, "Operational activation requires a separately approved milestone")); return [section, boundary]; };
    const renderProgramming = () => { const section = heading("Programming Control Plane", "The local control-plane contract remains separate from M4 schedule publication and M5 runtime execution. This M3.8 dashboard shell is read-only."); const schedule = el("section", { class: "card", "aria-labelledby": "schedule-visibility-title" }); schedule.append(el("h2", { id: "schedule-visibility-title" }, "Schedule visibility"), el("p", { class: "muted" }, "Preview, review, approval, publication, and rollback are fixture-status views only. No schedule action is available from this dashboard."), el("span", { class: "unavailable-affordance", "aria-disabled": "true" }, "Unavailable — local M4 fixture visibility only; no publication or execution")); section.append(schedule, el("span", { class: "unavailable-affordance", "aria-disabled": "true" }, "Programming authoring and publication are not dashboard actions in this shell")); return [section]; };
    const renderMedia = () => { const section = heading("Media Workspace", "Fixture/example contract status only. No media, source location, tag, filename, payload, or live analysis result is loaded by this view."); const lifecycle = el("section", { class: "card" }); lifecycle.append(el("h2", {}, "Asset lifecycle visibility"), el("p", { class: "muted" }, "No asset is selected. These bounded labels describe the M3 lifecycle contract, not a live station record.")); const states = el("ol", { class: "lifecycle", "aria-label": "M3 asset lifecycle contract" }); ["proposed", "validated", "approved_for_processing", "processing", "analyzed", "metadata_pending", "ready_for_schedule_use"].forEach((value) => states.append(el("li", {}, value))); lifecycle.append(states); const statuses = el("section", { class: "card" }); statuses.append(el("h2", {}, "Fixture-only analysis and metadata boundaries")); const grid = el("div", { class: "status-grid" }); const items = [
      ["Asset / source reference", "Contract visible", "Opaque station-scoped reference validation only; no file or source access.", "fixture"],
      ["Processing boundary", "Disabled", "No worker, subprocess, parser, or media-processing dispatch.", "disabled"],
      ["Normalization", "Fixture-only", "No EBU R128 measurement, audio read, DSP, or gain application.", "fixture"],
      ["Cue / fade", "Fixture-only", "No detection, waveform access, or playout setting application.", "fixture"],
      ["Metadata candidate / resolution", "Fixture-only", "No provider lookup, media-tag extraction, automatic overwrite, or stream metadata publication.", "fixture"]
    ]; items.forEach(([title, label, description, category]) => { const item = el("article", { class: "status-card", "data-state": category }); item.append(el("h3", {}, title), el("span", { class: "badge " + (category === "disabled" ? "disabled" : "local") }, label), el("p", {}, description)); grid.append(item); }); statuses.append(grid); return [section, lifecycle, statuses]; };
    const renderFuturePlane = (title, description, requirement) => { const section = heading(title, description); section.append(el("span", { class: "unavailable-affordance", "aria-disabled": "true" }, requirement)); return [section]; };
    const renderAudit = () => { const section = heading("Audit / operational evidence", "This read-only shell shows the permitted evidence shape, not live audit data. Evidence remains station-scoped and content-free."); const tableCard = el("section", { class: "card" }); tableCard.append(el("h2", {}, "Permitted evidence fields")); const table = el("table", { class: "evidence-table" }); const head = el("thead", {}); const row = el("tr", {}); ["Action type", "Station ID", "Opaque entity ID", "State / category", "Safe timing / count"].forEach((label) => row.append(el("th", { scope: "col" }, label))); head.append(row); const body = el("tbody", {}); const empty = el("tr", {}); const cell = el("td", { colspan: "5", class: "empty" }, "No live evidence record is loaded. Titles, artists, filenames, paths, tags, media, credentials, tokens, CSRF values, provider payloads, and raw SQL are excluded."); empty.append(cell); body.append(empty); table.append(head, body); tableCard.append(table); return [section, tableCard]; };
    const renderView = () => { if (state.view === "overview") return renderOverview(); if (state.view === "programming") return renderProgramming(); if (state.view === "media") return renderMedia(); if (state.view === "audit") return renderAudit(); if (state.view === "playout") return renderFuturePlane("Playout & Automation Runtime", "M5 is an independently deployable future plane. This dashboard provides no runtime, DSP, deck, routing, or automation controls.", "Unavailable — requires separately approved M5 work and operational authorization"); if (state.view === "encoder") return renderFuturePlane("Source Encoder Layer", "M7 is a future source-encoding plane. No encoder profile, relay, or source operation is reachable from this dashboard.", "Unavailable — requires separately approved M7 work and operational authorization"); return renderFuturePlane("Listener-Facing Icecast Layer", "Icecast 2.x remains a future listener-facing platform. No mount, listener, metadata, or stream control is connected.", "Unavailable — requires separately approved M7 work and listener-facing authorization"); };
    const parseHash = () => { const parts = location.hash.match(/^#\\/stations\\/([^/]+)\\/([^/]+)$/); if (!parts) return; const station = decodeURIComponent(parts[1]); const view = parts[2]; if (!views.some((entry) => entry[0] === view)) return; if (state.session && !stationAllowed(station)) { state.notice = "The requested station context is unavailable for this session."; return; } state.station = station; state.view = view; };
    const navigate = (view) => { state.view = view; location.hash = "#/stations/" + encodeURIComponent(state.station) + "/" + view; renderShell(); };
    const renderNavigation = () => { const navigation = el("nav", { "aria-label": "Operator dashboard sections" }); views.forEach(([key, label, availability]) => { const link = el("a", { href: "#/stations/" + encodeURIComponent(state.station) + "/" + key }, label); if (key === state.view) link.setAttribute("aria-current", "page"); if (availability === "unavailable") link.append(el("span", { class: "nav-state" }, "Unavailable")); link.addEventListener("click", (event) => { event.preventDefault(); navigate(key); }); navigation.append(link); }); return navigation; };
    const renderSignIn = () => { reset(); const section = el("section", { class: "card login", "aria-labelledby": "local-access-title" }); section.append(el("h2", { id: "local-access-title" }, "Local access required"), el("p", { class: "muted" }, "Sign in to obtain a station-scoped visual context. Authentication does not expose media, runtime, encoder, or listener-facing controls.")); const form = el("form", {}); const email = el("label", {}, "Email"); email.append(el("input", { name: "email", type: "email", autocomplete: "username", required: "" })); const password = el("label", {}, "Password"); password.append(el("input", { name: "password", type: "password", autocomplete: "current-password", required: "" })); const submit = el("button", { type: "submit" }, "Sign in"); form.append(email, password, submit); form.addEventListener("submit", async (event) => { event.preventDefault(); try { const payload = await api("/api/v1/login", { method: "POST", headers: { "content-type": "application/json", "accept": "application/json" }, body: JSON.stringify({ email: form.elements.email.value, password: form.elements.password.value }) }); state.csrf = payload.csrfToken || ""; sessionStorage.setItem("24seven.m1.csrf", state.csrf); await loadSession(); setStatus("Signed in. The dashboard is local-only and non-operational.", "success"); } catch (error) { const message = safeMessage(error); setStatus(message[0], message[1]); } }); section.append(form); app.append(section); };
    const renderShell = () => { reset(); const stations = authorizedStations(); if (!stations.length) { app.append(el("section", { class: "card", role: "status" }, "No authorized station context is available for this session.")); return; } if (!state.station || !stationAllowed(state.station)) state.station = stations[0].id; const toolbar = el("section", { class: "card toolbar" }); const stationLabel = el("label", {}, "Station context"); const select = el("select", { "aria-label": "Station context" }); stations.forEach((station) => { const option = el("option", { value: station.id }, station.name); if (station.id === state.station) option.selected = true; select.append(option); }); select.addEventListener("change", () => { state.station = select.value; navigate(state.view); }); stationLabel.append(select); const role = el("p", { class: "role" }, "Role: " + state.session.role + " · Read-only dashboard shell"); const logout = el("button", { type: "button", class: "secondary" }, "Sign out"); logout.addEventListener("click", async () => { if (!state.csrf) { setStatus("Sign in again before signing out so the protected logout request has a valid local CSRF context.", "error"); return; } try { await api("/api/v1/logout", { method: "POST", headers: { "x-csrf-token": state.csrf } }); state.session = null; state.csrf = ""; sessionStorage.removeItem("24seven.m1.csrf"); setStatus("Signed out of the local operator dashboard.", "success"); renderSignIn(); } catch (error) { const message = safeMessage(error); setStatus(message[0], message[1]); } }); toolbar.append(stationLabel, role, logout); if (state.notice) { toolbar.append(el("p", { class: "muted", role: "status" }, state.notice)); state.notice = ""; } const grid = el("div", { class: "dashboard-grid" }); const content = el("div", { class: "content", id: "dashboard-content", tabindex: "-1" }); renderView().forEach((section) => content.append(section)); grid.append(renderNavigation(), content); app.append(toolbar, grid); };
    const loadSession = async () => { try { state.session = await api("/api/v1/session"); parseHash(); renderShell(); setStatus("Station-scoped local dashboard loaded. All future planes remain unavailable.", "success"); } catch (error) { state.session = null; renderSignIn(); const message = safeMessage(error); setStatus(message[0], message[1]); } };
    window.addEventListener("hashchange", () => { if (!state.session) return; parseHash(); renderShell(); });
    void loadSession();
  })();
  </script>
</body>
</html>`;
}
