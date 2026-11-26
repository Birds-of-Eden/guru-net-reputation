// lib/audit/diff.ts
// Isomorphic (server + browser) deep diff used by the activity log.
//
// Produces a flat list of human-readable changes:
//   { path: ["otherField", "Sheet 2", "Row 4", "Email"], kind: "changed", before: "a", after: "b" }
//
// - Objects are compared key by key
// - Arrays of objects that carry an `id` are matched by id (so re-ordering or
//   inserting a sheet is reported as one "added"/"removed", not N shifts)
// - Spreadsheet sheets ({ columns, rows }) are diffed cell by cell, labelled
//   with the sheet name, row number and column name

export type ChangeKind = "added" | "removed" | "changed";

export type Change = {
  path: string[];
  kind: ChangeKind;
  before?: unknown;
  after?: unknown;
};

export type DiffOptions = {
  /** Stop after this many changes (the rest are counted in `truncated`). */
  maxChanges?: number;
  /** Max characters kept for any single string value. */
  maxString?: number;
  /** Top-level keys to ignore. */
  ignoreKeys?: string[];
};

export type DiffResult = { changes: Change[]; truncated: number };

const isObj = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date);

const isSheet = (v: unknown): v is { name?: string; columns: any[]; rows: any[][] } =>
  isObj(v) && Array.isArray(v.columns) && Array.isArray(v.rows);

const hasId = (v: unknown) =>
  isObj(v) && (typeof v.id === "string" || typeof v.id === "number");

const labelOf = (v: any, fallback: string) => {
  if (!isObj(v)) return fallback;
  const l = v.name ?? v.title ?? v.label ?? v.platform ?? v.email;
  return typeof l === "string" && l.trim() ? l.trim() : fallback;
};

export function clip(v: unknown, max = 2000): unknown {
  if (typeof v === "string" && v.length > max) {
    return `${v.slice(0, max)}… (+${v.length - max} chars)`;
  }
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  return v;
}

/** JSON-safe deep copy with long strings clipped. */
export function snapshot(v: unknown, max = 2000, depth = 0): unknown {
  if (depth > 12) return "[…]";
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "string") return clip(v, max);
  if (Array.isArray(v)) return v.map((x) => snapshot(x, max, depth + 1));
  if (isObj(v)) {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = snapshot(x, max, depth + 1);
    return out;
  }
  return v;
}

const norm = (v: unknown) => {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  return v;
};

const same = (a: unknown, b: unknown) => {
  const x = norm(a);
  const y = norm(b);
  if (x === y) return true;
  if (typeof x !== "object" || typeof y !== "object" || !x || !y) return false;
  try {
    return JSON.stringify(x) === JSON.stringify(y);
  } catch {
    return false;
  }
};

