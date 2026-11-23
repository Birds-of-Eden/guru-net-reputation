// lib/posting-cycle.ts  (pure helpers - safe for client components)
// Posting cycle (every month / alternate months / every N months) for site assets.
//
// Stored WITHOUT a schema change, in existing spare columns:
//   TemplateSiteAsset.templatesiteasset_field_03                     -> interval (months)
//   TemplateSiteAsset.templatesiteasset_field_04                     -> start offset (months)
//   AssignmentSiteAssetSetting.assignmentsiteassetsetting_field_03   -> per-client interval override
//   AssignmentSiteAssetSetting.assignmentsiteassetsetting_field_04   -> per-client offset override
//
// interval: null/0/1 = every month (legacy behaviour), 2 = alternate months, 3 = every 3rd month
// offset:   0 = start in the package's 1st month, 1 = start in the 2nd month, ...
//
// "Posts/Month" (defaultPostingFrequency / requiredFrequency) stays the number of
// posts in each ACTIVE month.

export const POSTING_INTERVAL_FIELD = "templatesiteasset_field_03" as const;
export const POSTING_OFFSET_FIELD = "templatesiteasset_field_04" as const;
export const SETTING_INTERVAL_FIELD = "assignmentsiteassetsetting_field_03" as const;
export const SETTING_OFFSET_FIELD = "assignmentsiteassetsetting_field_04" as const;

export const MAX_POSTING_INTERVAL = 12;

export type PostingCycle = { interval: number; offset: number };

export const EVERY_MONTH: PostingCycle = { interval: 1, offset: 0 };

export const POSTING_INTERVAL_OPTIONS = [
  { value: 1, label: "Every month" },
  { value: 2, label: "Alternate months" },
  { value: 3, label: "Every 3 months" },
] as const;

/** Clamp raw DB/UI values into a valid cycle. */
export function normalizePostingCycle(
  interval: unknown,
  offset: unknown
): PostingCycle {
  const i = Math.floor(Number(interval));
  const safeInterval =
    Number.isFinite(i) && i >= 1 ? Math.min(i, MAX_POSTING_INTERVAL) : 1;
  const o = Math.floor(Number(offset));
  const safeOffset =
    Number.isFinite(o) && o >= 0 ? Math.min(o, safeInterval - 1) : 0;
  return { interval: safeInterval, offset: safeOffset };
}

export function isEveryMonth(cycle: PostingCycle | undefined | null) {
  return !cycle || (cycle.interval <= 1 && cycle.offset === 0);
}

/** Prefer a per-assignment override, else the template asset's own cycle. */
export function resolvePostingCycle(
  asset?: Record<string, any> | null,
  setting?: Record<string, any> | null
): PostingCycle {
  const sInterval = setting?.[SETTING_INTERVAL_FIELD];
  if (sInterval !== null && sInterval !== undefined) {
    return normalizePostingCycle(sInterval, setting?.[SETTING_OFFSET_FIELD]);
  }
  return normalizePostingCycle(
    asset?.[POSTING_INTERVAL_FIELD],
    asset?.[POSTING_OFFSET_FIELD]
  );
}

/** Data to write onto a TemplateSiteAsset create/update. */
export function postingCycleToAssetData(cycle: Partial<PostingCycle> | null | undefined) {
  const c = normalizePostingCycle(cycle?.interval, cycle?.offset);
  return {
    [POSTING_INTERVAL_FIELD]: c.interval > 1 ? c.interval : null,
    [POSTING_OFFSET_FIELD]: c.interval > 1 ? c.offset : null,
  } as {
    templatesiteasset_field_03: number | null;
    templatesiteasset_field_04: number | null;
  };
}

/**
 * Cycle from an API payload. Accepts the UI fields (postingInterval /
 * postingStartOffset) and falls back to raw stored columns, so saving a raw
 * row back never silently resets the cycle to "every month".
 */
export function postingCycleFromInput(asset: Record<string, any> | null | undefined) {
  const interval = asset?.postingInterval ?? asset?.[POSTING_INTERVAL_FIELD];
  const offset = asset?.postingStartOffset ?? asset?.[POSTING_OFFSET_FIELD];
  return postingCycleToAssetData({ interval, offset });
}

