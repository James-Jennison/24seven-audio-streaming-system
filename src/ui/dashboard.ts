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
 * The operator UI is intentionally a small same-origin browser client. It talks
 * only to the M1 protected programming API; it has no runtime, encoder, or
 * listener-facing controls.
 */
export function renderDashboard(
  stations: readonly Station[],
  version: ApplicationVersion,
): string {
  const cards = stations
    .map(
      (station) => `<article class="station-card">
  <h2>${escapeHtml(station.name)}</h2>
  <p>${escapeHtml(station.timezone)}</p>
  <p class="unavailable">Audio runtime unavailable</p>
</article>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>24Seven Audio Streaming System — Operator</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --background: #0f1419;
      --surface: #1b2026;
      --surface-raised: #242b33;
      --border: #3a4652;
      --text: #f3f7fb;
      --muted: #b8c8da;
      --primary: #9dcbff;
      --primary-container: #174a73;
      --on-primary: #003258;
      --success: #8fd8a8;
      --warning: #f4c977;
      --danger: #ffb4ab;
      --danger-surface: #5c1f1b;
      background: var(--background);
      color: var(--text);
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 20rem; background: var(--background); }
    button, input, select, textarea { font: inherit; }
    button, select, input, textarea { border-radius: .45rem; }
    button { cursor: pointer; border: 1px solid transparent; padding: .6rem .85rem; background: var(--primary); color: var(--on-primary); font-weight: 700; }
    button.secondary { background: transparent; color: var(--primary); border-color: var(--primary); }
    button.danger { background: var(--danger-surface); color: var(--danger); border-color: var(--danger); }
    button:disabled { cursor: not-allowed; opacity: .58; }
    button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid var(--primary); outline-offset: 3px; }
    input, select, textarea { width: 100%; border: 1px solid var(--border); background: var(--background); color: var(--text); padding: .55rem; }
    textarea { min-height: 5rem; resize: vertical; }
    label { display: grid; gap: .35rem; color: var(--muted); font-size: .92rem; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { margin-bottom: .2rem; font-size: clamp(1.45rem, 3vw, 2rem); }
    h2 { margin-bottom: .65rem; font-size: 1.2rem; }
    .shell { max-width: 88rem; margin: 0 auto; padding: 1.25rem; }
    .topbar { display: flex; align-items: start; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
    .eyebrow, .muted { color: var(--muted); }
    .eyebrow { margin: 0 0 .35rem; font-size: .82rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .card { border: 1px solid var(--border); border-radius: .7rem; background: var(--surface); padding: 1rem; }
    .notice { border-left: .3rem solid var(--warning); }
    .notice strong { color: var(--warning); }
    .status { margin: 1rem 0; min-height: 2.75rem; }
    .status[data-state="error"], .status[data-state="forbidden"], .status[data-state="not_found"] { border-left-color: var(--danger); }
    .status[data-state="success"] { border-left-color: var(--success); }
    .toolbar, .actions, .field-grid { display: flex; flex-wrap: wrap; gap: .75rem; align-items: end; }
    .toolbar { margin: 1rem 0; }
    .toolbar label { min-width: min(100%, 18rem); }
    .main-grid { display: grid; grid-template-columns: minmax(12rem, 16rem) minmax(0, 1fr); gap: 1rem; }
    nav { display: grid; align-content: start; gap: .35rem; }
    nav button { text-align: left; background: transparent; border-color: transparent; color: var(--muted); }
    nav button[aria-current="page"] { background: var(--primary-container); color: var(--text); border-color: var(--primary); }
    .content { display: grid; gap: 1rem; }
    .state-machine { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .5rem; }
    .state-step { min-height: 5rem; border: 1px solid var(--border); border-radius: .5rem; padding: .65rem; background: var(--surface-raised); }
    .state-step.active { border-color: var(--primary); }
    .state-step.unavailable { opacity: .78; }
    .state-step span { display: block; color: var(--muted); font-size: .82rem; }
    .records { list-style: none; padding: 0; margin: 0; display: grid; gap: .5rem; }
    .record { display: flex; justify-content: space-between; align-items: center; gap: .75rem; padding: .7rem; border: 1px solid var(--border); border-radius: .5rem; }
    .record p { margin: .2rem 0 0; color: var(--muted); font-size: .86rem; overflow-wrap: anywhere; }
    .record button { flex: 0 0 auto; }
    .two-column { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, .8fr); gap: 1rem; }
    .form-fields { display: grid; gap: .75rem; }
    .form-fields .field-grid > label { flex: 1 1 13rem; }
    .hidden { display: none !important; }
    .unavailable { color: var(--warning); font-weight: 700; }
    .read-only { color: var(--warning); }
    .empty { color: var(--muted); }
    .stations { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 1rem; }
    .station-card { border: 1px solid var(--border); border-radius: .6rem; padding: 1rem; background: var(--surface); }
    .station-card p { color: var(--muted); }
    .dry-run-list { display: grid; gap: .55rem; }
    .dry-run-item { border-left: .25rem solid var(--success); padding-left: .65rem; }
    .dry-run-item.ineligible { border-color: var(--warning); }
    footer { color: var(--muted); font-size: .86rem; padding-top: 1rem; }
    @media (max-width: 52rem) { .main-grid, .two-column { grid-template-columns: 1fr; } .state-machine { grid-template-columns: repeat(2, 1fr); } .topbar { flex-direction: column; } }
  </style>
</head>
<body>
  <main class="shell" id="operator-shell" aria-label="24Seven programming operator">
    <header class="topbar">
      <div><p class="eyebrow">Programming control plane</p><h1>24Seven Audio Streaming System</h1><p class="muted">Local operator interface. Runtime and streaming controls are unavailable.</p></div>
      <p class="muted">Version <span data-version>${escapeHtml(version.version)}</span> · Build <span data-build-id>${escapeHtml(version.buildId)}</span></p>
    </header>
    <section id="app-status" class="card notice status" data-state="loading" role="status" aria-live="polite">Loading secure operator session…</section>
    <section id="operator-app" aria-live="polite"></section>
    <noscript><section class="card notice"><strong>JavaScript is required for the local operator interface.</strong> No programming, runtime, or streaming action is available without it.</section><section class="stations" aria-label="Configured stations">${cards}</section></noscript>
  </main>
  <script>
  (() => {
    "use strict";
    const seededStations = ${safeJson(stations)};
    const kinds = [
      ["media", "Library metadata"], ["playlists", "Playlists"], ["separation-rules", "Separation rules"],
      ["rotations", "Rotations"], ["clocks", "Clocks"], ["program-blocks", "Program blocks"], ["scheduled-events", "Scheduled events"],
      ["media-imports", "M3 media import requests"]
    ];
    const app = document.getElementById("operator-app");
    const status = document.getElementById("app-status");
    const state = { session: null, station: "", kind: "media", csrf: sessionStorage.getItem("24seven.m1.csrf") || "", records: [], selected: null };
    const el = (tag, attrs, text) => { const node = document.createElement(tag); for (const [key, value] of Object.entries(attrs || {})) { if (key === "class") node.className = value; else if (key.startsWith("on")) node.addEventListener(key.slice(2), value); else if (value !== undefined && value !== null) node.setAttribute(key, String(value)); } if (text !== undefined) node.textContent = text; return node; };
    const setStatus = (message, kind) => { status.textContent = message; status.dataset.state = kind || "loading"; };
    const api = async (path, options) => {
      const response = await fetch(path, Object.assign({ credentials: "same-origin", headers: { "accept": "application/json" } }, options || {}));
      const payload = response.status === 204 ? undefined : await response.json().catch(() => ({}));
      if (!response.ok) { const error = new Error(payload && payload.error || "request_failed"); error.code = payload && payload.error; throw error; }
      return payload;
    };
    const safeMessage = (error) => {
      const code = error && error.code || error && error.message;
      const messages = {
        unauthenticated: ["Sign in is required to access this programming view.", "unauthenticated"],
        forbidden: ["Your role cannot perform that programming action.", "forbidden"],
        not_found: ["The requested record is unavailable for this station.", "not_found"],
        station_reference_forbidden: ["The selected reference is not available for this station.", "error"],
        csrf_rejected: ["This change was not saved. Sign in again before retrying the protected action.", "error"],
        validation_error: ["The change was not saved. Review the highlighted values and try again.", "error"],
        invalid_request: ["The request could not be processed. Review the form and try again.", "error"]
      };
      return messages[code] || ["The request could not be completed. No programming change was made.", "error"];
    };
    const canProgram = () => state.session && ["owner", "administrator", "programmer"].includes(state.session.role) && Boolean(state.csrf);
    const stationAllowed = (stationId) => state.session && (state.session.role === "owner" || state.session.stationIds.includes(stationId));
    const authorizedStations = () => seededStations.filter((station) => stationAllowed(station.id));
    const reset = () => { while (app.firstChild) app.firstChild.remove(); };
    const button = (label, click, className) => el("button", { type: "button", class: className, onclick: click }, label);
    const input = (labelText, name, type, value, required) => { const label = el("label", {}); label.append(labelText); const control = el(type === "textarea" ? "textarea" : "input", { name, type: type === "textarea" ? undefined : type, value: value === undefined || value === null ? "" : value, required: required ? "" : undefined }); if (type === "textarea") control.value = value === undefined || value === null ? "" : value; label.append(control); return label; };
    const listText = (value) => Array.isArray(value) ? value.join("\\n") : "";
    const normalizeRecord = (kind, record) => {
      if (!record || typeof record !== "object") return record;
      const value = Object.assign({}, record);
      const aliases = {
        station_id: "stationId", duration_milliseconds: "durationMilliseconds", genre_tags: "genreTags", source_reference: "sourceReference", lifecycle_state: "lifecycleState",
        playlist_id: "playlistId", minimum_minutes: "minimumMinutes", clock_id: "clockId", starts_at_local_time: "startsAtLocalTime",
        days_of_week: "daysOfWeek", scheduled_for: "scheduledFor", payload_reference: "payloadReference"
      };
      Object.entries(aliases).forEach(([from, to]) => { if (value[to] === undefined && value[from] !== undefined) value[to] = value[from]; });
      return value;
    };
    const fieldsFor = (kind, record) => {
      const fields = el("div", { class: "form-fields" }); const grid = el("div", { class: "field-grid" }); fields.append(grid);
      if (kind === "media") { grid.append(input("Title", "title", "text", record && record.title, true), input("Artist", "artist", "text", record && record.artist, true), input("Album", "album", "text", record && record.album), input("Duration (milliseconds)", "durationMilliseconds", "number", record && record.durationMilliseconds), input("Category", "category", "text", record && record.category, true), input("Genre tags (one per line)", "genreTags", "textarea", listText(record && record.genreTags), true), input("Tags (one per line)", "tags", "textarea", listText(record && record.tags), true), input("Managed asset reference (opaque identifier; no upload)", "sourceReference", "text", record && record.sourceReference, true)); const lifecycle = el("label", {}, "Lifecycle state"); const select = el("select", { name: "lifecycleState" }); ["draft", "available", "retired"].forEach((value) => { const option = el("option", { value }, value); if ((record && record.lifecycleState || "draft") === value) option.selected = true; select.append(option); }); lifecycle.append(select); grid.append(lifecycle); }
      else if (kind === "media-imports") { grid.append(input("Idempotency key (opaque)", "idempotencyKey", "text", "", true), input("Source reference (opaque; no upload)", "sourceOpaqueId", "text", "", true)); const sourceKind = el("label", {}, "Source reference class"); const select = el("select", { name: "sourceKind" }); ["operator_staged_reference", "managed_source_reference"].forEach((value) => { const option = el("option", { value }, value); if (value === "operator_staged_reference") option.selected = true; select.append(option); }); sourceKind.append(select); grid.append(sourceKind); fields.append(el("p", { class: "muted", role: "status" }, "Creating a request only records a proposed station-scoped item. It does not upload, process, schedule, publish, or execute media.")); }
      else if (kind === "playlists") { grid.append(input("Playlist name", "name", "text", record && record.name, true), input("Media IDs (one per line)", "mediaIds", "textarea", listText(record && record.mediaIds), false)); }
      else if (kind === "separation-rules") { const scope = el("label", {}, "Separation scope"); const select = el("select", { name: "scope" }); ["artist", "title", "album", "category"].forEach((value) => { const option = el("option", { value }, value); if ((record && record.scope || "artist") === value) option.selected = true; select.append(option); }); scope.append(select); grid.append(scope, input("Minimum minutes", "minimumMinutes", "number", record && record.minimumMinutes || 0, true)); }
      else if (kind === "rotations") { grid.append(input("Rotation name", "name", "text", record && record.name, true), input("Playlist ID", "playlistId", "text", record && record.playlistId, true), input("Weight", "weight", "number", record && record.weight || 1, true)); const enabled = el("label", {}, "Enabled"); const check = el("input", { name: "enabled", type: "checkbox" }); check.checked = record ? Boolean(record.enabled) : true; enabled.append(check); grid.append(enabled); }
      else if (kind === "clocks") { grid.append(input("Clock name", "name", "text", record && record.name, true), input("Clock slots (JSON array of structured slot values)", "slots", "textarea", JSON.stringify(record && record.slots || [], null, 2), true)); }
      else if (kind === "program-blocks") { grid.append(input("Program block name", "name", "text", record && record.name, true), input("Clock ID", "clockId", "text", record && record.clockId, true), input("IANA timezone", "timezone", "text", record && record.timezone || "UTC", true), input("Start time (HH:MM)", "startsAtLocalTime", "time", record && record.startsAtLocalTime, true), input("Days of week (0–6, comma-separated)", "daysOfWeek", "text", record && Array.isArray(record.daysOfWeek) ? record.daysOfWeek.join(",") : "", true)); }
      else { grid.append(input("Scheduled UTC time", "scheduledFor", "datetime-local", record && record.scheduledFor ? String(record.scheduledFor).replace("Z", "").slice(0, 16) : "", true), input("Approved reference", "payloadReference", "text", record && record.payloadReference, true)); const kindLabel = el("label", {}, "Event kind"); const select = el("select", { name: "kind" }); ["program-block", "announcement", "maintenance"].forEach((value) => { const option = el("option", { value }, value); if ((record && record.kind || "program-block") === value) option.selected = true; select.append(option); }); kindLabel.append(select); grid.append(kindLabel); }
      return fields;
    };
    const bodyFrom = (kind, form) => {
      const data = new FormData(form); const value = (key) => String(data.get(key) || "").trim(); const lines = (key) => value(key).split("\\n").map((entry) => entry.trim()).filter(Boolean);
      if (kind === "media") { const reference = value("sourceReference"); if (/[\\\\/]/.test(reference)) throw Object.assign(new Error("validation_error"), { code: "validation_error" }); const duration = value("durationMilliseconds"); return { title: value("title"), artist: value("artist"), album: value("album") || undefined, durationMilliseconds: duration ? Number(duration) : undefined, category: value("category"), genreTags: lines("genreTags"), tags: lines("tags"), sourceReference: reference, lifecycleState: value("lifecycleState") }; }
      if (kind === "media-imports") return { idempotencyKey: value("idempotencyKey"), source: { kind: value("sourceKind"), opaqueId: value("sourceOpaqueId") } };
      if (kind === "playlists") return { name: value("name"), mediaIds: lines("mediaIds") };
      if (kind === "separation-rules") return { scope: value("scope"), minimumMinutes: Number(value("minimumMinutes")) };
      if (kind === "rotations") return { name: value("name"), playlistId: value("playlistId"), weight: Number(value("weight")), enabled: Boolean(data.get("enabled")) };
      if (kind === "clocks") { let slots; try { slots = JSON.parse(value("slots")); } catch { throw Object.assign(new Error("validation_error"), { code: "validation_error" }); } return { name: value("name"), slots }; }
      if (kind === "program-blocks") return { name: value("name"), clockId: value("clockId"), timezone: value("timezone"), startsAtLocalTime: value("startsAtLocalTime"), daysOfWeek: value("daysOfWeek").split(",").filter(Boolean).map((day) => Number(day.trim())) };
      const localTime = value("scheduledFor"); return { scheduledFor: localTime ? new Date(localTime).toISOString() : "", kind: value("kind"), payloadReference: value("payloadReference") };
    };
    const renderSignIn = () => {
      reset(); const card = el("section", { class: "card", "aria-labelledby": "sign-in-title" }); card.append(el("h2", { id: "sign-in-title" }, "Sign in to programming"), el("p", { class: "muted" }, "Use a local administrator account. Authentication does not expose stream, runtime, or media-ingestion controls."));
      const form = el("form", {}); form.append(input("Email", "email", "email", "", true), input("Password", "password", "password", "", true), button("Sign in", async () => { try { const payload = await api("/api/v1/login", { method: "POST", headers: { "content-type": "application/json", "accept": "application/json" }, body: JSON.stringify({ email: form.elements.email.value, password: form.elements.password.value }) }); state.csrf = payload.csrfToken || ""; sessionStorage.setItem("24seven.m1.csrf", state.csrf); await loadSession(); setStatus("Signed in. Select an authorized station to review programming proposals.", "success"); } catch (error) { const message = safeMessage(error); setStatus(message[0], message[1]); } })); card.append(form);
      const setup = el("details", { class: "card" }); setup.append(el("summary", {}, "Initial local owner setup"), el("p", { class: "muted" }, "Available only when no account exists. Credentials are sent only to the protected local bootstrap endpoint and are never shown again.")); const bootstrap = el("form", {}); bootstrap.append(input("Owner email", "email", "email", "", true), input("Owner password", "password", "password", "", true), button("Create initial owner", async () => { try { await api("/api/v1/bootstrap", { method: "POST", headers: { "content-type": "application/json", "accept": "application/json" }, body: JSON.stringify({ email: bootstrap.elements.email.value, password: bootstrap.elements.password.value }) }); setStatus("Initial owner created. Sign in with that account to continue.", "success"); } catch (error) { const message = safeMessage(error); setStatus(message[0], message[1]); } })); setup.append(bootstrap); card.append(setup); app.append(card);
    };
    const renderStateMachine = () => { const section = el("section", { class: "card", "aria-label": "Programming state machine" }); section.append(el("h2", {}, "Programming state")); const steps = el("div", { class: "state-machine" }); [["Proposed / Preview", "M1 records and M3 opaque import validation", "active"], ["Approved", "M3 approval only permits a future sandbox boundary; it starts no worker", "active"], ["Published (Versioned)", "M4 publication boundary; no published version is available", "unavailable"], ["Executed (Runtime)", "M5 runtime controls are unavailable and not rendered here", "unavailable"]].forEach((step) => { const item = el("div", { class: "state-step " + step[2] }); item.append(el("strong", {}, step[0]), el("span", {}, step[1])); steps.append(item); }); section.append(steps); return section; };
    const renderNavigation = () => { const nav = el("nav", { "aria-label": "Programming sections" }); kinds.forEach(([key, label]) => { const item = button(label, () => { state.kind = key; state.selected = null; location.hash = "#/stations/" + encodeURIComponent(state.station) + "/" + key; loadRecords(); }, "secondary"); if (state.kind === key) item.setAttribute("aria-current", "page"); nav.append(item); }); return nav; };
    const renderRecords = () => { const card = el("section", { class: "card" }); card.append(el("h2", {}, kinds.find((entry) => entry[0] === state.kind)[1])); if (!state.records.length) card.append(el("p", { class: "empty" }, "No records exist for this station yet. This does not create a schedule or runtime action.")); else { const records = el("ul", { class: "records", "aria-label": "Station-scoped records" }); state.records.forEach((record) => { const row = el("li", { class: "record" }); const detail = el("div", {}); detail.append(el("strong", {}, record.name || record.title || record.id), el("p", {}, state.kind === "media-imports" ? "Lifecycle: " + record.lifecycleState : "Station-scoped record")); row.append(detail, button("View details", () => loadDetail(record.id), "secondary")); records.append(row); }); card.append(records); } return card; };
    const renderEditor = () => { const card = el("section", { class: "card" }); const writable = canProgram(); card.append(el("h2", {}, state.selected ? "Edit selected record" : "Create programming proposal")); if (!writable) { card.append(el("p", { class: "read-only", role: "status" }, state.session && state.session.role === "observer" ? "Read-only access: this role cannot create, update, or delete programming." : "Read-only for programming: this role cannot create, update, or delete programming.")); return card; }
      if (state.kind === "media-imports" && state.selected) { const lifecycle = state.selected.lifecycleState; card.append(el("p", { class: "muted", role: "status" }, "M3 lifecycle: " + lifecycle + ". No processing worker, media tooling, schedule, runtime, encoder, relay, or listener service is invoked by these controls."), el("p", { class: "read-only", role: "status" }, "Processing boundary status: disabled. A future worker is unavailable; this view cannot dispatch processing.")); const actions = el("div", { class: "actions" }); const advance = (action, label) => button(label, async () => { try { await api("/api/v1/stations/" + encodeURIComponent(state.station) + "/media-imports/" + encodeURIComponent(state.selected.id) + "/" + action, { method: "POST", headers: { "x-csrf-token": state.csrf } }); state.selected = null; await loadRecords(); setStatus(action === "retry" ? "Retry eligibility recorded. Processing remains disabled." : "M3 lifecycle recorded. Processing remains disabled.", "success"); } catch (error) { const message = safeMessage(error); setStatus(message[0], message[1]); } }); if (lifecycle === "proposed") actions.append(advance("validate", "Validate proposed request"), advance("reject", "Reject request")); if (lifecycle === "validated") actions.append(advance("approve", "Approve for future processing"), advance("reject", "Reject request")); if (lifecycle === "quarantined" || lifecycle === "failed") actions.append(advance("retry", "Authorize eligible retry (no processing)")); if (lifecycle === "rejected") card.append(el("p", { class: "read-only", role: "status" }, "Rejected requests are terminal. A new station-scoped proposal is required; no recovery or processing control is available.")); card.append(actions); return card; }
      const form = el("form", { "aria-label": "Programming proposal form" }); form.append(fieldsFor(state.kind, state.selected)); const actions = el("div", { class: "actions" }); actions.append(button(state.selected ? "Save validated change" : "Create proposal", async () => { try { const payload = bodyFrom(state.kind, form); const path = "/api/v1/stations/" + encodeURIComponent(state.station) + "/" + state.kind + (state.selected ? "/" + encodeURIComponent(state.selected.id) : ""); await api(path, { method: state.selected ? "PATCH" : "POST", headers: { "content-type": "application/json", "accept": "application/json", "x-csrf-token": state.csrf }, body: JSON.stringify(payload) }); setStatus("Programming proposal saved. It has not approved, published, or executed anything.", "success"); state.selected = null; await loadRecords(); } catch (error) { const message = safeMessage(error); setStatus(message[0], message[1]); } })); if (state.selected) actions.append(button("Delete proposal", async () => { if (!window.confirm("Delete this station-scoped programming record? This cannot affect runtime because no runtime action exists.")) return; try { await api("/api/v1/stations/" + encodeURIComponent(state.station) + "/" + state.kind + "/" + encodeURIComponent(state.selected.id), { method: "DELETE", headers: { "x-csrf-token": state.csrf } }); setStatus("Programming proposal deleted. No schedule or runtime action occurred.", "success"); state.selected = null; await loadRecords(); } catch (error) { const message = safeMessage(error); setStatus(message[0], message[1]); } }, "danger")); card.append(form, actions); return card; };
    const renderDryRun = () => { const card = el("section", { class: "card" }); card.append(el("h2", {}, "Deterministic dry-run preview"), el("p", { class: "muted" }, "This read-only preview produces proposals only. It does not approve, publish, queue, schedule, or execute audio.")); const controls = el("div", { class: "toolbar" }); const minutes = input("Separation minutes", "separationMinutes", "number", 30, true); controls.append(minutes, button("Preview eligible media", async () => { try { const value = minutes.querySelector("input").value; const payload = await api("/api/v1/stations/" + encodeURIComponent(state.station) + "/dry-run?separationMinutes=" + encodeURIComponent(value)); const output = el("div", { class: "dry-run-list", role: "status" }); if (!payload.plan.length) output.append(el("p", { class: "empty" }, "No available media proposals for this station.")); payload.plan.forEach((candidate) => { const item = el("div", { class: "dry-run-item" + (candidate.eligible ? "" : " ineligible") }); item.append(el("strong", {}, candidate.media.title + " — " + candidate.media.artist), el("p", { class: "muted" }, candidate.eligible ? "Eligible" : "Not eligible"), el("p", { class: "muted" }, candidate.reasons.join("; "))); output.append(item); }); const previous = card.querySelector(".dry-run-list"); if (previous) previous.remove(); card.append(output); setStatus("Dry-run preview loaded. It is read-only and non-binding.", "success"); } catch (error) { const message = safeMessage(error); setStatus(message[0], message[1]); } })); card.append(controls); return card; };
    const renderOperator = () => { reset(); const stations = authorizedStations(); if (!stations.length) { app.append(el("section", { class: "card", role: "status" }, "No authorized station is available for this session.")); return; } if (!state.station || !stationAllowed(state.station)) state.station = stations[0].id;
      const toolbar = el("section", { class: "card toolbar" }); const stationLabel = el("label", {}, "Station context"); const select = el("select", { "aria-label": "Station context" }); stations.forEach((station) => { const option = el("option", { value: station.id }, station.name); if (station.id === state.station) option.selected = true; select.append(option); }); select.addEventListener("change", () => { state.station = select.value; state.selected = null; state.records = []; location.hash = "#/stations/" + encodeURIComponent(state.station) + "/" + state.kind; loadRecords(); }); stationLabel.append(select); toolbar.append(stationLabel, el("p", { class: "muted" }, "Role: " + state.session.role)); const logout = button("Sign out", async () => { if (!state.csrf) { setStatus("Sign in again before signing out so the protected logout request has a valid CSRF token.", "error"); return; } try { await api("/api/v1/logout", { method: "POST", headers: { "x-csrf-token": state.csrf } }); state.session = null; state.csrf = ""; sessionStorage.removeItem("24seven.m1.csrf"); setStatus("Signed out of the local operator interface.", "success"); renderSignIn(); } catch (error) { const message = safeMessage(error); setStatus(message[0], message[1]); } }, "secondary"); logout.disabled = !state.csrf; toolbar.append(logout); app.append(toolbar, renderStateMachine()); const grid = el("div", { class: "main-grid" }); const content = el("div", { class: "content" }); content.append(renderRecords(), renderEditor(), renderDryRun()); grid.append(renderNavigation(), content); app.append(grid); };
    const loadDetail = async (id) => { try { state.selected = normalizeRecord(state.kind, await api("/api/v1/stations/" + encodeURIComponent(state.station) + "/" + state.kind + "/" + encodeURIComponent(id))); renderOperator(); setStatus("Loaded station-scoped record details.", "success"); } catch (error) { const message = safeMessage(error); setStatus(message[0], message[1]); } };
    const loadRecords = async () => { if (!state.session || !stationAllowed(state.station)) return; setStatus("Loading station-scoped programming data…", "loading"); try { const payload = await api("/api/v1/stations/" + encodeURIComponent(state.station) + "/" + state.kind); state.records = payload.items || []; renderOperator(); setStatus(state.records.length ? "Station-scoped records loaded." : "No records exist for this station yet.", state.records.length ? "success" : "loading"); } catch (error) { const message = safeMessage(error); setStatus(message[0], message[1]); if (error && error.code === "unauthenticated") renderSignIn(); } };
    const loadSession = async () => { try { state.session = await api("/api/v1/session"); const parts = location.hash.match(/^#\\/stations\\/([^/]+)\\/([^/]+)$/); if (parts && stationAllowed(decodeURIComponent(parts[1])) && kinds.some((entry) => entry[0] === parts[2])) { state.station = decodeURIComponent(parts[1]); state.kind = parts[2]; } renderOperator(); await loadRecords(); } catch (error) { state.session = null; renderSignIn(); const message = safeMessage(error); setStatus(message[0], message[1]); } };
    void loadSession();
  })();
  </script>
</body>
</html>`;
}
