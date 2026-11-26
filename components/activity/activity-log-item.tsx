// components/activity/activity-log-item.tsx
"use client";

import { useState } from "react";
import {
  ChevronDown,
  Copy,
  Check,
  Globe,
  History,
  Monitor,
  Minus,
  Plus,
  ArrowRight,
  UserCog,
  Bot,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pathLabel } from "@/lib/audit/diff";
import {
  type ActivityLog,
  TONE_CLASSES,
  avatarColor,
  changesOf,
  entityName,
  formatFull,
  formatRelative,
  formatTime,
  formatValue,
  initials,
  isStructured,
  pagePath,
  parseBrowser,
  toneFor,
  verbFor,
} from "./activity-format";

type Props = {
  log: ActivityLog;
  onViewHistory: (entityType: string, entityId: string, label: string | null) => void;
  onFilterUser: (userId: string) => void;
};

export function ActivityLogItem({ log, onViewHistory, onFilterUser }: Props) {
  const [open, setOpen] = useState(false);
  const tone = TONE_CLASSES[toneFor(log.action)];
  const structured = isStructured(log);
  const changes = changesOf(log);
  const actor = log.user;
  const d = log.details ?? {};
  const impersonatedBy: string | null = d.actor?.impersonatedBy ?? null;
  const isSystem = !actor;
  const fields: string[] = structured && Array.isArray(d.changedFields) ? d.changedFields : [];
  const label = log.label;
  const entity = entityName(log.entityType);
  const canHistory = log.entityId && log.entityId !== "bulk" && log.entityType !== "auth";

  return (
    <li className="group relative">
      <div
        className={cn(
          "relative flex gap-3 rounded-xl border bg-card px-4 py-3 transition-colors",
          open ? "border-primary/30 shadow-sm" : "border-border hover:border-foreground/15 hover:bg-muted/30",
        )}
      >
        {/* Avatar */}
        <button
          type="button"
          onClick={() => actor && onFilterUser(actor.id)}
          title={actor ? `Show only ${actor.name || actor.email}'s activity` : "System"}
          className={cn(
            "relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-white",
            isSystem ? "bg-slate-400 dark:bg-slate-600" : avatarColor(actor!.id),
          )}
        >
          {actor?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={actor.image} alt="" className="h-full w-full object-cover" />
          ) : isSystem ? (
            <Bot className="h-4 w-4" />
          ) : (
            initials(actor!.name, actor!.email)
          )}
          <span className={cn("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card", tone.dot)} />
        </button>

        {/* Body */}
        <button type="button" onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <p className="text-sm leading-6 text-foreground">
            <span className="font-semibold">{actor?.name || actor?.email || "System"}</span>{" "}
            <span className="text-muted-foreground">{verbFor(log.action)}</span>{" "}
            {entity && <span className="text-muted-foreground">{entity}</span>}{" "}
            {label && <span className="font-medium">“{label}”</span>}
            {d.bulk && (
              <span className="text-muted-foreground"> · {d.bulk.count} records</span>
            )}
          </p>

          {fields.length > 0 && log.action !== "create" && (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {fields.slice(0, 5).map((f) => (
                <span key={f} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {f}
                </span>
              ))}
              {fields.length > 5 && <span className="text-[11px] text-muted-foreground">+{fields.length - 5} more</span>}
            </div>
          )}
          {!structured && log.summary && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{log.summary}</p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span title={formatFull(log.timestamp)}>{formatTime(log.timestamp)}</span>
            {actor?.role?.name && <span className="capitalize">{actor.role.name.replace(/_/g, " ")}</span>}
            {log.changeCount > 0 && log.action !== "create" && (
              <span>
                {log.changeCount} change{log.changeCount === 1 ? "" : "s"}
              </span>
            )}
            {impersonatedBy && (
              <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-300">
                <UserCog className="h-3 w-3" /> via impersonation
              </span>
            )}
          </div>
        </button>

        {/* Right */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", tone.badge)}>
            {log.action.replace(/_/g, " ")}
          </span>
          <span className="text-[11px] text-muted-foreground" title={formatFull(log.timestamp)}>
            {formatRelative(log.timestamp)}
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-md p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>

      {open && (
        <ActivityDetails
          log={log}
          changes={changes}
          canHistory={!!canHistory}
          onViewHistory={() => onViewHistory(log.entityType, log.entityId, label)}
        />
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------

function ActivityDetails({
  log,
  changes,
  canHistory,
  onViewHistory,
}: {
  log: ActivityLog;
  changes: ReturnType<typeof changesOf>;
  canHistory: boolean;
  onViewHistory: () => void;
}) {
  const d = log.details ?? {};
  const structured = isStructured(log);
  const snapshotRecord = structured ? d.after ?? d.before ?? null : null;
  const tabs = [
    ...(changes.length ? [{ id: "changes", label: `Changes (${changes.length})` }] : []),
    ...(snapshotRecord ? [{ id: "record", label: log.action === "delete" ? "Deleted record" : "Record" }] : []),
    ...(!structured && log.details ? [{ id: "details", label: "Details" }] : []),
    ...(structured && d.extra ? [{ id: "details", label: "Details" }] : []),
    { id: "context", label: "Who & where" },
    { id: "raw", label: "Raw" },
  ];
  const [tab, setTab] = useState(tabs[0].id);

  return (
    <div className="mx-2 -mt-1 rounded-b-xl border border-t-0 border-primary/20 bg-muted/20 px-4 pb-4 pt-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {canHistory && (
          <button
            type="button"
            onClick={onViewHistory}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
          >
            <History className="h-3.5 w-3.5" /> Full history of this record
          </button>
        )}
      </div>

      {tab === "changes" && <ChangeTable changes={changes} truncated={d.truncated} />}
      {tab === "record" && snapshotRecord && <RecordGrid record={snapshotRecord} />}
      {tab === "details" && <DetailsGrid details={structured ? d.extra : log.details} />}
      {tab === "context" && <ContextGrid log={log} />}
      {tab === "raw" && (
        <pre className="max-h-96 overflow-auto rounded-lg border bg-background p-3 text-[11px] leading-relaxed">
          {JSON.stringify(log.details, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ChangeTable({ changes, truncated }: { changes: ReturnType<typeof changesOf>; truncated?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="hidden grid-cols-[minmax(140px,1fr)_minmax(0,1.4fr)_20px_minmax(0,1.4fr)] gap-3 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:grid">
        <span>Field</span>
        <span>Before</span>
        <span />
        <span>After</span>
      </div>
      <ul className="divide-y">
        {changes.map((c, i) => (
          <li
            key={i}
            className="grid grid-cols-1 gap-1.5 px-3 py-2.5 text-xs md:grid-cols-[minmax(140px,1fr)_minmax(0,1.4fr)_20px_minmax(0,1.4fr)] md:gap-3"
          >
            <div className="flex items-start gap-1.5">
              <KindIcon kind={c.kind} />
              <span className="break-words font-mono text-[11px] text-foreground">{pathLabel(c.path)}</span>
            </div>
            <ValueCell value={c.before} label={c.beforeLabel} variant="before" hidden={c.kind === "added"} />
            <ArrowRight className="hidden h-3.5 w-3.5 self-center text-muted-foreground md:block" />
            <ValueCell value={c.after} label={c.afterLabel} variant="after" hidden={c.kind === "removed"} />
          </li>
        ))}
      </ul>
      {!!truncated && (
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          +{truncated} more changes not shown (see Raw)
        </p>
      )}
    </div>
  );
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "added")
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" title="Added">
        <Plus className="h-3 w-3" />
      </span>
    );
  if (kind === "removed")
    return (
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-rose-500/15 text-rose-600 dark:text-rose-400" title="Removed">
        <Minus className="h-3 w-3" />
      </span>
    );
  return <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500 ml-1 mr-1" title="Changed" />;
}

function ValueCell({
  value,
  label,
  variant,
  hidden,
}: {
  value: unknown;
  label?: string;
  variant: "before" | "after";
  hidden?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (hidden) return <span className="hidden text-muted-foreground md:block">—</span>;
  const f = formatValue(value);
  const long = f.text.length > 220;
  const shown = long && !expanded ? `${f.text.slice(0, 220)}…` : f.text;
  return (
    <div
      className={cn(
        "min-w-0 rounded-md px-2 py-1",
        variant === "before"
          ? "bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-200"
          : "bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200",
        f.empty && "bg-transparent italic text-muted-foreground dark:bg-transparent dark:text-muted-foreground",
      )}
    >
      <span className="mr-1 text-[10px] font-semibold uppercase text-muted-foreground md:hidden">{variant}:</span>
      {label && <span className="font-medium">{label} </span>}
      <span className={cn(f.multiline ? "whitespace-pre-wrap" : "", "break-words", label && "text-muted-foreground")}>
        {label ? `(${shown})` : shown}
      </span>
      {long && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="ml-1 text-[11px] font-medium text-primary hover:underline">
          {expanded ? "less" : "more"}
        </button>
      )}
    </div>
  );
}

function RecordGrid({ record }: { record: Record<string, unknown> }) {
  const entries = Object.entries(record).filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length));
  return (
    <dl className="grid grid-cols-1 overflow-hidden rounded-lg border bg-background sm:grid-cols-[minmax(140px,220px)_1fr]">
      {entries.map(([k, v]) => {
        const f = formatValue(v);
        return (
          <div key={k} className="contents">
            <dt className="border-b bg-muted/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">{k}</dt>
            <dd className={cn("border-b px-3 py-2 text-xs break-words", f.multiline && "max-h-48 overflow-auto whitespace-pre-wrap")}>{f.text}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function DetailsGrid({ details }: { details: any }) {
  if (!details || typeof details !== "object") {
    return <p className="text-xs text-muted-foreground">{String(details ?? "No details")}</p>;
  }
  return <RecordGrid record={details} />;
}

function ContextGrid({ log }: { log: ActivityLog }) {
  const d = log.details ?? {};
  const req = d.request ?? {};
  const rows: [string, React.ReactNode][] = [
    ["When", formatFull(log.timestamp)],
    ["Who", log.user ? `${log.user.name ?? ""} ${log.user.email ? `<${log.user.email}>` : ""}`.trim() : "System (no signed-in user)"],
    ...(log.user?.role?.name ? [["Role", log.user.role.name] as [string, React.ReactNode]] : []),
    ...(d.actor?.impersonatedBy ? [["Impersonated by", <CopyText key="imp" text={d.actor.impersonatedBy} />] as [string, React.ReactNode]] : []),
    ...(req.page
      ? [[
          "Page",
          <a key="p" href={req.page} className="inline-flex items-center gap-1 text-primary hover:underline" target="_blank" rel="noreferrer">
            <Link2 className="h-3 w-3" />
            {pagePath(req.page)}
          </a>,
        ] as [string, React.ReactNode]]
      : []),
    ...(req.ip ? [["IP address", <span key="ip" className="inline-flex items-center gap-1"><Globe className="h-3 w-3" />{req.ip}</span>] as [string, React.ReactNode]] : []),
    ...(req.userAgent
      ? [["Device", <span key="ua" className="inline-flex items-center gap-1" title={req.userAgent}><Monitor className="h-3 w-3" />{parseBrowser(req.userAgent)}</span>] as [string, React.ReactNode]]
      : []),
    ["Entity", `${log.entityType}`],
    ["Entity ID", <CopyText key="eid" text={log.entityId} />],
    ...(d.operation ? [["Operation", <code key="op" className="font-mono">{d.operation}</code>] as [string, React.ReactNode]] : []),
    ["Log ID", <CopyText key="lid" text={log.id} />],
  ];
  return (
    <dl className="grid grid-cols-1 overflow-hidden rounded-lg border bg-background sm:grid-cols-[160px_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="border-b bg-muted/30 px-3 py-2 text-[11px] font-medium text-muted-foreground">{k}</dt>
          <dd className="border-b px-3 py-2 text-xs break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function CopyText({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      <code className="font-mono text-[11px]">{text}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(text).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1200);
          });
        }}
        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Copy"
      >
        {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}
