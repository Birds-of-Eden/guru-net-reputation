// components/clients/clientsID/task-cycle-tabs.tsx
// Groups a category's tasks by cycle ("Behance Task -3" → cycle 3) and shows
// one tab per cycle: Task-1, Task-2, … Tasks without a cycle number go to "Other".
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type CycleTask = { id: string; name?: string | null; status?: string | null };

const DONE = new Set(["completed", "complete", "done", "finished", "qc_approved", "approved"]);
const norm = (s?: string | null) => String(s ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

/** "Behance Task -3" / "Behance Task - 3" / "<b>Behance</b> Task -3" → 3 */
export function cycleOf(name?: string | null): number | null {
  const plain = String(name ?? "").replace(/<[^>]+>/g, "").trim();
  const m = plain.match(/-\s*(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

export function TaskCycleTabs<T extends CycleTask>({
  tasks,
  renderTask,
}: {
  tasks: T[];
  renderTask: (task: T) => ReactNode;
}) {
  const groups = useMemo(() => {
    const map = new Map<number | "other", T[]>();
    for (const t of tasks) {
      const c = cycleOf(t.name);
      const key = c ?? "other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a === "other" ? 1 : b === "other" ? -1 : a - b))
      .map(([key, list]) => ({
        key: String(key),
        label: key === "other" ? "Other" : `Task-${key}`,
        tasks: list,
        done: list.filter((t) => DONE.has(norm(t.status))).length,
      }));
  }, [tasks]);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = groups.find((g) => g.key === activeKey) ?? groups[0];

  // ---- horizontal scrolling of the tab strip ----
  const stripRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = () => {
    const el = stripRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((p) => (p.left === left && p.right === right ? p : { left, right }));
  };
  const scrollBy = (dir: 1 | -1) =>
    stripRef.current?.scrollBy({ left: dir * stripRef.current.clientWidth * 0.8, behavior: "smooth" });

  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    updateEdges();
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [groups.length]);

  // Keep the selected tab visible
  useEffect(() => {
    const strip = stripRef.current;
    const tab = strip?.querySelector<HTMLElement>(`[data-cycle="${active?.key}"]`);
    if (!strip || !tab) return;
    const { offsetLeft, offsetWidth } = tab;
    if (offsetLeft < strip.scrollLeft || offsetLeft + offsetWidth > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: offsetLeft - strip.clientWidth / 2 + offsetWidth / 2, behavior: "smooth" });
    }
  }, [active?.key]);

  // A single cycle doesn't need tabs
  if (groups.length <= 1) return <>{tasks.map(renderTask)}</>;

  const arrow =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700";

  return (
    // contain:inline-size → the (very wide) tab strip can never stretch the
    // page; it scrolls inside whatever width the layout gives it.
    <div className="w-full min-w-0 max-w-full space-y-3 [contain:inline-size]">
      <div className="flex w-full min-w-0 items-center gap-2">
        <button type="button" className={arrow} onClick={() => scrollBy(-1)} disabled={!edges.left} aria-label="Previous cycles">
          <ChevronLeft className="h-4 w-4" />
        </button>
      <div
        ref={stripRef}
        onScroll={updateEdges}
        role="tablist"
        aria-label="Task cycles"
        className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((g) => {
          const selected = g.key === active.key;
          const complete = g.done === g.tasks.length;
          return (
            <button
              key={g.key}
              data-cycle={g.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveKey(g.key)}
              className={cn(
                "inline-flex shrink-0 snap-start items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                selected
                  ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
              )}
            >
              <span>{g.label}</span>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  selected
                    ? "bg-white/20 text-white"
                    : complete
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                )}
                title={`${g.done} of ${g.tasks.length} done`}
              >
                {g.done}/{g.tasks.length}
              </span>
            </button>
          );
        })}
      </div>
        <button type="button" className={arrow} onClick={() => scrollBy(1)} disabled={!edges.right} aria-label="Next cycles">
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="hidden shrink-0 text-xs text-slate-500 sm:inline dark:text-slate-400">
          {groups.length} cycles
        </span>
      </div>

      <div role="tabpanel" aria-label={active.label} className="space-y-2">
        {active.tasks.map(renderTask)}
      </div>
    </div>
  );
}
