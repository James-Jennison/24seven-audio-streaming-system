import { DOMAIN_CONTRACT_VERSION, type Station } from "./contracts.js";

const seedTime = "2026-08-03T00:00:00.000Z";

export const seededStations: readonly Station[] = [
  {
    id: "station_streamingsoundtracks",
    contractVersion: DOMAIN_CONTRACT_VERSION,
    slug: "streamingsoundtracks",
    name: "StreamingSoundtracks",
    timezone: "America/Los_Angeles",
    enabled: true,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    id: "station_1980s_fm",
    contractVersion: DOMAIN_CONTRACT_VERSION,
    slug: "1980s-fm",
    name: "1980s.FM",
    timezone: "America/Los_Angeles",
    enabled: true,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    id: "station_adagio_fm",
    contractVersion: DOMAIN_CONTRACT_VERSION,
    slug: "adagio-fm",
    name: "Adagio.FM",
    timezone: "America/Los_Angeles",
    enabled: true,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    id: "station_death_fm",
    contractVersion: DOMAIN_CONTRACT_VERSION,
    slug: "death-fm",
    name: "Death.FM",
    timezone: "America/Los_Angeles",
    enabled: true,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
  {
    id: "station_entranced_fm",
    contractVersion: DOMAIN_CONTRACT_VERSION,
    slug: "entranced-fm",
    name: "Entranced.FM",
    timezone: "America/Los_Angeles",
    enabled: true,
    createdAt: seedTime,
    updatedAt: seedTime,
  },
];