/** Copy the cycle columns from one TemplateSiteAsset row to another (duplicate/clone). */
export function copyPostingCycleFields(src: Record<string, any> | null | undefined) {
  return {
    [POSTING_INTERVAL_FIELD]: src?.[POSTING_INTERVAL_FIELD] ?? null,
    [POSTING_OFFSET_FIELD]: src?.[POSTING_OFFSET_FIELD] ?? null,
  } as {
    templatesiteasset_field_03: number | null;
    templatesiteasset_field_04: number | null;
  };
}

/** How many months inside the package are "active" for this cycle. */
export function activeMonthCount(totalMonths: number, cycle: PostingCycle = EVERY_MONTH) {
  const months = Math.max(0, Math.floor(Number(totalMonths) || 0));
  const { interval, offset } = normalizePostingCycle(cycle.interval, cycle.offset);
  if (months <= offset) return 0;
  return Math.ceil((months - offset) / interval);
}

/** Total posting tasks over the package: posts/month x active months. */
export function totalPostingCopies(
  freqPerMonth: number,
  totalMonths: number,
  cycle: PostingCycle = EVERY_MONTH
) {
  const freq = Math.max(0, Math.floor(Number(freqPerMonth) || 0));
  return freq * activeMonthCount(totalMonths, cycle);
}

/** Is the 0-based package month active for this cycle? */
export function isActiveMonth(monthIndex: number, cycle: PostingCycle = EVERY_MONTH) {
  const { interval, offset } = normalizePostingCycle(cycle.interval, cycle.offset);
  const m = Math.floor(monthIndex);
  return m >= offset && (m - offset) % interval === 0;
}

/** 0-based calendar-month distance between the campaign start and a date. */
export function calendarMonthIndex(start: Date, date: Date) {
  return (
    (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth())
  );
}

/** 0-based package month in which the n-th (1-based) task falls. */
export function packageMonthOfCycle(
  cycleNumber: number,
  freqPerMonth: number,
  cycle: PostingCycle = EVERY_MONTH
) {
  const freq = Math.max(1, Math.floor(Number(freqPerMonth) || 1));
  const n = Math.max(1, Math.floor(cycleNumber));
  const { interval, offset } = normalizePostingCycle(cycle.interval, cycle.offset);
  return offset + Math.floor((n - 1) / freq) * interval;
}

/**
 * Maps the n-th task onto the equivalent slot of an "every month" timeline,
 * so each route's existing due-date function can be reused unchanged:
 *   dueDate(virtualCycleNumber(n, freq, cycle))
 * Every-month cycles return n unchanged (legacy behaviour).
 *
 * Example: freq 4, alternate months -> tasks 1-4 => slots 1-4 (month 1),
 * tasks 5-8 => slots 9-12 (month 3), tasks 9-12 => slots 17-20 (month 5).
 */
export function virtualCycleNumber(
  cycleNumber: number,
  freqPerMonth: number,
  cycle: PostingCycle = EVERY_MONTH
) {
  const n = Math.max(1, Math.floor(cycleNumber));
  if (isEveryMonth(cycle)) return n;
  const freq = Math.max(1, Math.floor(Number(freqPerMonth) || 1));
  const month = packageMonthOfCycle(n, freq, cycle);
  const pos = (n - 1) % freq;
  return month * freq + pos + 1;
}

/** Dropdown options for the template UI. Value format: "interval:offset". */
export const CYCLE_SELECT_OPTIONS = [
  { value: "1:0", label: "Every month" },
  { value: "2:0", label: "Alternate (1st, 3rd, 5th…)" },
  { value: "2:1", label: "Alternate (2nd, 4th, 6th…)" },
  { value: "3:0", label: "Every 3 months" },
] as const;

export function cycleSelectValue(site: { postingInterval?: number | null; postingStartOffset?: number | null }) {
  const c = normalizePostingCycle(site.postingInterval, site.postingStartOffset);
  const v = `${c.interval}:${c.offset}`;
  return CYCLE_SELECT_OPTIONS.some((o) => o.value === v) ? v : "1:0";
}

/** Short label for UI, e.g. "Alternate months" or "Every 3 months (from month 2)". */
export function postingCycleLabel(cycle: PostingCycle | null | undefined) {
  const c = normalizePostingCycle(cycle?.interval, cycle?.offset);
  const base =
    c.interval === 1
      ? "Every month"
      : c.interval === 2
      ? "Alternate months"
      : `Every ${c.interval} months`;
  return c.offset > 0 ? `${base} (from month ${c.offset + 1})` : base;
}

