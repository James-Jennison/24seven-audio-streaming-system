import type { Station } from "../domain/contracts.js";
import type { ApplicationVersion } from "../app/version.js";

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

export function renderDashboard(
  stations: readonly Station[],
  version: ApplicationVersion,
): string {
  const cards = stations
    .map(
      (
        station,
      ) => `<article class="station-card" data-station-id="${escapeHtml(station.id)}">
  <h2>${escapeHtml(station.name)}</h2>
  <dl>
    <div><dt>Station status</dt><dd>Configured for local development</dd></div>
    <div><dt>Audio runtime</dt><dd class="unavailable">Not implemented in M0</dd></div>
    <div><dt>Timezone</dt><dd>${escapeHtml(station.timezone)}</dd></div>
  </dl>
</article>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>24Seven Audio Streaming System — M0</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #111827; color: #f3f4f6; }
    body { max-width: 70rem; margin: 0 auto; padding: 2rem; }
    .notice { border-left: .25rem solid #f59e0b; padding: 1rem; background: #1f2937; }
    .stations { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 1rem; }
    .station-card { border: 1px solid #4b5563; border-radius: .5rem; padding: 1rem; background: #1f2937; }
    dt { color: #9ca3af; font-size: .9rem; } dd { margin: .2rem 0 1rem; } .unavailable { color: #fbbf24; font-weight: 700; }
    footer { margin-top: 2rem; color: #9ca3af; }
  </style>
</head>
<body>
  <header>
    <h1>24Seven Audio Streaming System</h1>
    <p>M0 local-only control-plane status dashboard</p>
  </header>
  <section class="notice" aria-label="M0 limitation">
    <strong>Audio runtime not implemented.</strong> This dashboard does not provide playout, streams, media import, output health, or authentication.
  </section>
  <main>
    <h2>Stations</h2>
    <section class="stations" aria-label="Configured stations">
${cards}
    </section>
  </main>
  <footer>Version <span data-version>${escapeHtml(version.version)}</span> · Build <span data-build-id>${escapeHtml(version.buildId)}</span></footer>
</body>
</html>`;
}
