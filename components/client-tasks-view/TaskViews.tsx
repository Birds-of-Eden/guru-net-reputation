// components/client-tasks-view/TaskViews.tsx

"use client";

import * as React from "react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  CheckCircle,
  Calendar,
} from "lucide-react";

import TaskTimer from "./TaskTimer";
import { PerformanceBadge } from "./PerformanceBadge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import type { TimerState } from "../client-tasks-view/client-tasks-view";

type Task = any;

function VirtualizedList<T>({
  items,
  renderItem,
  estimatedItemHeight = 320,
  overscan = 6,
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimatedItemHeight?: number;
  overscan?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(720);

  const onScroll = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;
    setScrollTop(node.scrollTop);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const handleResize = () => setViewportHeight(node.clientHeight || 720);
    handleResize();
    node.addEventListener("scroll", onScroll);
    window.addEventListener("resize", handleResize);
    return () => {
      node.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [onScroll]);

  useEffect(() => {
    const node = containerRef.current;
    if (node) {
      setViewportHeight(node.clientHeight || 720);
    }
  }, [items.length]);

  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / estimatedItemHeight) - overscan
  );
  const visibleCount =
    Math.ceil(viewportHeight / estimatedItemHeight) + overscan * 2;
  const endIndex = Math.min(items.length, startIndex + visibleCount);
  const offsetY = startIndex * estimatedItemHeight;
  const totalHeight = items.length * estimatedItemHeight;

  return (
    <div
      ref={containerRef}
      className="virtualized-task-list"
      style={{ maxHeight: "75vh", overflowY: "auto" }}
      onScroll={onScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {items.slice(startIndex, endIndex).map((item, idx) =>
            renderItem(item, startIndex + idx)
          )}
        </div>
      </div>
    </div>
  );
}

