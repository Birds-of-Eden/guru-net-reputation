// app/[role]/activity/page.tsx
"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  Activity,
  CalendarDays,
  Download,
  FilePlus2,
  FileX2,
  History,
  PencilLine,
  RefreshCw,
  Search,
  Users,
  X,
  Inbox,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { realtimeClient } from "@/lib/realtime/client";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActivityLogItem } from "@/components/activity/activity-log-item";
import { type ActivityLog, entityName, groupByDay } from "@/components/activity/activity-format";

type Facets = {
  entityTypes: { value: string; count: number }[];
  actions: { value: string; count: number }[];
  users: { id: string; name: string | null; email: string | null; count: number }[];
  stats: {
    total: number;
    today: number;
    todayCreates: number;
    todayUpdates: number;
    todayDeletes: number;
    todayActiveUsers: number;
  };
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new Error(data.error || data.message || "Failed to load");
  return data;
};

const RANGES = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "custom", label: "Custom" },
] as const;

function rangeToDates(range: string, from: string, to: string) {
  const now = new Date();
  if (range === "today") {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    return { from: s.toISOString(), to: "" };
  }
  if (range === "7d") return { from: new Date(now.getTime() - 7 * 864e5).toISOString(), to: "" };
  if (range === "30d") return { from: new Date(now.getTime() - 30 * 864e5).toISOString(), to: "" };
  if (range === "custom") {
    return {
      from: from ? new Date(`${from}T00:00:00`).toISOString() : "",
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : "",
    };
  }
  return { from: "", to: "" };
}

function ActivityPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // ---- filters live in the URL (shareable links, e.g. "history of this client") ----
  const get = (k: string, d = "") => sp.get(k) ?? d;
  const filters = {
    q: get("q"),
    action: get("action", "all"),
    entityType: get("entityType", "all"),
    entityId: get("entityId"),
    entityLabel: get("label"),
    userId: get("userId", "all"),
    source: get("source", "all"),
    range: get("range", "all"),
    from: get("from"),
    to: get("to"),
    page: Math.max(1, Number(get("page", "1")) || 1),
    limit: Number(get("limit", "25")) || 25,
  };

  const setParams = useCallback(
    (patch: Record<string, string | number | null>, resetPage = true) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "" || v === "all") next.delete(k);
        else next.set(k, String(v));
      }
      if (resetPage && !("page" in patch)) next.delete("page");
      router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false });
    },
    [sp, router, pathname],
  );

  // debounced search box
  const [search, setSearch] = useState(filters.q);
  useEffect(() => setSearch(filters.q), [filters.q]);
  useEffect(() => {
    if (search.trim() === filters.q) return;
    const t = setTimeout(() => setParams({ q: search.trim() }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(filters.page));
    p.set("limit", String(filters.limit));
    if (filters.q) p.set("q", filters.q);
    if (filters.action !== "all") p.set("action", filters.action);
    if (filters.entityType !== "all") p.set("entityType", filters.entityType);
    if (filters.entityId) p.set("entityId", filters.entityId);
    if (filters.userId !== "all") p.set("userId", filters.userId);
    if (filters.source !== "all") p.set("source", filters.source);
    const { from, to } = rangeToDates(filters.range, filters.from, filters.to);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.toString()]);

  const listUrl = `/api/activity?${query.toString()}`;
  const { data, error, isLoading, isValidating, mutate } = useSWR(listUrl, fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
  });
  const { data: facets, mutate: mutateFacets } = useSWR<Facets>("/api/activity?facets=1", fetcher, {
    revalidateOnFocus: false,
  });

  const logs: ActivityLog[] = data?.logs ?? [];
  const pagination = data?.pagination;

  // ---- realtime: auto-refresh on the first page, otherwise show a "new" banner ----
  const [newCount, setNewCount] = useState(0);
  const [live, setLive] = useState(false);
  const autoRefresh = filters.page === 1;
  useEffect(() => {
    const ch = realtimeClient.subscribe("activity");
    setLive(true);
    let t: ReturnType<typeof setTimeout> | null = null;
    const onNew = (payload: any) => {
      const n = Number(payload?.count) || 1;
      if (autoRefresh) {
        if (t) clearTimeout(t);
        t = setTimeout(() => {
          mutate();
          mutateFacets();
        }, 600);
      } else {
        setNewCount((c) => c + n);
      }
    };
    const onReconnected = () => {
      mutate();
      mutateFacets();
    };
    ch.bind("activity:new", onNew);
    ch.bind("realtime:reconnected", onReconnected);
    return () => {
      if (t) clearTimeout(t);
      ch.unbind("activity:new", onNew);
      ch.unbind("realtime:reconnected", onReconnected);
      realtimeClient.unsubscribe("activity");
      setLive(false);
    };
  }, [autoRefresh, mutate, mutateFacets]);
  useEffect(() => setNewCount(0), [listUrl]);

  const groups = useMemo(() => groupByDay(logs), [logs]);

  const activeFilterCount =
    [filters.q, filters.entityId].filter(Boolean).length +
    [filters.action, filters.entityType, filters.userId, filters.source, filters.range].filter((v) => v !== "all").length;

  const clearAll = () => {
    setSearch("");
    router.replace(pathname, { scroll: false });
  };

  const exportCsv = () => {
    const p = new URLSearchParams(query);
    p.delete("page");
    p.delete("limit");
    p.set("format", "csv");
    window.location.href = `/api/activity?${p.toString()}`;
  };

  const selectedUser = facets?.users.find((u) => u.id === filters.userId);
  const stats = facets?.stats;

  return (
    <div className="mx-auto w-full space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Activity Log</h1>
              <p className="text-sm text-muted-foreground">
                Every change across the system — who did it, when, and exactly what changed.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              live ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", live ? "animate-pulse bg-emerald-500" : "bg-muted-foreground")} />
            {live ? "Live" : "Offline"}
          </span>
          <Button variant="outline" size="sm" onClick={() => { mutate(); mutateFacets(); }} disabled={isValidating}>
            <RefreshCw className={cn("mr-1.5 h-4 w-4", isValidating && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile icon={Activity} label="Events today" value={stats?.today} sub={stats ? `${stats.total.toLocaleString()} all time` : undefined} />
        <StatTile icon={FilePlus2} label="Created" value={stats?.todayCreates} tone="text-emerald-600 dark:text-emerald-400" onClick={() => setParams({ action: "create", range: "today" })} />
        <StatTile icon={PencilLine} label="Updated" value={stats?.todayUpdates} tone="text-blue-600 dark:text-blue-400" onClick={() => setParams({ action: "update", range: "today" })} />
        <StatTile icon={FileX2} label="Deleted" value={stats?.todayDeletes} tone="text-rose-600 dark:text-rose-400" onClick={() => setParams({ action: "delete", range: "today" })} />
        <StatTile icon={Users} label="Active users" value={stats?.todayActiveUsers} sub="today" />
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-xl border bg-card p-3 md:p-4">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search records, users, fields, IDs…"
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
            <FilterSelect
              value={filters.action}
              onChange={(v) => setParams({ action: v })}
              placeholder="All actions"
              options={(facets?.actions ?? []).map((a) => ({ value: a.value, label: a.value.replace(/_/g, " "), count: a.count }))}
            />
            <FilterSelect
              value={filters.entityType}
              onChange={(v) => setParams({ entityType: v, entityId: null, label: null })}
              placeholder="All entities"
              options={(facets?.entityTypes ?? []).map((e) => ({ value: e.value, label: entityName(e.value) || e.value, count: e.count }))}
            />
            <FilterSelect
              value={filters.userId}
              onChange={(v) => setParams({ userId: v })}
              placeholder="All users"
              options={[
                { value: "system", label: "System (no user)" },
                ...(facets?.users ?? []).map((u) => ({ value: u.id, label: u.name || u.email || u.id, count: u.count })),
              ]}
            />
            <FilterSelect
              value={filters.source}
              onChange={(v) => setParams({ source: v })}
              placeholder="All sources"
              options={[
                { value: "system", label: "Data changes" },
                { value: "event", label: "Events & actions" },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setParams({ range: r.id, ...(r.id !== "custom" ? { from: null, to: null } : {}) })}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filters.range === r.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          {filters.range === "custom" && (
            <div className="flex items-center gap-2">
              <Input type="date" value={filters.from} onChange={(e) => setParams({ from: e.target.value })} className="h-8 w-[150px] text-xs" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={filters.to} onChange={(e) => setParams({ to: e.target.value })} className="h-8 w-[150px] text-xs" />
            </div>
          )}
          {activeFilterCount > 0 && (
            <button type="button" onClick={clearAll} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" /> Clear filters ({activeFilterCount})
            </button>
          )}
        </div>

        {(filters.entityId || selectedUser) && (
          <div className="flex flex-wrap gap-2">
            {filters.entityId && (
              <Chip onRemove={() => setParams({ entityId: null, label: null })}>
                History of {entityName(filters.entityType) || "record"}{" "}
                <span className="font-semibold">{filters.entityLabel ? `“${filters.entityLabel}”` : filters.entityId}</span>
              </Chip>
            )}
            {selectedUser && (
              <Chip onRemove={() => setParams({ userId: null })}>
                By <span className="font-semibold">{selectedUser.name || selectedUser.email}</span>
              </Chip>
            )}
          </div>
        )}
      </div>

      {/* New activity banner */}
      {newCount > 0 && (
        <button
          type="button"
          onClick={() => setParams({ page: null }, false)}
          className="w-full rounded-lg border border-primary/30 bg-primary/5 py-2 text-sm font-medium text-primary hover:bg-primary/10"
        >
          {newCount} new {newCount === 1 ? "activity" : "activities"} — jump to latest
        </button>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error.message || "Failed to load activity"}
        </div>
      )}

      {/* Feed */}
      {isLoading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-3 rounded-xl border p-4">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Inbox className="mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="font-medium">No activity found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeFilterCount ? "Try removing some filters." : "Changes will appear here as they happen."}
          </p>
          {activeFilterCount > 0 && (
            <Button variant="outline" size="sm" className="mt-4" onClick={clearAll}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className={cn("space-y-6 transition-opacity", isValidating && data && "opacity-70")}>
          {groups.map((g) => (
            <section key={g.key}>
              <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-3 bg-background/90 px-1 py-1.5 backdrop-blur">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</h2>
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">{g.logs.length}</span>
              </div>
              <ul className="space-y-2">
                {g.logs.map((log) => (
                  <ActivityLogItem
                    key={log.id}
                    log={log}
                    onFilterUser={(userId) => setParams({ userId })}
                    onViewHistory={(entityType, entityId, label) =>
                      setParams({ entityType, entityId, label: label ?? null, action: null, source: null, q: null, range: null })
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalCount > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t pt-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              {((pagination.currentPage - 1) * pagination.limit + 1).toLocaleString()}–
              {Math.min(pagination.currentPage * pagination.limit, pagination.totalCount).toLocaleString()} of{" "}
              {pagination.totalCount.toLocaleString()}
            </span>
            <Select value={String(filters.limit)} onValueChange={(v) => setParams({ limit: v })}>
              <SelectTrigger className="h-8 w-[90px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} / page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrevPage}
              onClick={() => setParams({ page: pagination.currentPage - 1 }, false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pageList(pagination.currentPage, pagination.totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`} className="px-2 text-sm text-muted-foreground">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === pagination.currentPage ? "default" : "ghost"}
                  size="sm"
                  className="min-w-8"
                  onClick={() => setParams({ page: p }, false)}
                >
                  {p}
                </Button>
              ),
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNextPage}
              onClick={() => setParams({ page: pagination.currentPage + 1 }, false)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function pageList(cur: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (cur <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (cur >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", cur - 1, cur, cur + 1, "…", total];
}

function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: number;
  sub?: string;
  tone?: string;
  onClick?: () => void;
}) {
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-card p-3 text-left md:p-4",
        onClick && "transition-colors hover:border-foreground/20 hover:bg-muted/30",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", tone)} />
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums">
        {value === undefined ? <Skeleton className="h-7 w-12" /> : value.toLocaleString()}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </Comp>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string; count?: number }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full capitalize lg:w-[160px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="capitalize">
            <span className="flex w-full items-center justify-between gap-3">
              <span className="truncate">{o.label}</span>
              {o.count !== undefined && <span className="text-xs text-muted-foreground">{o.count.toLocaleString()}</span>}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 py-1 pl-3 pr-1.5 text-xs">
      {children}
      <button type="button" onClick={onRemove} className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Remove filter">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityPageInner />
    </Suspense>
  );
}
