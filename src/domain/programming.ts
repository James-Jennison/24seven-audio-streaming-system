import { randomUUID } from "node:crypto";

import type { StableId } from "./contracts.js";

export type ApplicationRole =
  | "owner"
  | "administrator"
  | "programmer"
  | "operator"
  | "observer";
export type MediaLifecycle = "draft" | "available" | "retired";
export type SeparationScope = "artist" | "title" | "album" | "category";
export type ScheduledEventKind =
  | "program-block"
  | "announcement"
  | "maintenance";

export interface MediaMetadataInput {
  stationId: StableId;
  title: string;
  artist: string;
  album?: string;
  durationMilliseconds?: number;
  category: string;
  genreTags: string[];
  tags: string[];
  sourceReference: string;
  lifecycleState: MediaLifecycle;
}

export interface MediaMetadata extends MediaMetadataInput {
  id: StableId;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistDefinition {
  name: string;
  mediaIds: readonly string[];
}

export interface SeparationRuleDefinition {
  scope: SeparationScope;
  minimumMinutes: number;
}

export interface RotationDefinition {
  playlistId: string;
  name: string;
  weight: number;
  enabled: boolean;
}

export interface ClockDefinition {
  name: string;
  slots: readonly unknown[];
}

export interface ProgramBlockDefinition {
  clockId: string;
  name: string;
  timezone: string;
  startsAtLocalTime: string;
  daysOfWeek: readonly number[];
}

export interface ScheduledEventDefinition {
  scheduledFor: string;
  kind: ScheduledEventKind;
  payloadReference: string;
}

export interface DryRunCandidate {
  media: MediaMetadata;
  eligible: boolean;
  reasons: string[];
}

export function validateMedia(input: MediaMetadataInput): void {
  if (
    !input.stationId ||
    !input.title.trim() ||
    !input.artist.trim() ||
    !input.category.trim() ||
    !input.sourceReference.trim()
  ) {
    throw new Error(
      "Media metadata requires station, title, artist, category, and source reference.",
    );
  }
  if (
    input.durationMilliseconds !== undefined &&
    input.durationMilliseconds <= 0
  ) {
    throw new Error("Media duration must be positive when supplied.");
  }
  if (
    new Set(input.genreTags).size !== input.genreTags.length ||
    new Set(input.tags).size !== input.tags.length
  ) {
    throw new Error("Media tags must not contain duplicates.");
  }
}

function requireNonBlank(value: string, field: string): void {
  if (!value.trim()) throw new Error(`invalid_${field}`);
}

function hasDuplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function isJsonValue(value: unknown): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).every(isJsonValue);
}

export function validatePlaylist(input: PlaylistDefinition): void {
  requireNonBlank(input.name, "playlist_name");
  if (input.mediaIds.some((id) => !id.trim()) || hasDuplicate(input.mediaIds))
    throw new Error("invalid_playlist_media");
}

export function validateSeparationRule(input: SeparationRuleDefinition): void {
  if (!["artist", "title", "album", "category"].includes(input.scope))
    throw new Error("invalid_separation_scope");
  if (!Number.isInteger(input.minimumMinutes) || input.minimumMinutes < 0)
    throw new Error("invalid_separation");
}

export function validateRotation(input: RotationDefinition): void {
  requireNonBlank(input.playlistId, "playlist_reference");
  requireNonBlank(input.name, "rotation_name");
  if (!Number.isInteger(input.weight) || input.weight <= 0)
    throw new Error("invalid_weight");
}

export function validateClock(input: ClockDefinition): void {
  requireNonBlank(input.name, "clock_name");
  if (!Array.isArray(input.slots) || !input.slots.every(isJsonValue))
    throw new Error("invalid_clock_slots");
}

export function validateProgramBlock(input: ProgramBlockDefinition): void {
  requireNonBlank(input.clockId, "clock_reference");
  requireNonBlank(input.name, "program_block_name");
  try {
    Intl.DateTimeFormat("en-US", { timeZone: input.timezone });
  } catch {
    throw new Error("invalid_timezone");
  }
  if (!/^\d{2}:\d{2}(?::\d{2})?$/.test(input.startsAtLocalTime))
    throw new Error("invalid_program_block_time");
  const [hour, minute, second = 0] = input.startsAtLocalTime
    .split(":")
    .map(Number);
  if (hour! > 23 || minute! > 59 || second! > 59)
    throw new Error("invalid_program_block_time");
  if (
    !input.daysOfWeek.length ||
    input.daysOfWeek.some(
      (day) => !Number.isInteger(day) || day < 0 || day > 6,
    ) ||
    new Set(input.daysOfWeek).size !== input.daysOfWeek.length
  )
    throw new Error("invalid_program_block_days");
}

export function validateScheduledEvent(input: ScheduledEventDefinition): void {
  if (!["program-block", "announcement", "maintenance"].includes(input.kind))
    throw new Error("invalid_scheduled_event_kind");
  requireNonBlank(input.payloadReference, "scheduled_event_reference");
  const date = new Date(input.scheduledFor);
  if (Number.isNaN(date.getTime()) || !input.scheduledFor.endsWith("Z"))
    throw new Error("invalid_scheduled_event_time");
}

export function createMedia(
  input: MediaMetadataInput,
  now = new Date().toISOString(),
): MediaMetadata {
  validateMedia(input);
  return { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
}

export function dryRunSelection(
  stationId: StableId,
  candidates: readonly MediaMetadata[],
  recent: readonly MediaMetadata[],
  separationMinutes: number,
): DryRunCandidate[] {
  return candidates
    .filter(
      (candidate) =>
        candidate.stationId === stationId &&
        candidate.lifecycleState === "available",
    )
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((media) => {
      const reasons: string[] = ["available for selected station"];
      const conflict = recent.find(
        (item) => item.artist === media.artist || item.title === media.title,
      );
      if (conflict && separationMinutes > 0)
        reasons.push(
          `blocked by ${separationMinutes}-minute artist/title separation`,
        );
      return { media, eligible: !conflict || separationMinutes === 0, reasons };
    });
}
