import { validateOpaqueReference } from "../domain/m3-assets.js";
import type { IanaTimezone, StableId } from "../domain/contracts.js";

export const M4_CIVIL_DAY_MINUTES = 24 * 60;

export interface M4ClockTemplateSlot {
  id: StableId;
  localStartMinute: number;
  durationMinutes: number;
}

/** An opaque, station-local template with no asset, media, or policy data. */
export interface M4ClockTemplate {
  id: StableId;
  stationId: StableId;
  timezone: IanaTimezone;
  revision: number;
  slots: readonly M4ClockTemplateSlot[];
}

export interface M4CivilDayPlanningInput {
  id: StableId;
  stationId: StableId;
  templateId: StableId;
  templateRevision: number;
  localDate: string;
  timezone: IanaTimezone;
  civilDayMinutes: typeof M4_CIVIL_DAY_MINUTES;
  dstTreatment: "civil_time_unresolved";
  slots: readonly M4ClockTemplateSlot[];
  summary: {
    slotCount: number;
    totalLocalMinutes: typeof M4_CIVIL_DAY_MINUTES;
    ordering: "local_start_minute_ascending";
    execution: "unavailable";
  };
}

/**
 * M4.3's local-only civil-day model. It snapshots templates and derives no
 * instant, wall-clock command, schedule, queue, asset, or runtime effect.
 */
export class M4ClockTemplateBoundary {
  private readonly templates = new Map<string, M4ClockTemplate>();

  public constructor(templates: readonly M4ClockTemplate[]) {
    for (const template of templates) this.add(template);
  }

  /**
   * Produces a deterministic local civil-day input. DST transition dates use
   * the same 1,440-minute template and deliberately remain unresolved to a
   * runtime instant; a later milestone must own any runtime-time conversion.
   */
  prepareDayInput(
    stationId: StableId,
    templateId: StableId,
    localDate: string,
  ): M4CivilDayPlanningInput {
    const template = this.templates.get(scopedKey(stationId, templateId));
    if (!template) throw new Error("not_found");
    validateLocalDate(localDate);
    return Object.freeze({
      id: `civil-day:${template.id}:${localDate}`,
      stationId,
      templateId: template.id,
      templateRevision: template.revision,
      localDate,
      timezone: template.timezone,
      civilDayMinutes: M4_CIVIL_DAY_MINUTES,
      dstTreatment: "civil_time_unresolved",
      slots: template.slots,
      summary: Object.freeze({
        slotCount: template.slots.length,
        totalLocalMinutes: M4_CIVIL_DAY_MINUTES,
        ordering: "local_start_minute_ascending",
        execution: "unavailable",
      }),
    });
  }

  /** Trusted internal callers must keep a template within its station scope. */
  assertTemplateOwnership(
    stationId: StableId,
    template: M4ClockTemplate,
  ): void {
    if (template.stationId !== stationId)
      throw new Error("station_reference_forbidden");
    validateTemplate(template);
  }

  private add(template: M4ClockTemplate): void {
    validateTemplate(template);
    const key = scopedKey(template.stationId, template.id);
    if (this.templates.has(key)) throw new Error("duplicate_clock_template");
    const orderedSlots = Object.freeze(
      template.slots
        .map((slot) => Object.freeze({ ...slot }))
        .sort(
          (left, right) =>
            left.localStartMinute - right.localStartMinute ||
            left.id.localeCompare(right.id),
        ),
    );
    this.templates.set(
      key,
      Object.freeze({ ...template, slots: orderedSlots }),
    );
  }
}

function validateTemplate(template: M4ClockTemplate): void {
  validateOpaqueReference(template.id);
  validateOpaqueReference(template.stationId);
  validateTimezone(template.timezone);
  if (!Number.isInteger(template.revision) || template.revision < 1)
    throw new Error("invalid_clock_template_revision");
  if (!template.slots.length) throw new Error("clock_template_slots_required");

  const slots = [...template.slots].sort(
    (left, right) =>
      left.localStartMinute - right.localStartMinute ||
      left.id.localeCompare(right.id),
  );
  let nextLocalMinute = 0;
  for (const slot of slots) {
    validateOpaqueReference(slot.id);
    if (
      !Number.isInteger(slot.localStartMinute) ||
      !Number.isInteger(slot.durationMinutes) ||
      slot.localStartMinute !== nextLocalMinute ||
      slot.durationMinutes < 1 ||
      slot.localStartMinute + slot.durationMinutes > M4_CIVIL_DAY_MINUTES
    )
      throw new Error("invalid_clock_template_slots");
    nextLocalMinute += slot.durationMinutes;
  }
  if (nextLocalMinute !== M4_CIVIL_DAY_MINUTES)
    throw new Error("invalid_clock_template_slots");
}

function validateTimezone(timezone: IanaTimezone): void {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new Error("invalid_timezone");
  }
}

function validateLocalDate(localDate: string): void {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) throw new Error("invalid_local_date");
  const year = Number(match[1]!);
  const month = Number(match[2]!);
  const day = Number(match[3]!);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    throw new Error("invalid_local_date");
}

function scopedKey(stationId: StableId, id: StableId): string {
  return `${stationId}\u0000${id}`;
}
