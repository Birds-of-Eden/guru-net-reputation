// lib/audit/client.ts
// Browser-side activity tracking for edits that are not (yet) saved to the
// database — e.g. the onboarding spreadsheet draft. Changes are buffered,
// consecutive edits of the same cell are merged ("a" → "ab" → "abc" becomes
// one change "a" → "abc"), and flushed to POST /api/activity in batches.

import { pathLabel, type Change } from "./diff";

type BufferOptions = {
  entityType: string;
  /** Called at flush time so ids/labels can change while the user types. */
  getEntity: () => { entityId: string; label?: string | null };
  action: string;
  /** e.g. "Edited onboarding sheet" → "Edited onboarding sheet · 3 changes" */
  summary: string;
  debounceMs?: number;
};

export function createActivityBuffer(opts: BufferOptions) {
  const debounceMs = opts.debounceMs ?? 4000;
  let pending: Change[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const payload = () => {
    const { entityId, label } = opts.getEntity();
    const changes = pending;
    pending = [];
    const sheets = Array.from(new Set(changes.map((c) => c.path[0]).filter(Boolean)));
    return {
      entityType: opts.entityType,
      entityId,
      action: opts.action,
      label: label ?? null,
      summary:
        `${opts.summary}${label ? ` "${label}"` : ""} · ${changes.length} change${changes.length === 1 ? "" : "s"}` +
        (sheets.length ? ` (${sheets.slice(0, 3).join(", ")}${sheets.length > 3 ? ` +${sheets.length - 3}` : ""})` : ""),
      changes,
    };
  };

  const flush = (useBeacon = false) => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (!pending.length) return;
    const body = JSON.stringify(payload());
    try {
      if (useBeacon && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        if (navigator.sendBeacon("/api/activity", new Blob([body], { type: "application/json" }))) return;
      }
      void fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {}
  };

  const add = (changes: Change[]) => {
    if (!changes.length) return;
    for (const c of changes) {
      const key = pathLabel(c.path);
      const prev = pending.findIndex((p) => pathLabel(p.path) === key);
      if (prev === -1) {
        pending.push(c);
        continue;
      }
      // Merge with the earlier edit of the same cell/field
      const first = pending[prev];
      const before = first.kind === "added" ? undefined : first.before;
      const after = c.kind === "removed" ? undefined : c.after;
      pending.splice(prev, 1);
      if (before === undefined && after === undefined) continue; // added then removed
      if (before !== undefined && after !== undefined && JSON.stringify(before) === JSON.stringify(after)) continue; // reverted
      pending.push({
        path: c.path,
        kind: before === undefined ? "added" : after === undefined ? "removed" : "changed",
        ...(before !== undefined ? { before } : {}),
        ...(after !== undefined ? { after } : {}),
      });
    }
    if (pending.length >= 200) return flush();
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => flush(), debounceMs);
  };

  return { add, flush };
}
