// components/client-tasks-view/TaskList.tsx

"use client";

import * as React from "react";
import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  List,
  Grid3X3,
  Search,
  Calendar,
  CheckCircle,
  Clock,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import ReassignNoteModal from "./ReassignNoteModal";
import type { TimerState } from "../client-tasks-view/client-tasks-view";

// Import the base Task type and extend it with additional properties
import type { Task as BaseTask } from "./client-tasks-view";
import TaskViews from "./TaskViews"; // ✅ Part-2 renderer

type Task = BaseTask & {
  reassignNotes?: string;
  username?: string | null;
  password?: string;
  email?: string | null;
  timerState?: any;
  assetUrl?: string;
  url?: string;
  actualDurationMinutes?: number | null;
};

export default function TaskList({
  clientName,
  tasks,
  filteredTasks,
  pinnedTask,
  overdueCount,
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  page,
  totalPages,
  totalTasks,
  onPageChange,
  onVisibleCountChange,
  paginationEnabled,
  timerState,
  handleStartTimer,
  handlePauseTimer,
  isTaskDisabled,
  viewMode,
  setViewMode,
  setTaskToComplete,
  setIsCompletionConfirmOpen,
  getStatusBadge,
  getPriorityBadge,
  formatTimerDisplay,
  pausedTimer,
  refreshTasks,
  completedTasks,
}: {
  clientName: string;
  tasks: Task[];
  filteredTasks: Task[];
  pinnedTask?: Task | null;
  selectedTasks?: string[];
  setSelectedTasks: React.Dispatch<React.SetStateAction<string[]>>;
  overdueCount: number;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  priorityFilter: string;
  setPriorityFilter: (v: string) => void;
  page: number;
  totalPages: number;
  totalTasks: number;
  onPageChange: (page: number) => void;
  onVisibleCountChange?: (count: number) => void;
  paginationEnabled?: boolean;
  timerState: TimerState | null;
  handleStartTimer: (taskId: string) => void;
  handlePauseTimer: (taskId: string) => void;
  isTaskDisabled: (taskId: string) => boolean;
  viewMode: "grid" | "list";
  setViewMode: (v: "grid" | "list") => void;
  onOpenStatusModal: () => void;
  taskToComplete: Task | null;
  setTaskToComplete: (t: Task | null) => void;
  isCompletionConfirmOpen: boolean;
  setIsCompletionConfirmOpen: (b: boolean) => void;
  onTaskComplete: (task: Task) => void;
  getStatusBadge: (status: string) => React.ReactElement;
  getPriorityBadge: (priority: string) => React.ReactElement;
  formatTimerDisplay: (seconds: number) => string;
  pausedTimer: TimerState | null;
  refreshTasks: () => Promise<void>;
  stopTimer: (taskId: string) => TimerState | undefined;
  completedTasks?: Task[];
}) {
  // 🔒 completed / qc_approved = read-only
  const isLocked = (t: Task) =>
    t.status === "completed" || t.status === "qc_approved";

  // State for reassign note modal
  const [isReassignNoteModalOpen, setIsReassignNoteModalOpen] = useState(false);
  const [selectedReassignNote, setSelectedReassignNote] = useState("");

  const showReassignNote = (note: string) => {
    setSelectedReassignNote(note);
    setIsReassignNoteModalOpen(true);
  };

  // ✅ Assetless ক্যাটাগরি
  const ASSETLESS_SET = new Set([
    "social activity",
    "blog posting",
    "graphics design",
  ]);
  const isAssetlessCategory = (t: Task) =>
    ASSETLESS_SET.has((t.category?.name ?? "").toLowerCase());
  const isSocialActivity = (t: Task) =>
    (t.category?.name ?? "").toLowerCase() === "social activity";

  const computeUrl = (t: Task): string | null => {
    const cl = (t.completionLink ?? "").trim();
    if (cl) return cl;
    if (isSocialActivity(t)) return cl || null;
    return (
      t.templateSiteAsset?.url ?? (t as any).assetUrl ?? (t as any).url ?? null
    );
  };

  const hideAssetSection = useMemo(
    () =>
      filteredTasks.length > 0 &&
      filteredTasks.every((t) => isAssetlessCategory(t)),
    [filteredTasks]
  );

  const [copied, setCopied] = useState<{
    id: string;
    type: "url" | "password" | "email" | "username";
  } | null>(null);

  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(
    new Set()
  );

  const handleCopy = async (
    text: string,
    id: string,
    type: "url" | "password" | "email" | "username",
    revealAllowed?: boolean
  ) => {
    if (!text || revealAllowed === false) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied({ id, type });
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

  const isPasswordVisible = (id: string) => visiblePasswords.has(id);
  const togglePassword = (id: string) =>
    setVisiblePasswords((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const [lastKnownUrl, setLastKnownUrl] = useState<Map<string, string>>(
    new Map()
  );

  useEffect(() => {
    if (!filteredTasks?.length) return;
    setLastKnownUrl((prev) => {
      const next = new Map(prev);
      for (const t of filteredTasks) {
        const u = computeUrl(t);
        if (u) next.set(t.id, u);
      }
      return next;
    });
  }, [filteredTasks]);

  const getDisplayUrl = (t: Task) =>
    computeUrl(t) ?? lastKnownUrl.get(t.id) ?? null;

  const canReveal = (t: Task, timer: TimerState | null) => {
    const isActive = timer?.taskId === t.id && timer?.isRunning;
    return t.status !== "pending" || isActive;
  };

  const mask = (s?: string | null) => (s ? "*********" : "N/A");

  const isReassignedLike = (task: Task) => {
    if (task.status === "reassigned") {
      return true;
    }

    if (
      task.reassignNotes &&
      task.status !== "completed" &&
      task.status !== "qc_approved"
    ) {
      return true;
    }

    return false;
  };

  // ✅ Complete only if timer is running for this task
  const onRequestComplete = (task: Task) => {
    if (isLocked(task)) return;
    const isTimerActive =
      timerState?.taskId === task.id && timerState?.isRunning;
    if (!isTimerActive) return;
    setTaskToComplete(task);
    setIsCompletionConfirmOpen(true);
  };

  // তারিখ ভিত্তিক টাস্ক গ্রুপিং
  const groupTasksByDate = (tasks: Task[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const groups = {
      today: [] as Task[],
      tomorrow: [] as Task[],
      upcoming: [] as Task[],
      reassigned: [] as Task[],
      completed: [] as Task[],
    };

    tasks.forEach((task) => {
      // First check if task is completed or QC approved
      if (task.status === "completed" || task.status === "qc_approved") {
        groups.completed.push(task);
        return;
      }

      // Then check if task is reassigned or has reassign notes
      if (isReassignedLike(task)) {
        groups.reassigned.push(task);
        return;
      }

      // Then handle by due date for non-completed tasks
      if (!task.dueDate) {
        groups.upcoming.push(task);
        return;
      }

      const dueDate = new Date(task.dueDate);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate.getTime() === today.getTime()) {
        groups.today.push(task);
      } else if (dueDate.getTime() === tomorrow.getTime()) {
        groups.tomorrow.push(task);
      } else if (dueDate.getTime() > tomorrow.getTime()) {
        groups.upcoming.push(task);
      } else {
        groups.upcoming.push(task);
      }
    });

    return groups;
  };

  const taskGroups = groupTasksByDate(filteredTasks);
  const [activeTab, setActiveTab] = useState("today");
  const realtimeRefreshInFlight = useRef(false);
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
  }, []);

  // Use completedTasks prop for completed tab, otherwise fall back to grouped completed tasks
  const allCompletedTasks = completedTasks || taskGroups.completed;

  // Lightweight polling + tab visibility refresh to keep data fresh without manual reloads.
  useEffect(() => {
    const tick = async () => {
      if (realtimeRefreshInFlight.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      realtimeRefreshInFlight.current = true;
      try {
        await refreshTasks();
      } catch (err) {
        console.error("Realtime refresh failed", err);
      } finally {
        realtimeRefreshInFlight.current = false;
      }
    };

    const interval = setInterval(tick, 10000); // Reduced interval for better real-time updates
    return () => clearInterval(interval);
  }, [refreshTasks]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) return;
      void refreshTasks();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [refreshTasks]);

  // Additional refresh when switching tabs
  useEffect(() => {
    void refreshTasks();
  }, [activeTab, refreshTasks]);

  // তারিখ ফরম্যাট ফাংশন
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const completedTabTasks = allCompletedTasks;
  const reassignedTasks = taskGroups.reassigned;

  const currentTasks = useMemo(() => {
    const baseTasks = (() => {
      switch (activeTab) {
        case "today":
          return taskGroups.today;
        case "tomorrow":
          return taskGroups.tomorrow;
        case "upcoming":
          return taskGroups.upcoming;
        case "reassigned":
          return reassignedTasks;
        case "completed":
          return completedTabTasks;
        default:
          return filteredTasks;
      }
    })();

    // Sort tasks:
    // 1) pin the current running/paused timer task to the top (only if it belongs to current tab)
    // 2) keep stable ordering for everything else (avoid items "jumping")
    const pinnedTaskId =
      pinnedTask?.id ?? timerState?.taskId ?? pausedTimer?.taskId ?? null;
    const resolvedPinned =
      (pinnedTaskId &&
        (pinnedTask ?? tasks.find((t) => t.id === pinnedTaskId))) ||
      null;

    // Only include pinned task if it belongs to the current tab
    const shouldIncludePinned =
      resolvedPinned && baseTasks.some((t) => t.id === resolvedPinned.id);
    const unpinnedTasks = shouldIncludePinned
      ? baseTasks.filter((t) => t.id !== resolvedPinned.id)
      : baseTasks;

    const indexById = new Map<string, number>();
    for (let i = 0; i < unpinnedTasks.length; i++) {
      indexById.set(unpinnedTasks[i].id, i);
    }

    const sorted = [...unpinnedTasks].sort((a, b) => {
      return (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0);
    });

    return shouldIncludePinned && resolvedPinned
      ? [resolvedPinned, ...sorted]
      : sorted;
  }, [
    activeTab,
    allCompletedTasks,
    filteredTasks,
    pausedTimer?.taskId,
    pinnedTask,
    reassignedTasks,
    taskGroups.today,
    taskGroups.tomorrow,
    taskGroups.upcoming,
    tasks,
    timerState?.taskId,
  ]);

  useEffect(() => {
    onVisibleCountChange?.(currentTasks.length);
  }, [currentTasks.length, onVisibleCountChange]);

  return (
    <div className="w-full overflow-x-hidden">
      <Card className="border-0 shadow-2xl bg-white dark:bg-gray-900 overflow-hidden">
        <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 dark:from-violet-900/20 dark:via-purple-900/20 dark:to-pink-900/20 border-b border-violet-100 dark:border-violet-800/50">
          <CardHeader className="pb-8">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center w-full">
              <div className="col-span-2 flex items-center space-x-4 min-w-0">
                <div className="p-4 bg-gradient-to-br from-violet-600 via-purple-600 to-pink-600 rounded-2xl shadow-xl">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                <div>
                  <CardTitle className="text-3xl font-bold bg-gradient-to-r from-violet-900 via-purple-900 to-pink-900 dark:from-violet-100 dark:via-purple-100 dark:to-pink-100 bg-clip-text text-transparent break-words">
                    Task Management
                  </CardTitle>
                  <CardDescription className="text-gray-700 dark:text-gray-300 text-lg mt-1 font-medium">
                    Managing tasks for{" "}
                    <span className="font-bold text-violet-700 dark:text-violet-400">
                      {clientName}
                    </span>
                  </CardDescription>
                </div>
              </div>

              <div className="col-span-3 flex justify-end">
                <div className="flex items-center bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/30 border-2 border-violet-200 dark:border-violet-700 rounded-2xl p-2 shadow-lg">
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={`rounded-xl h-12 w-12 transition-all duration-300 ${
                      viewMode === "list"
                        ? "bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 text-white shadow-lg"
                        : "text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-800/50"
                    }`}
                  >
                    <List className="h-5 w-5" />
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={`rounded-xl h-12 w-12 transition-all duration-300 ${
                      viewMode === "grid"
                        ? "bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 text-white shadow-lg"
                        : "text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-800/50"
                    }`}
                  >
                    <Grid3X3 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
        </div>

        {/* সার্চ এবং ফিল্টার */}
        <div className="flex flex-col xl:flex-row mt-5 gap-6 mb-8 items-start px-8">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-400 h-5 w-5" />
            <Input
              placeholder="Search tasks by name, category, asset, or completion link..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-14 border-2 border-violet-200 dark:border-violet-700 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 text-gray-900 dark:text-gray-50 rounded-2xl focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500 text-base shadow-lg transition-all duration-300 placeholder:text-violet-400"
            />
          </div>

          <div className="flex flex-col lg:flex-row gap-4 w-full xl:w-auto">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[200px] h-14 border-2 border-blue-200 dark:border-blue-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl text-base shadow-lg font-medium">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-2 border-blue-200 dark:border-blue-700 shadow-2xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="reassigned">Reassigned</SelectItem>
                <SelectItem value="qc_approved">QC Approved</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full lg:w-[200px] h-14 border-2 border-emerald-200 dark:border-emerald-700 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl text-base shadow-lg font-medium">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-700 shadow-2xl">
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <CardContent className="p-8 max-w-full overflow-x-hidden">
          {/* তারিখ ভিত্তিক ট্যাব */}
          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            className="w-full mb-8"
          >
            <TabsList className="grid w-full grid-cols-5 h-14 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border-2 border-violet-200 dark:border-violet-700 rounded-2xl p-1">
              <TabsTrigger
                value="today"
                className="flex items-center gap-2 rounded-xl text-base font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:via-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white transition-all duration-300"
              >
                <Clock className="h-4 w-4" />
                Today
                {taskGroups.today.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-white text-violet-600"
                  >
                    {taskGroups.today.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="tomorrow"
                className="flex items-center gap-2 rounded-xl text-base font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:via-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white transition-all duration-300"
              >
                <Calendar className="h-4 w-4" />
                Tomorrow
                {taskGroups.tomorrow.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-white text-violet-600"
                  >
                    {taskGroups.tomorrow.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="upcoming"
                className="flex items-center gap-2 rounded-xl text-base font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:via-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white transition-all duration-300"
              >
                <Calendar className="h-4 w-4" />
                Upcoming
                {taskGroups.upcoming.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-white text-violet-600"
                  >
                    {taskGroups.upcoming.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="reassigned"
                className="flex items-center gap-2 rounded-xl text-base font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:via-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white transition-all duration-300"
              >
                <CheckCircle className="h-4 w-4" />
                Reassigned
                {reassignedTasks.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-white text-violet-600"
                  >
                    {reassignedTasks.length}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="completed"
                className="flex items-center gap-2 rounded-xl text-base font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:via-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white transition-all duration-300"
              >
                <CheckCircle className="h-4 w-4" />
                Completed
                {allCompletedTasks.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 bg-white text-violet-600"
                  >
                    {allCompletedTasks.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/** ✅ Tabs content stays same, renderer moved */}
            {(
              [
                "today",
                "tomorrow",
                "upcoming",
                "reassigned",
                "completed",
              ] as const
            ).map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-6">
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {tab === "today" &&
                      `Today's Tasks - ${formatDate(new Date())}`}
                    {tab === "tomorrow" &&
                      `Tomorrow's Tasks - ${formatDate(
                        new Date(new Date().setDate(new Date().getDate() + 1))
                      )}`}
                    {tab === "upcoming" && "Upcoming Tasks"}
                    {tab === "reassigned" && "Reassigned Tasks"}
                    {tab === "completed" && "Completed Tasks"}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {tab === "today" && "Tasks due for today"}
                    {tab === "tomorrow" && "Tasks scheduled for tomorrow"}
                    {tab === "upcoming" && "Tasks scheduled for future dates"}
                    {tab === "reassigned" &&
                      "Tasks that have been reassigned and need your attention"}
                    {tab === "completed" &&
                      "Tasks that have been completed or QC approved"}
                  </p>
                </div>

                <TaskViews
                  tab={tab}
                  currentTasks={currentTasks}
                  viewMode={viewMode}
                  tasks={tasks}
                  overdueCount={overdueCount}
                  activeTab={activeTab}
                  // needed logic/handlers
                  timerState={timerState}
                  pausedTimer={pausedTimer}
                  handleStartTimer={handleStartTimer}
                  handlePauseTimer={handlePauseTimer}
                  onRequestComplete={onRequestComplete}
                  isTaskDisabled={isTaskDisabled}
                  isLocked={isLocked}
                  canReveal={canReveal}
                  isReassignedLike={isReassignedLike}
                  showReassignNote={showReassignNote}
                  hideAssetSection={hideAssetSection}
                  getDisplayUrl={getDisplayUrl}
                  // copy / reveal stuff
                  copied={copied}
                  handleCopy={handleCopy}
                  mask={mask}
                  isPasswordVisible={isPasswordVisible}
                  togglePassword={togglePassword}
                  // badges / timer formatting
                  getStatusBadge={getStatusBadge}
                  getPriorityBadge={getPriorityBadge}
                  formatTimerDisplay={formatTimerDisplay}
                  // modal control
                  setTaskToComplete={setTaskToComplete}
                  setIsCompletionConfirmOpen={setIsCompletionConfirmOpen}
                  disableVirtualization={paginationEnabled}
                />
              </TabsContent>
            ))}
          </Tabs>

          {/* টাস্ক কাউন্টার */}
          {currentTasks.length > 0 && (
            <div className="max-w-full flex flex-col lg:flex-row items-start lg:items-center justify-between pt-8 mt-8 border-t-2 border-gradient-to-r from-violet-200 to-purple-200 dark:from-violet-800 dark:to-purple-800 gap-6">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/30 dark:to-purple-900/30 px-4 py-3 rounded-2xl border-2 border-violet-200 dark:border-violet-700 shadow-lg">
                  <p className="text-lg font-bold text-gray-700 dark:text-gray-300">
                    Showing{" "}
                    <span className="text-violet-700 dark:text-violet-400 text-xl">
                      {currentTasks.length}
                    </span>{" "}
                    of{" "}
                    <span className="text-gray-900 dark:text-gray-50 text-xl">
                      {totalTasks}
                    </span>{" "}
                    tasks
                  </p>
                </div>
                {overdueCount > 0 && activeTab === "today" && (
                  <Badge
                    variant="destructive"
                    className="text-base font-bold px-4 py-2 rounded-xl shadow-lg border-2 border-red-300"
                  >
                    {overdueCount} overdue
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ReassignNoteModal
        isOpen={isReassignNoteModalOpen}
        onClose={() => setIsReassignNoteModalOpen(false)}
        note={selectedReassignNote}
      />
    </div>
  );
}