export default function TaskViews({
  tab,
  currentTasks,
  viewMode,
  tasks,
  overdueCount,
  activeTab,

  timerState,
  pausedTimer,
  handleStartTimer,
  handlePauseTimer,
  onRequestComplete,

  isTaskDisabled,
  isLocked,
  canReveal,
  isReassignedLike,
  showReassignNote,
  hideAssetSection,
  getDisplayUrl,

  copied,
  handleCopy,
  mask,
  isPasswordVisible,
  togglePassword,

  getStatusBadge,
  getPriorityBadge,
  formatTimerDisplay,

  setTaskToComplete,
  setIsCompletionConfirmOpen,
}: {
  tab: "today" | "tomorrow" | "upcoming" | "reassigned" | "completed";
  currentTasks: Task[];
  viewMode: "grid" | "list";
  tasks: Task[];
  overdueCount: number;
  activeTab: string;

  timerState: TimerState | null;
  pausedTimer: TimerState | null;
  handleStartTimer: (taskId: string) => void;
  handlePauseTimer: (taskId: string) => void;
  onRequestComplete: (task: Task) => void;

  isTaskDisabled: (id: string) => boolean;
  isLocked: (t: Task) => boolean;
  canReveal: (t: Task, timer: TimerState | null) => boolean;
  isReassignedLike: (t: Task) => boolean;
  showReassignNote: (note: string) => void;
  hideAssetSection: boolean;
  getDisplayUrl: (t: Task) => string | null;

  copied: { id: string; type: "url" | "password" | "email" | "username" } | null;
  handleCopy: (
    text: string,
    id: string,
    type: "url" | "password" | "email" | "username",
    revealAllowed?: boolean
  ) => void;
  mask: (s?: string | null) => string;
  isPasswordVisible: (id: string) => boolean;
  togglePassword: (id: string) => void;

  getStatusBadge: (status: string) => React.ReactElement;
  getPriorityBadge: (priority: string) => React.ReactElement;
  formatTimerDisplay: (seconds: number) => string;

  setTaskToComplete: (t: Task | null) => void;
  setIsCompletionConfirmOpen: (b: boolean) => void;
}) {
  const uniqueCurrentTasks = useMemo(() => {
    const map = new Map<string, Task>();
    for (const t of currentTasks) {
      const id = (t as any)?.id;
      if (!id) continue;
      if (!map.has(id)) map.set(id, t);
    }
    return Array.from(map.values());
  }, [currentTasks]);

  // ✅ same ScorePill + fmt
  function ScorePill({
    label,
    value,
  }: {
    label: string;
    value: number | null | undefined;
  }) {
    const v = typeof value === "number" ? value : null;
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 px-2 py-1">
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
          {label}
        </span>
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-gradient-to-r from-indigo-100 to-pink-100 text-indigo-700 dark:from-indigo-900/30 dark:to-pink-900/30 dark:text-pink-200">
          {v ?? "—"}
        </span>
      </div>
    );
  }

  function fmt(dt?: string) {
    if (!dt) return "—";
    try {
      return new Date(dt).toLocaleString();
    } catch {
      return dt;
    }
  }

  // empty states icon map (no feature change)
  const EmptyIcon = {
    today: CheckCircle,
    tomorrow: Calendar,
    upcoming: Calendar,
    reassigned: Calendar,
    completed: CheckCircle,
  }[tab];

  const emptyText = {
    today: ["No tasks for today!", "You're all caught up for today."],
    tomorrow: ["No tasks for tomorrow!", "Enjoy your day off tomorrow."],
    upcoming: ["No upcoming tasks!", "All your tasks are well organized."],
    reassigned: ["No reassigned tasks!", "Currently you have no tasks marked as reassigned."],
    completed: ["No completed tasks yet!", "Complete some tasks to see them here."],
  }[tab];

  const renderTaskCard = (task: Task) => {
    const isTimerActive =
      timerState?.taskId === task.id && timerState?.isRunning;
    const displayUrl = getDisplayUrl(task);
    const urlCopied = copied?.id === task.id && copied?.type === "url";
    const emailCopied = copied?.id === task.id && copied?.type === "email";
    const usernameCopied =
      copied?.id === task.id && copied?.type === "username";
    const passwordCopied =
      copied?.id === task.id && copied?.type === "password";
    const locked = isLocked(task);
    const isThisTaskDisabled = locked || isTaskDisabled(task.id);

    const reveal = canReveal(task, timerState);

    const card = (
      <div
        className={`group relative bg-gradient-to-br from-white via-violet-50/30 to-purple-50/30 dark:from-gray-800 dark:via-violet-900/10 dark:to-purple-900/10 rounded-2xl border-2 transition-all duration-300 hover:shadow-xl border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600 shadow-lg ${
          isThisTaskDisabled ? "opacity-70" : ""
        }`}
      >
            <div className="p-6 w-full">
              <div className="flex flex-col lg:flex-row gap-10 items-start lg:items-center w-full">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="flex items-center gap-3">
                      <PerformanceBadge rating={task.performanceRating as any} />
                      {task.status === "qc_approved" && (
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-block px-3 py-1 text-sm font-semibold rounded-full bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 text-indigo-700 dark:from-indigo-900/30 dark:via-purple-900/30 dark:to-pink-900/30 dark:text-pink-300 shadow-sm cursor-pointer">
                                🎯 Total Score:{" "}
                                <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                                  {task.qcTotalScore ?? "-"}
                                </span>
                              </span>
                            </TooltipTrigger>

                            <TooltipContent
                              side="top"
                              align="start"
                              className="w-[400px] p-0 rounded-xl shadow-xl border border-gray-200 bg-gray-800 text-gray-100"
                            >
                              {(() => {
                                const r = (task?.qcReview as any) || {};
                                const total = Number(r.total ?? task.qcTotalScore ?? 0);

                                return (
                                  <div className="p-4 space-y-3">
                                    <div className="flex items-center justify-between border-b border-gray-600 pb-2">
                                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-100">
                                        QC Review
                                      </div>
                                      <div className="text-xs text-gray-100">
                                        {fmt(r.reviewedAt)}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-semibold">
                                          Total Score
                                        </span>
                                        <span className="text-sm font-bold text-blue-400">
                                          {total}/100
                                        </span>
                                      </div>
                                      <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                                        <div
                                          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
                                          style={{ width: `${Math.max(0, Math.min(100, total))}%` }}
                                        />
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                      <ScorePill label="Timer" value={r.timerScore} />
                                      <ScorePill label="SEO" value={r.seo} />
                                      <ScorePill label="Image" value={r.image} />
                                      <ScorePill label="Grammar" value={r.grammar} />
                                      <ScorePill label="Keyword" value={r.keyword} />
                                      <ScorePill label="Humanization" value={r.humanization} />
                                      <ScorePill label="Content" value={r.contentQuality} />
                                    </div>

                                    {r.notes && (
                                      <div className="rounded-lg bg-gray-700 p-3 border border-gray-600">
                                        <div className="text-xs font-semibold text-gray-300 mb-1">
                                          Notes
                                        </div>
                                        <div className="text-xs leading-relaxed text-gray-200">
                                          {String(r.notes)}
                                        </div>
                                      </div>
                                    )}

                                    <div className="text-xs text-gray-200 border-t border-gray-600 pt-2">
                                      Reviewer ID:{" "}
                                      <span className="font-mono text-gray-300">
                                        {r.reviewerId ?? "—"}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="font-bold text-gray-900 dark:text-gray-50 text-lg truncate">
                        {task.name}
                      </h3>
                      {isTimerActive && !locked && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-100 via-cyan-100 to-teal-100 dark:from-blue-900/40 dark:via-cyan-900/40 dark:to-teal-900/40 rounded-full border-2 border-blue-200 dark:border-blue-700">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                            ACTIVE
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <div className="flex items-center gap-1">
                        {getStatusBadge(task.status)}
                      </div>
                      {getPriorityBadge(task.priority)}
                      <Badge
                        variant="outline"
                        className="text-xs font-semibold border-2 border-gray-300 dark:border-gray-600"
                      >
                        {task.category?.name || "N/A"}
                      </Badge>
                    </div>

                    {isReassignedLike(task) && (
                      <div className="flex items-center gap-2 mb-4 text-xs font-medium text-gray-600 dark:text-gray-400">
                        <p>Reassign Note:</p>
                        {task.reassignNotes && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full hover:bg-violet-100 dark:hover:bg-violet-800/50 transition-colors"
                            onClick={() => showReassignNote(task.reassignNotes || "")}
                            title="View reassign note"
                          >
                            <Eye className="h-3 w-3 text-violet-600" />
                          </Button>
                        )}
                      </div>
                    )}

                    {!hideAssetSection && task.templateSiteAsset?.name && (
                      <div className="mb-4 p-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl border-2 border-indigo-200 dark:border-indigo-700">
                        <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 break-words">
                          <span className="text-gray-700 dark:text-gray-300">
                            Asset:
                          </span>{" "}
                          {task.templateSiteAsset?.name}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0 w-full lg:w-auto">
                  <div className="space-y-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 rounded-xl p-4 border-2 border-gray-200 dark:border-gray-700">
                    {/* Email */}
                    <div className="text-sm flex items-center gap-2">
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        Email:
                      </span>
                      <span className="font-mono text-gray-700 dark:text-gray-300 break-all bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
                        {reveal ? task.email || "N/A" : mask(task.email)}
                      </span>
                      {!!task.email && !locked && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 rounded-xl transition-colors ${
                            reveal
                              ? "hover:bg-gray-100 dark:hover:bg-gray-700"
                              : "opacity-50 cursor-not-allowed"
                          }`}
                          onClick={() =>
                            handleCopy(task.email!, task.id, "email", reveal)
                          }
                          disabled={!reveal}
                          aria-label="Copy email"
                          title={reveal ? "Copy email" : "Start timer to view"}
                        >
                          {emailCopied ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3 text-gray-600" />
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Username */}
                    <div className="text-sm flex items-center gap-2">
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        Username:
                      </span>
                      <span className="font-mono text-gray-700 dark:text-gray-300 break-all bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
                        {reveal ? task.username || "N/A" : mask(task.username)}
                      </span>
                      {!!task.username && !locked && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 rounded-xl transition-colors ${
                            reveal
                              ? "hover:bg-gray-100 dark:hover:bg-gray-700"
                              : "opacity-50 cursor-not-allowed"
                          }`}
                          onClick={() =>
                            handleCopy(task.username!, task.id, "username", reveal)
                          }
                          disabled={!reveal}
                          aria-label="Copy username"
                          title={reveal ? "Copy username" : "Start timer to view"}
                        >
                          {usernameCopied ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3 text-gray-600" />
                          )}
                        </Button>
                      )}
                    </div>

                    {/* Password */}
                    <div className="text-sm flex items-center gap-2">
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        Password:
                      </span>
                      <span className="font-mono text-gray-700 dark:text-gray-300 break-all bg-white dark:bg-gray-800 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
                        {task.password
                          ? locked
                            ? "••••••••"
                            : reveal
                            ? isPasswordVisible(task.id)
                              ? task.password
                              : "••••••••"
                            : mask(task.password)
                          : "N/A"}
                      </span>

                      {task.password && !locked && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={`h-6 w-6 rounded-xl transition-colors ${
                              reveal
                                ? "hover:bg-gray-100 dark:hover:bg-gray-700"
                                : "opacity-50 cursor-not-allowed"
                            }`}
                            onClick={() => reveal && togglePassword(task.id)}
                            disabled={!reveal}
                            aria-label={
                              isPasswordVisible(task.id)
                                ? "Hide password"
                                : "Show password"
                            }
                            title={
                              reveal
                                ? isPasswordVisible(task.id)
                                  ? "Hide password"
                                  : "Show password"
                                : "Start timer to view"
                            }
                          >
                            {isPasswordVisible(task.id) ? (
                              <EyeOff className="h-3 w-3 text-gray-600" />
                            ) : (
                              <Eye className="h-3 w-3 text-gray-600" />
                            )}
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={`h-6 w-6 rounded-xl transition-colors ${
                              reveal
                                ? "hover:bg-gray-100 dark:hover:bg-gray-700"
                                : "opacity-50 cursor-not-allowed"
                            }`}
                            onClick={() =>
                              handleCopy(task.password!, task.id, "password", reveal)
                            }
                            disabled={!reveal}
                            aria-label="Copy password"
                            title={reveal ? "Copy password" : "Start timer to view"}
                          >
                            {passwordCopied ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-gray-600" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>

                    {/* URL */}
                    {displayUrl && (
                      <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-xl border-2 border-blue-200 dark:border-blue-700">
                        <div className="text-sm flex items-start gap-2">
                          <span className="font-bold text-blue-800 dark:text-blue-300 flex-shrink-0">
                            URL:
                          </span>
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {reveal ? (
                              <a
                                href={displayUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 dark:text-blue-400 truncate underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                                title={displayUrl}
                              >
                                <span className="truncate break-all inline-block max-w-full">
                                  {displayUrl}
                                </span>
                              </a>
                            ) : (
                              <span className="font-mono text-gray-700 dark:text-gray-300 break-all bg-white/70 dark:bg-gray-800/70 px-2 py-1 rounded border border-gray-200 dark:border-gray-600">
                                {mask(displayUrl)}
                              </span>
                            )}

                            {!locked && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className={`h-6 w-6 rounded-xl transition-colors flex-shrink-0 ${
                                  reveal
                                    ? "hover:bg-blue-100 dark:hover:bg-blue-800/50"
                                    : "opacity-50 cursor-not-allowed"
                                }`}
                                onClick={() =>
                                  handleCopy(displayUrl, task.id, "url", reveal)
                                }
                                disabled={!reveal}
                                aria-label="Copy URL"
                                title={reveal ? "Copy URL" : "Start timer to view"}
                              >
                                {urlCopied ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3 text-blue-600" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timer */}
                <div className="w-full lg:w-auto lg:min-w-[120px]">
                  <TaskTimer
                    task={task}
                    timerState={timerState}
                    pausedTimer={pausedTimer}
                    onStartTimer={locked ? () => {} : handleStartTimer}
                    onPauseTimer={locked ? () => {} : handlePauseTimer}
                    onRequestComplete={onRequestComplete}
                    formatTimerDisplay={formatTimerDisplay}
                  />
                </div>
              </div>
            </div>
          </div>
        );

    return (
      <div className="mb-4 last:mb-0" key={task.id}>
        {card}
      </div>
    );
  };

  const shouldVirtualize = uniqueCurrentTasks.length > 40;
  const listView = shouldVirtualize ? (
    <VirtualizedList
      items={uniqueCurrentTasks}
      estimatedItemHeight={340}
      overscan={8}
      renderItem={(item) => renderTaskCard(item)}
    />
  ) : (
    <div className="space-y-4">{uniqueCurrentTasks.map(renderTaskCard)}</div>
  );

  // ✅ Grid view = original logic unchanged, just moved
  const gridView = (
    <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {uniqueCurrentTasks.map((task) => {
        const isTimerActive =
          timerState?.taskId === task.id && timerState?.isRunning;

        const displayUrl = getDisplayUrl(task);
        const urlCopied = copied?.id === task.id && copied?.type === "url";
        const emailCopied = copied?.id === task.id && copied?.type === "email";
        const usernameCopied = copied?.id === task.id && copied?.type === "username";
        const passwordCopied = copied?.id === task.id && copied?.type === "password";
        const locked = isLocked(task);
        const isThisTaskDisabled = locked || isTaskDisabled(task.id);
        const performanceRating = task.performanceRating;
        const reveal = task.status !== "pending" || isTimerActive;

        return (
          <div
            key={task.id}
            className={`group relative bg-gradient-to-br from-white via-violet-50/30 to-purple-50/30 dark:from-gray-800 dark:via-violet-900/10 dark:to-purple-900/10 rounded-3xl border-2 transition-all duration-500 hover:shadow-2xl hover:-translate-y-0.5 border-gray-200 dark:border-gray-700 hover:border-violet-300 dark:hover:border-violet-600 shadow-xl ${
              isThisTaskDisabled ? "opacity-70" : ""
            }`}
          >
            <div className="p-6 h-full flex flex-col">
              <div className="flex-1 flex flex-col space-y-6">
                <div className="flex items-start gap-4 w-full">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <h3 className="font-bold text-gray-900 dark:text-gray-50 text-xl truncate">
                        {task.name}
                      </h3>
                      {isTimerActive && !locked && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-100 via-cyan-100 to-teal-100 dark:from-blue-900/40 dark:via-cyan-900/40 dark:to-teal-900/40 rounded-full border-2 border-blue-200 dark:border-blue-700">
                          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                          <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                            ACTIVE
                          </span>
                        </div>
                      )}
                      <PerformanceBadge rating={performanceRating as any} />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-1">
                        {getStatusBadge(task.status)}
                        {isReassignedLike(task) && task.reassignNotes && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full hover:bg-violet-100 dark:hover:bg-violet-800/50 transition-colors"
                            onClick={() =>
                              showReassignNote(task.reassignNotes || "")
                            }
                            title="View reassign note"
                          >
                            <Eye className="h-4 w-4 text-violet-600" />
                          </Button>
                        )}
                      </div>

                      {getPriorityBadge(task.priority)}
                      <Badge
                        variant="outline"
                        className="text-sm font-semibold border-2 border-gray-300 dark:border-gray-600"
                      >
                        {task.category?.name || "N/A"}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Asset */}
                {!hideAssetSection && task.templateSiteAsset?.name && (
                  <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl border-2 border-indigo-200 dark:border-indigo-700">
                    <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
                      <span className="text-gray-700 dark:text-gray-300">
                        Asset:
                      </span>{" "}
                      {task.templateSiteAsset?.name}
                    </p>
                  </div>
                )}

                {/* URL */}
                {displayUrl && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-2xl border-2 border-blue-200 dark:border-blue-700">
                    <div className="text-sm flex items-start gap-3">
                      <span className="font-bold text-blue-800 dark:text-blue-300 flex-shrink-0">
                        URL:
                      </span>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {reveal ? (
                          <a
                            href={displayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 truncate underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                            title={displayUrl}
                          >
                            <span className="truncate break-all inline-block max-w-full">
                              {displayUrl}
                            </span>
                          </a>
                        ) : (
                          <span
                            className="text-blue-600 dark:text-blue-400 truncate underline underline-offset-2 font-medium"
                            title="Start timer to view"
                          >
                            <span className="truncate break-all inline-block max-w-full">
                              {mask(displayUrl)}
                            </span>
                          </span>
                        )}

                        {!locked && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors flex-shrink-0"
                            onClick={() =>
                              reveal && handleCopy(displayUrl, task.id, "url")
                            }
                            aria-label="Copy URL"
                            title={reveal ? "Copy URL" : "Start timer to view"}
                          >
                            {urlCopied ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-4 w-4 text-blue-600" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Credentials */}
                <div className="space-y-3 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/50 dark:to-slate-800/50 rounded-2xl p-4 border-2 border-gray-200 dark:border-gray-700">
                  {/* Email */}
                  <div className="text-sm flex items-center gap-2">
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      Email:
                    </span>
                    <span className="font-mono text-gray-700 dark:text-gray-300 break-all bg-white dark:bg-gray-800 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600">
                      {reveal ? task.email || "N/A" : mask(task.email)}
                    </span>
                    {!!task.email && !locked && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={() =>
                          reveal && handleCopy(task.email!, task.id, "email")
                        }
                        aria-label="Copy email"
                        title={reveal ? "Copy email" : "Start timer to view"}
                      >
                        {emailCopied ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-600" />
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Username */}
                  <div className="text-sm flex items-center gap-2">
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      Username:
                    </span>
                    <span className="font-mono text-gray-700 dark:text-gray-300 break-all bg-white dark:bg-gray-800 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600">
                      {reveal ? task.username || "N/A" : mask(task.username)}
                    </span>
                    {!!task.username && !locked && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={() =>
                          reveal &&
                          handleCopy(task.username!, task.id, "username")
                        }
                        aria-label="Copy username"
                        title={reveal ? "Copy username" : "Start timer to view"}
                      >
                        {usernameCopied ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-gray-600" />
                        )}
                      </Button>
                    )}
                  </div>

                  {/* Password */}
                  <div className="text-sm flex items-center gap-2">
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      Password:
                    </span>
                    <span className="font-mono text-gray-700 dark:text-gray-300 break-all bg-white dark:bg-gray-800 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-600">
                      {task.password
                        ? locked
                          ? "••••••••"
                          : reveal
                          ? isPasswordVisible(task.id)
                            ? task.password
                            : "••••••••"
                          : mask(task.password)
                        : "N/A"}
                    </span>
                    {task.password && !locked && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          onClick={() => reveal && togglePassword(task.id)}
                          aria-label={
                            isPasswordVisible(task.id)
                              ? "Hide password"
                              : "Show password"
                          }
                          title={
                            reveal
                              ? isPasswordVisible(task.id)
                                ? "Hide password"
                                : "Show password"
                              : "Start timer to view"
                          }
                        >
                          {isPasswordVisible(task.id) ? (
                            <EyeOff className="h-4 w-4 text-gray-600" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-600" />
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          onClick={() =>
                            reveal &&
                            handleCopy(task.password!, task.id, "password")
                          }
                          aria-label="Copy password"
                          title={reveal ? "Copy password" : "Start timer to view"}
                        >
                          {passwordCopied ? (
                            <Check className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-600" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 -mx-6 -mb-8 px-8 py-5 bg-gradient-to-r from-violet-50/70 to-purple-50/70 dark:from-violet-900/20 dark:to-purple-900/20 border-t-2 border-violet-200/70 dark:border-violet-700/70 backdrop-blur-sm">
                <div className="flex justify-between mt-3">
                  <TaskTimer
                    task={task}
                    timerState={timerState}
                    pausedTimer={pausedTimer}
                    onStartTimer={locked ? () => {} : handleStartTimer}
                    onPauseTimer={locked ? () => {} : handlePauseTimer}
                    onRequestComplete={onRequestComplete}
                    formatTimerDisplay={formatTimerDisplay}
                  />

                  {task.status === "qc_approved" && (
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex items-center px-3 py-0 text-sm font-semibold rounded-full bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 text-indigo-700 dark:from-indigo-900/30 dark:via-purple-900/30 dark:to-pink-900/30 dark:text-pink-300 shadow-sm cursor-pointer">
                            🎯 Total Score:{" "}
                            <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                              {task.qcTotalScore ?? "-"}
                            </span>
                          </span>
                        </TooltipTrigger>

                        <TooltipContent
                          side="top"
                          align="start"
                          className="w-[400px] p-0 rounded-xl shadow-xl border border-gray-200 bg-gray-800 text-gray-100"
                        >
                          {(() => {
                            const r = (task?.qcReview as any) || {};
                            const total = Number(r.total ?? task.qcTotalScore ?? 0);

                            return (
                              <div className="p-4 space-y-3">
                                <div className="flex items-center justify-between border-b border-gray-600 pb-2">
                                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-100">
                                    QC Review
                                  </div>
                                  <div className="text-xs text-gray-100">
                                    {fmt(r.reviewedAt)}
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-semibold">
                                      Total Score
                                    </span>
                                    <span className="text-sm font-bold text-blue-400">
                                      {total}/100
                                    </span>
                                  </div>
                                  <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600"
                                      style={{
                                        width: `${Math.max(0, Math.min(100, total))}%`,
                                      }}
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <ScorePill label="Timer" value={r.timerScore} />
                                  <ScorePill label="SEO" value={r.seo} />
                                  <ScorePill label="Image" value={r.image} />
                                  <ScorePill label="Grammar" value={r.grammar} />
                                  <ScorePill label="Keyword" value={r.keyword} />
                                  <ScorePill label="Humanization" value={r.humanization} />
                                  <ScorePill label="Content" value={r.contentQuality} />
                                </div>

                                {r.notes && (
                                  <div className="rounded-lg bg-gray-700 p-3 border border-gray-600">
                                    <div className="text-xs font-semibold text-gray-300 mb-1">
                                      Notes
                                    </div>
                                    <div className="text-xs leading-relaxed text-gray-200">
                                      {String(r.notes)}
                                    </div>
                                  </div>
                                )}

                                <div className="text-xs text-gray-200 border-t border-gray-600 pt-2">
                                  Reviewer ID:{" "}
                                  <span className="font-mono text-gray-300">
                                    {r.reviewerId ?? "—"}
                                  </span>
                                </div>
                              </div>
                            );
                          })()}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ✅ empty state block unchanged
  if (!currentTasks.length) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto w-32 h-32 bg-gradient-to-br from-gray-100 to-slate-100 dark:from-gray-800/30 dark:to-slate-800/30 rounded-3xl flex items-center justify-center mb-6 shadow-2xl border-2 border-gray-200 dark:border-gray-700">
          <EmptyIcon className="h-12 w-12 text-gray-500" />
        </div>
        <p className="text-gray-600 dark:text-gray-300 text-xl font-bold mb-2">
          {emptyText[0]}
        </p>
        <p className="text-gray-500 dark:text-gray-400">
          {emptyText[1]}
        </p>
      </div>
    );
  }

  return viewMode === "list" ? listView : gridView;
}
