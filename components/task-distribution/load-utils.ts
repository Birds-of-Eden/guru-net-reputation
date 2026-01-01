type StatusMap = Record<string, number | string> | Map<string, number | string>;

type LoadSource = {
  byStatus?: StatusMap | null;
  activeCount?: number | string | null;
  weightedScore?: number | string | null;
  active?: number | string | null;
  weighted?: number | string | null;
  load?: {
    byStatus?: StatusMap | null;
    activeCount?: number | string | null;
    weightedScore?: number | string | null;
    active?: number | string | null;
    weighted?: number | string | null;
  } | null;
};

type LoadStats = {
  P: number;
  IP: number;
  O: number;
  R: number;
  active: number;
  weighted: number;
};

const STATUS_KEYS = {
  pending: ["pending"],
  inProgress: ["in_progress", "inProgress", "in-progress", "in progress"],
  overdue: ["overdue"],
  reassigned: ["reassigned"],
} as const;

const normalizeKey = (key: string) =>
  key.toLowerCase().replace(/[\s-]+/g, "_");

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function readStatus(
  byStatus: StatusMap | null | undefined,
  keys: readonly string[]
) {
  if (!byStatus) return 0;

  if (byStatus instanceof Map) {
    for (const key of keys) {
      if (byStatus.has(key)) {
        return toNumber(byStatus.get(key));
      }
    }
    const normalizedTargets = keys.map(normalizeKey);
    for (const [key, value] of byStatus.entries()) {
      if (normalizedTargets.includes(normalizeKey(key))) {
        return toNumber(value);
      }
    }
    return 0;
  }

  for (const key of keys) {
    const value = (byStatus as Record<string, number | string>)[key];
    if (value !== undefined && value !== null) {
      return toNumber(value);
    }
  }

  const normalizedTargets = keys.map(normalizeKey);
  for (const [key, value] of Object.entries(byStatus)) {
    if (normalizedTargets.includes(normalizeKey(key))) {
      return toNumber(value);
    }
  }

  return 0;
}

export function getLoadStats(source: LoadSource): LoadStats {
  const byStatus = source?.byStatus ?? source?.load?.byStatus ?? undefined;

  const P = readStatus(byStatus, STATUS_KEYS.pending);
  const IP = readStatus(byStatus, STATUS_KEYS.inProgress);
  const O = readStatus(byStatus, STATUS_KEYS.overdue);
  const R = readStatus(byStatus, STATUS_KEYS.reassigned);

  const derivedActive = P + IP + O + R;
  const derivedWeighted = P * 1 + IP * 2 + O * 3 + R * 2;

  const rawActive = toNumber(
    source?.activeCount ??
      source?.load?.activeCount ??
      source?.load?.active ??
      source?.active
  );
  const rawWeighted = toNumber(
    source?.weightedScore ??
      source?.load?.weightedScore ??
      source?.load?.weighted ??
      source?.weighted
  );

  const active = rawActive > 0 || derivedActive === 0 ? rawActive : derivedActive;
  const weighted =
    rawWeighted > 0 || derivedWeighted === 0 ? rawWeighted : derivedWeighted;

  return { P, IP, O, R, active, weighted };
}
