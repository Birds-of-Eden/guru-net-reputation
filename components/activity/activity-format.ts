// components/activity/activity-format.ts
// Display helpers shared by the activity log screens.

import type { Change } from "@/lib/audit/diff";

export type ActivityUser = {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
  role?: { name: string } | null;
};

export type ActivityLog = {
  id: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  action: string;
  timestamp: string;
  details: any;
  summary: string;
  label: string | null;
  changeCount: number;
  user?: ActivityUser | null;
};

export const TZ = "Asia/Dhaka";

const ACTION_VERBS: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  sign_in: "signed in",
  sign_out: "signed out",
  onboarded: "onboarded",
  sheet_edit: "edited",
  task_assigned: "assigned",
  task_reassigned: "reassigned",
  task_status_update: "changed status of",
  qc_reassigned: "QC-reassigned",
  qc_approved: "QC-approved",
  impersonate_start: "started impersonating",
  impersonate_stop: "stopped impersonating",
};

export const verbFor = (action: string) => ACTION_VERBS[action] ?? action.replace(/_/g, " ");

const ENTITY_NAMES: Record<string, string> = {
  OnboardingDraft: "onboarding draft",
  auth: "",
  TemplateSiteAsset: "template site asset",
  AssignmentSiteAssetSetting: "asset setting",
  ClientTeamMember: "client team member",
  TemplateTeamMember: "template team member",
  RolePermission: "role permission",
  TaskCategory: "task category",
  AssetType: "asset type",
};

export const entityName = (t: string) =>
  t in ENTITY_NAMES ? ENTITY_NAMES[t] : t.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

export type Tone = "green" | "blue" | "red" | "amber" | "violet" | "slate" | "cyan";

export function toneFor(action: string): Tone {
  const a = action.toLowerCase();
  if (a === "create" || a === "onboarded" || a.includes("assigned") || a === "sign_in") return "green";
  if (a === "delete" || a.includes("cancel") || a === "sign_out") return "red";
  if (a.includes("overdue")) return "amber";
  if (a.startsWith("task_timer") || a.startsWith("impersonate")) return "violet";
  if (a.startsWith("qc")) return "cyan";
  if (a === "update" || a.includes("status") || a.includes("edit")) return "blue";
  return "slate";
}

export const TONE_CLASSES: Record<Tone, { badge: string; dot: string }> = {
  green: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20", dot: "bg-emerald-500" },
  blue: { badge: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-400/20", dot: "bg-blue-500" },
  red: { badge: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20", dot: "bg-rose-500" },
  amber: { badge: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20", dot: "bg-amber-500" },
  violet: { badge: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20", dot: "bg-violet-500" },
  cyan: { badge: "bg-cyan-50 text-cyan-700 ring-cyan-600/20 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-400/20", dot: "bg-cyan-500" },
  slate: { badge: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-400/20", dot: "bg-slate-400" },
};

export function formatRelative(iso: string) {
  const dt = new Date(iso);
  const sec = Math.max(0, Math.floor((Date.now() - dt.getTime()) / 1000));
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${Math.max(1, min)}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return dt.toLocaleDateString(undefined, { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
}

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { timeZone: TZ, hour: "numeric", minute: "2-digit" });

export const formatFull = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

export function dayLabel(iso: string) {
  const k = dayKey(iso);
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 864e5).toISOString());
  if (k === today) return "Today";
  if (k === yesterday) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function groupByDay(logs: ActivityLog[]) {
  const out: { key: string; label: string; logs: ActivityLog[] }[] = [];
  for (const l of logs) {
    const key = dayKey(l.timestamp);
    const last = out[out.length - 1];
    if (last?.key === key) last.logs.push(l);
    else out.push({ key, label: dayLabel(l.timestamp), logs: [l] });
  }
  return out;
}

export const initials = (name?: string | null, email?: string | null) => {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
};

const AVATAR_COLORS = [
  "bg-sky-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-teal-500", "bg-indigo-500", "bg-fuchsia-500",
];
export const avatarColor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

/** Structured (v2) logs carry `changes`; older ones only free-form details. */
export const isStructured = (log: ActivityLog) => log.details && typeof log.details === "object" && log.details.v === 2;

export const changesOf = (log: ActivityLog): (Change & { beforeLabel?: string; afterLabel?: string })[] =>
  isStructured(log) && Array.isArray(log.details.changes) ? log.details.changes : [];

export function parseBrowser(ua?: string | null) {
  if (!ua) return null;
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return os ? `${br} on ${os}` : br;
}

export const pagePath = (url?: string | null) => {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
};

export function formatValue(v: unknown): { text: string; multiline: boolean; empty: boolean } {
  if (v === null || v === undefined || v === "") return { text: "empty", multiline: false, empty: true };
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !Number.isNaN(Date.parse(v))) {
      return { text: formatFull(v), multiline: false, empty: false };
    }
    const clean = /<\/?[a-z][\s\S]*>/i.test(v) ? v.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : v;
    return { text: clean, multiline: clean.length > 80 || clean.includes("\n"), empty: false };
  }
  if (typeof v === "boolean") return { text: v ? "Yes" : "No", multiline: false, empty: false };
  if (typeof v === "number") return { text: String(v), multiline: false, empty: false };
  if (Array.isArray(v) && v.every((x) => typeof x !== "object" || x === null)) {
    return v.length ? { text: v.join(", "), multiline: v.join(", ").length > 80, empty: false } : { text: "empty list", multiline: false, empty: true };
  }
  return { text: JSON.stringify(v, null, 2), multiline: true, empty: false };
}