export function deepDiff(before: unknown, after: unknown, opts: DiffOptions = {}): DiffResult {
  const max = opts.maxChanges ?? 300;
  const maxString = opts.maxString ?? 2000;
  const ignore = new Set(opts.ignoreKeys ?? []);
  const changes: Change[] = [];
  let truncated = 0;

  const push = (c: Change) => {
    if (changes.length >= max) {
      truncated++;
      return;
    }
    changes.push({
      path: c.path,
      kind: c.kind,
      ...(c.kind !== "added" ? { before: snapshot(c.before, maxString) } : {}),
      ...(c.kind !== "removed" ? { after: snapshot(c.after, maxString) } : {}),
    });
  };

  const walk = (a: unknown, b: unknown, path: string[], depth: number) => {
    if (same(a, b)) return;
    const aNull = a === null || a === undefined;
    const bNull = b === null || b === undefined;

    if (depth > 10) return push({ path, kind: "changed", before: a, after: b });

    if (isSheet(a) && isSheet(b)) return walkSheet(a, b, path, depth);

    if (Array.isArray(a) && Array.isArray(b)) {
      // Primitive arrays (tags, websites…) → report as one value change
      if ([...a, ...b].every((x) => !x || typeof x !== "object")) {
        return push({ path, kind: "changed", before: a, after: b });
      }
      // Items with an id are matched by id; the rest (if any) by position
      if ([...a, ...b].some(hasId)) {
        const am = new Map(a.filter(hasId).map((x: any) => [String(x.id), x]));
        const bm = new Map(b.filter(hasId).map((x: any) => [String(x.id), x]));
        for (const [id, x] of am) {
          if (!bm.has(id)) push({ path: [...path, labelOf(x, id)], kind: "removed", before: x });
        }
        for (const [id, y] of bm) {
          const x = am.get(id);
          const label = labelOf(y, id);
          if (!x) push({ path: [...path, label], kind: "added", after: y });
          else walk(x, y, [...path, label], depth + 1);
        }
        const ra = a.filter((x) => !hasId(x));
        const rb = b.filter((x) => !hasId(x));
        if (ra.length || rb.length) walk(ra, rb, path, depth + 1);
        return;
      }
      const n = Math.max(a.length, b.length);
      for (let i = 0; i < n; i++) {
        const label = i < b.length ? labelOf(b[i], `#${i + 1}`) : labelOf(a[i], `#${i + 1}`);
        if (i >= a.length) push({ path: [...path, label], kind: "added", after: b[i] });
        else if (i >= b.length) push({ path: [...path, label], kind: "removed", before: a[i] });
        else walk(a[i], b[i], [...path, label], depth + 1);
      }
      return;
    }

    if (isObj(a) && isObj(b)) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of keys) {
        if (depth === 0 && ignore.has(k)) continue;
        walk(a[k], b[k], [...path, k], depth + 1);
      }
      return;
    }

    if (aNull && !bNull) return push({ path, kind: "added", after: b });
    if (!aNull && bNull) return push({ path, kind: "removed", before: a });
    push({ path, kind: "changed", before: a, after: b });
  };

  const walkSheet = (a: any, b: any, path: string[], depth: number) => {
    const p = path.length && path[path.length - 1] ? path : [...path, b.name || "Sheet"];
    if ((a.name || "") !== (b.name || "")) {
      push({ path: [...p, "(sheet name)"], kind: "changed", before: a.name, after: b.name });
    }
    if (!same(a.columns, b.columns)) {
      const n = Math.max(a.columns.length, b.columns.length);
      for (let c = 0; c < n; c++) {
        const x = a.columns[c];
        const y = b.columns[c];
        if (same(x, y)) continue;
        const label = `Column ${c + 1}`;
        if (x === undefined) push({ path: [...p, label], kind: "added", after: y });
        else if (y === undefined) push({ path: [...p, label], kind: "removed", before: x });
        else push({ path: [...p, `${label} (header)`], kind: "changed", before: x, after: y });
      }
    }
    const rows = Math.max(a.rows.length, b.rows.length);
    for (let r = 0; r < rows; r++) {
      const ra: any[] | undefined = a.rows[r];
      const rb: any[] | undefined = b.rows[r];
      if (same(ra, rb)) continue;
      const rowLabel = `Row ${r + 1}`;
      const filled = (row?: any[]) => (row ?? []).some((c) => String(c ?? "").trim());
      if (!ra) {
        if (filled(rb)) push({ path: [...p, rowLabel], kind: "added", after: rowObject(b.columns, rb!) });
        else push({ path: [...p, rowLabel], kind: "added", after: "(empty row)" });
        continue;
      }
      if (!rb) {
        if (filled(ra)) push({ path: [...p, rowLabel], kind: "removed", before: rowObject(a.columns, ra) });
        else push({ path: [...p, rowLabel], kind: "removed", before: "(empty row)" });
        continue;
      }
      const cols = Math.max(ra.length, rb.length);
      for (let c = 0; c < cols; c++) {
        const x = String(ra[c] ?? "");
        const y = String(rb[c] ?? "");
        if (x === y) continue;
        const col = String(b.columns[c] ?? a.columns[c] ?? `Column ${c + 1}`);
        const cellPath = [...p, rowLabel, col];
        if (!x) push({ path: cellPath, kind: "added", after: y });
        else if (!y) push({ path: cellPath, kind: "removed", before: x });
        else push({ path: cellPath, kind: "changed", before: x, after: y });
      }
    }
    // colWidths are layout only — ignored on purpose
    void depth;
  };

  walk(before, after, [], 0);
  return { changes, truncated };
}

function rowObject(columns: any[], row: any[]) {
  const out: Record<string, string> = {};
  row.forEach((cell, i) => {
    if (String(cell ?? "").trim()) out[String(columns[i] ?? `Column ${i + 1}`)] = String(cell);
  });
  return out;
}

/** "Sheet 2 › Row 4 › Email" */
export const pathLabel = (path: string[]) => path.join(" › ");
