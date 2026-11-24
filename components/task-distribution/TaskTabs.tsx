// components/task-distribution/TaskTabs.tsx

"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, Globe, Building2, CheckCircle2, Clock, AlertCircle, UserCheck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { TabContent } from "./TabContent";
import {
  CategorizedTasks,
  Agent,
  TaskAssignment,
  Task,
} from "./distribution-types";
import { groupTasksByCycle } from "@/lib/posting-task-cycles";
import { TaskListItem } from "./TaskListItem";

/**
 * Agent shape enriched with load stats (optional).
 */
type AgentWithLoad = Agent & {
  displayLabel?: string;
  activeCount?: number;
  weightedScore?: number;
  byStatus?: Record<string, number>;
};

interface TaskTabsProps {
  // 3-tab mode (Asset Creation)
  categorizedTasks?: CategorizedTasks;

  // Single-tab mode (for non–Asset Creation categories)
  singleTabTasks?: Task[];
  singleTabTitle?: string;

  // Agents
  agents: AgentWithLoad[];
  teamAgents?: AgentWithLoad[];
  allAgents?: AgentWithLoad[];

  // Shared state/handlers
  selectedTasks: Set<string>;
  selectedTasksOrder: string[];
  taskAssignments: TaskAssignment[];
  taskNotes: Record<string, string>;
  viewMode: "list" | "grid";
  onTaskSelection: (taskId: string, checked: boolean) => void;
  onSelectAllTasks: (taskIds: string[], checked: boolean) => void;
  onTaskAssignment: (
    taskId: string,
    agentId: string,
    isMultipleSelected: boolean,
    isFirstSelectedTask: boolean
  ) => void;
  onNoteChange: (taskId: string, note: string) => void;
  onViewModeChange: (mode: "list" | "grid") => void;
  onPriorityChange: (
    taskId: string,
    priority: "low" | "medium" | "high" | "urgent"
  ) => void;
  priorityUpdating: Record<string, boolean>;
}

const getTaskStatusBreakdown = (tasks: Task[], taskAssignments: TaskAssignment[]) => {
  const statusCounts = {
    assigned: 0,
    completed: 0,
    pending: 0,
    in_progress: 0,
    qa_approved: 0,
  };

  tasks.forEach((task) => {
    const assignedToId = (task as any)?.assignedToId as string | undefined;
    const isAssigned =
      taskAssignments.some((a) => a.taskId === task.id) ||
      Boolean(task.assignedTo) ||
      Boolean(assignedToId);
    
    if (isAssigned) {
      statusCounts.assigned++;
    }
    
    const normalizedStatus = (task.status ?? "")
      .toLowerCase()
      .replace(/[\s_-]/g, "");

    switch (normalizedStatus) {
      case 'completed':
        statusCounts.completed++;
        break;
      case 'pending':
        statusCounts.pending++;
        break;
      case 'inprogress':
        statusCounts.in_progress++;
        break;
      case 'qaapproved':
      case 'qcapproved':
        statusCounts.qa_approved++;
        break;
      default:
        if (!isAssigned) {
          statusCounts.pending++;
        }
        break;
    }
  });

  return statusCounts;
};

const StatusBreakdownBadges = ({
  statusCounts,
  totalTasks,
  className,
}: {
  statusCounts: ReturnType<typeof getTaskStatusBreakdown>;
  totalTasks: number;
  className?: string;
}) => {
  // If all tasks are assigned, show green "All Assigned" badge alongside status breakdown
  if (statusCounts.assigned === totalTasks && totalTasks > 0) {
    // Build badges list with All Assigned first, then status breakdown
    const allBadges = [];
    allBadges.push(
      <Badge key="all-assigned" variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs font-semibold dark:bg-green-900/40 dark:text-green-300 dark:border-green-700">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        All Assigned
      </Badge>
    );
    
    // Add status breakdown badges even when all assigned
    if (statusCounts.completed > 0) {
      allBadges.push(
        <Badge key="completed" variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs dark:bg-green-950/40 dark:text-green-300 dark:border-green-800">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {statusCounts.completed} Completed
        </Badge>
      );
    }
    if (statusCounts.in_progress > 0) {
      allBadges.push(
        <Badge key="in_progress" variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
          <Clock className="w-3 h-3 mr-1" />
          {statusCounts.in_progress} In Progress
        </Badge>
      );
    }
    if (statusCounts.pending > 0) {
      allBadges.push(
        <Badge key="pending" variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs dark:bg-muted/40 dark:text-foreground dark:border-border">
          <AlertCircle className="w-3 h-3 mr-1" />
          {statusCounts.pending} Pending
        </Badge>
      );
    }
    if (statusCounts.qa_approved > 0) {
      allBadges.push(
        <Badge key="qa_approved" variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          {statusCounts.qa_approved} QC Approved
        </Badge>
      );
    }
    
    return (
      <div className={`flex flex-wrap gap-1 mt-2 ${className ?? ""}`.trim()}>
        {allBadges}
      </div>
    );
  }

  const badges = [];
  
  if (statusCounts.assigned > 0) {
    badges.push(
      <Badge key="assigned" variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
        <UserCheck className="w-3 h-3 mr-1" />
        {statusCounts.assigned} Assigned
      </Badge>
    );
  }
  
  if (statusCounts.completed > 0) {
    badges.push(
      <Badge key="completed" variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs dark:bg-green-950/40 dark:text-green-300 dark:border-green-800">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {statusCounts.completed} Completed
      </Badge>
    );
  }
  
  if (statusCounts.in_progress > 0) {
    badges.push(
      <Badge key="in_progress" variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
        <Clock className="w-3 h-3 mr-1" />
        {statusCounts.in_progress} In Progress
      </Badge>
    );
  }
  
  if (statusCounts.pending > 0) {
    badges.push(
      <Badge key="pending" variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs dark:bg-muted/40 dark:text-foreground dark:border-border">
        <AlertCircle className="w-3 h-3 mr-1" />
        {statusCounts.pending} Pending
      </Badge>
    );
  }
  
  if (statusCounts.qa_approved > 0) {
    badges.push(
      <Badge key="qa_approved" variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        {statusCounts.qa_approved} QC Approved
      </Badge>
    );
  }

  return badges.length > 0 ? (
    <div className={`flex flex-wrap gap-1 mt-2 ${className ?? ""}`.trim()}>
      {badges}
    </div>
  ) : null;
};

/**
 * Small helper to normalize & sort agents by load (least → most).
 */
function prepAgents(list: AgentWithLoad[] = []) {
  const enriched = list.map((a) => ({
    ...a,
    activeCount: a.activeCount ?? 0,
    weightedScore: a.weightedScore ?? 0,
    byStatus: a.byStatus ?? {},
  }));
  enriched.sort(
    (x, y) =>
      (x.weightedScore ?? 0) - (y.weightedScore ?? 0) ||
      (x.activeCount ?? 0) - (y.activeCount ?? 0)
  );
  return enriched;
}

export function TaskTabs({
  categorizedTasks,
  singleTabTasks,
  singleTabTitle,
  agents,
  teamAgents = [],
  allAgents = [],
  selectedTasks,
  selectedTasksOrder,
  taskAssignments,
  taskNotes,
  viewMode,
  onTaskSelection,
  onSelectAllTasks,
  onTaskAssignment,
  onNoteChange,
  onViewModeChange,
  onPriorityChange,
  priorityUpdating,
}: TaskTabsProps) {
  const [activeTab, setActiveTab] = useState("social_site");
  
  const agentsWithLabels = useMemo(() => prepAgents(agents), [agents]);
  const teamAgentsWithLabels = useMemo(
    () => prepAgents(teamAgents),
    [teamAgents]
  );
  const allAgentsWithLabels = useMemo(() => prepAgents(allAgents), [allAgents]);

  // -----------------------------
  // SINGLE-TAB MODE (e.g., Graphics Design / Blog Posting / etc.)
  // -----------------------------
  if (singleTabTasks) {
    const cycleGroups = groupTasksByCycle(singleTabTasks);
    const useCycles =
      cycleGroups.length > 1 ||
      (cycleGroups.length === 1 && cycleGroups[0].cycle > 0);

    const renderTaskRow = (task: Task, isNested = false) => {
      const isSelected = selectedTasks.has(task.id);
      const assignment = taskAssignments.find((a) => a.taskId === task.id);
      const firstSelectedTaskId = selectedTasksOrder.find((id) =>
        selectedTasks.has(id)
      );
      const isFirstSelectedTask = firstSelectedTaskId === task.id;
      const isMultipleSelected = selectedTasks.size > 1;

      return (
        <TaskListItem
          key={task.id}
          task={task}
          siteType="social_site" // Default for single tab mode
          teamAgents={teamAgents ?? []}
          allAgents={allAgents ?? []}
          agents={agents}
          isSelected={isSelected}
          assignment={assignment}
          isFirstSelectedTask={isFirstSelectedTask}
          isMultipleSelected={isMultipleSelected}
          note={taskNotes[task.id] || ""}
          onTaskSelection={onTaskSelection}
          onTaskAssignment={onTaskAssignment}
          onNoteChange={(note) => onNoteChange(task.id, note)}
          onPriorityChange={onPriorityChange}
          priorityUpdating={priorityUpdating[task.id]}
          isNested={isNested}
        />
      );
    };

    return (
      <div className="w-full space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card">
          {useCycles && cycleGroups.length ? (
            <Accordion type="multiple" className="divide-y divide-slate-200 dark:divide-border">
              {cycleGroups.map((group) => {
                const ids = group.tasks.map((t) => t.id);
                const allSelected = ids.every((id) => selectedTasks.has(id));
                const someSelected = ids.some((id) => selectedTasks.has(id));
                const assignedInGroup = group.tasks.filter(
                  (t) =>
                    taskAssignments.some((a) => a.taskId === t.id) ||
                    Boolean(t.assignedTo) ||
                    Boolean((t as any)?.assignedToId)
                ).length;
                const dueDate = group.tasks[0]?.dueDate;
                const headerLabel = group.isManual 
                  ? `Manual ${group.label}` 
                  : (group.label ?? "").trim() || group.baseName || "Task Cycle";
                const statusBreakdown = getTaskStatusBreakdown(group.tasks, taskAssignments);

                return (
                  <AccordionItem
                    key={group.isManual ? `manual_${group.label || `cycle-${group.cycle || "na"}`}` : (group.label || `cycle-${group.cycle || "na"}`)}
                    value={group.isManual ? `manual_${group.label || `cycle-${group.cycle || "na"}`}` : (group.label || `cycle-${group.cycle || "na"}`)}
                    className="border-b border-slate-200 last:border-0 dark:border-border"
                  >
                    <div className="flex items-stretch">
                      <div className="flex items-center px-4 py-4">
                        <Checkbox
                          checked={allSelected}
                          ref={(el) => {
                            if (el)
                              (el as any).indeterminate =
                                someSelected && !allSelected;
                          }}
                          onCheckedChange={() =>
                            onSelectAllTasks(ids, !allSelected)
                          }
                          className="border-slate-300 dark:border-border"
                        />
                      </div>
                      <AccordionTrigger className="flex-1 px-4 py-4 hover:bg-slate-50 hover:no-underline min-h-[88px] dark:hover:bg-muted/40">
                        <div className="flex w-full items-center gap-4">
                          <div className="min-w-[240px]">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-foreground">
                                Task Cycle {headerLabel}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {group.tasks.length} task
                                {group.tasks.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-muted-foreground">
                              {group.cycle > 0 ? `Cycle ${group.cycle}` : "Cycle —"}
                              {dueDate
                                ? ` • Due ${format(new Date(dueDate), "MMM d, yyyy")}`
                                : ""}
                            </div>
                          </div>

                          <div className="flex-1 flex justify-center">
                            <StatusBreakdownBadges
                              statusCounts={statusBreakdown}
                              totalTasks={group.tasks.length}
                              className="mt-0 justify-center"
                            />
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <div className="text-sm font-semibold text-slate-700 dark:text-foreground">
                                {assignedInGroup} / {group.tasks.length}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-muted-foreground">Assigned</div>
                            </div>
                            {someSelected && (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200 text-xs dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              >
                                {ids.filter((id) => selectedTasks.has(id)).length} selected
                              </Badge>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                    </div>
                    <AccordionContent className="bg-slate-50/60 dark:bg-muted/40">
                      <div className="p-4 space-y-3">
                        {group.tasks.map((task) => renderTaskRow(task, true))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <div className="p-4 space-y-3">
              {singleTabTasks.map((task) => renderTaskRow(task))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // -----------------------------
  // 3-TAB MODE (Asset Creation)
  // -----------------------------
  if (categorizedTasks) {
    const safe = {
      social_site: categorizedTasks?.social_site ?? [],
      web2_site: categorizedTasks?.web2_site ?? [],
      other_asset: categorizedTasks?.other_asset ?? [],
    };

    // Calculate task IDs for current tab only
    const getCurrentTabTasks = () => {
      switch (activeTab) {
        case "social_site":
          return safe.social_site;
        case "web2_site":
          return safe.web2_site;
        case "other_asset":
          return safe.other_asset;
        default:
          return safe.social_site;
      }
    };
    
    const currentTabTasks = getCurrentTabTasks();
    const currentTabTaskIds = currentTabTasks.map(task => task.id);
    const allCurrentTabSelected = currentTabTaskIds.length > 0 && currentTabTaskIds.every(id => selectedTasks.has(id));
    const someCurrentTabSelected = currentTabTaskIds.some(id => selectedTasks.has(id));

    // Minimal tab styles
    const baseTrigger =
      "group relative inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold border transition-colors data-[state=active]:bg-blue-600 data-[state=active]:text-white border-slate-200 dark:border-border";

    return (
      <div className="w-full space-y-3">
        {/* Master "Select All for Current Tab" control */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-border dark:bg-card">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <Checkbox
                checked={allCurrentTabSelected}
                ref={(el) => {
                  if (el)
                    (el as any).indeterminate =
                      someCurrentTabSelected && !allCurrentTabSelected;
                }}
                onCheckedChange={() => onSelectAllTasks(currentTabTaskIds, !allCurrentTabSelected)}
                className="border-slate-300 dark:border-border"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-foreground">
                Select All
              </span>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs dark:bg-muted/40 dark:text-foreground dark:border-border">
                {currentTabTaskIds.length} tasks
              </Badge>
              {someCurrentTabSelected && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                  {currentTabTaskIds.filter(id => selectedTasks.has(id)).length} selected
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tabs header */}
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-border dark:bg-card">
            <TabsList className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3 bg-transparent p-0">
              {/* Social Sites */}
              <TabsTrigger value="social_site" className={baseTrigger}>
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-md bg-indigo-50 text-indigo-700 p-1.5 dark:bg-indigo-950/40 dark:text-indigo-300">
                    <Users className="h-4 w-4" aria-hidden />
                  </span>
                  <span>Social Sites</span>
                </span>
                <Badge
                  variant="outline"
                  className="ml-1 bg-white text-slate-900 dark:bg-card dark:text-foreground"
                >
                  {safe.social_site.length}
                </Badge>
              </TabsTrigger>

              {/* Web2 Sites */}
              <TabsTrigger value="web2_site" className={baseTrigger}>
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-md bg-sky-50 text-sky-700 p-1.5 dark:bg-sky-950/40 dark:text-sky-300">
                    <Globe className="h-4 w-4" aria-hidden />
                  </span>
                  <span>Web2 Sites</span>
                </span>
                <Badge
                  variant="outline"
                  className="ml-1 bg-white text-slate-900 dark:bg-card dark:text-foreground"
                >
                  {safe.web2_site.length}
                </Badge>
              </TabsTrigger>

              {/* Other Assets */}
              <TabsTrigger value="other_asset" className={baseTrigger}>
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-md bg-slate-50 text-slate-700 p-1.5 dark:bg-muted/40 dark:text-foreground">
                    <Building2 className="h-4 w-4" aria-hidden />
                  </span>
                  <span>Other Assets</span>
                </span>
                <Badge
                  variant="outline"
                  className="ml-1 bg-white text-slate-900 dark:bg-card dark:text-foreground"
                >
                  {safe.other_asset.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab panes with cycle-based accordions */}
          <TabsContent value="social_site" className="mt-0">
            <div className="w-full space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card">
                {(() => {
                  const cycleGroups = groupTasksByCycle(safe.social_site);
                  const useCycles =
                    cycleGroups.length > 1 ||
                    (cycleGroups.length === 1 && cycleGroups[0].cycle > 0);

                  const renderTaskRow = (task: Task, isNested = false) => {
                    const isSelected = selectedTasks.has(task.id);
                    const assignment = taskAssignments.find(
                      (a) => a.taskId === task.id
                    );
                    const firstSelectedTaskId = selectedTasksOrder.find((id) =>
                      selectedTasks.has(id)
                    );
                    const isFirstSelectedTask = firstSelectedTaskId === task.id;
                    const isMultipleSelected = selectedTasks.size > 1;

                    return (
                      <TaskListItem
                        key={task.id}
                        task={task}
                        siteType="social_site"
                        teamAgents={teamAgentsWithLabels}
                        allAgents={allAgentsWithLabels}
                        agents={agentsWithLabels}
                        isSelected={isSelected}
                        assignment={assignment}
                        isFirstSelectedTask={isFirstSelectedTask}
                        isMultipleSelected={isMultipleSelected}
                        note={taskNotes[task.id] || ""}
                        onTaskSelection={onTaskSelection}
                        onTaskAssignment={onTaskAssignment}
                        onNoteChange={(note) => onNoteChange(task.id, note)}
                        onPriorityChange={onPriorityChange}
                        priorityUpdating={priorityUpdating[task.id]}
                        isNested={isNested}
                      />
                    );
                  };

                  return useCycles && cycleGroups.length ? (
                    <Accordion
                      type="multiple"
                      className="divide-y divide-slate-200 dark:divide-border"
                    >
                      {cycleGroups.map((group) => {
                        const ids = group.tasks.map((t) => t.id);
                        const allSelected = ids.every((id) =>
                          selectedTasks.has(id)
                        );
                        const someSelected = ids.some((id) =>
                          selectedTasks.has(id)
                        );
                        const assignedInGroup = group.tasks.filter(
                          (t) =>
                            taskAssignments.some((a) => a.taskId === t.id) ||
                            Boolean(t.assignedTo) ||
                            Boolean((t as any)?.assignedToId)
                        ).length;
                        const dueDate = group.tasks[0]?.dueDate;
                        const headerLabel = group.isManual 
                          ? `Manual ${group.label}` 
                          : (group.label ?? "").trim() ||
                          group.baseName ||
                          "Task Cycle";
                        const statusBreakdown = getTaskStatusBreakdown(group.tasks, taskAssignments);

                        return (
                          <AccordionItem
                            key={group.isManual ? `manual_${group.label || `cycle-${group.cycle || "na"}`}` : (group.label || `cycle-${group.cycle || "na"}`)}
                            value={group.isManual ? `manual_${group.label || `cycle-${group.cycle || "na"}`}` : (group.label || `cycle-${group.cycle || "na"}`)}
                            className="border-b border-slate-200 last:border-0 dark:border-border"
                          >
                            <div className="flex items-stretch">
                              <div className="flex items-center px-4 py-4">
                                <Checkbox
                                  checked={allSelected}
                                  ref={(el) => {
                                    if (el)
                                      (el as any).indeterminate =
                                        someSelected && !allSelected;
                                  }}
                                  onCheckedChange={() =>
                                    onSelectAllTasks(ids, !allSelected)
                                  }
                                  className="border-slate-300 dark:border-border"
                                />
                              </div>
                              <AccordionTrigger className="flex-1 px-4 py-4 hover:bg-slate-50 hover:no-underline min-h-[88px] dark:hover:bg-muted/40">
                                <div className="flex w-full items-center gap-4">
                                  <div className="min-w-[240px]">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-900 dark:text-foreground">
                                        {headerLabel}
                                      </span>
                                      <Badge variant="outline" className="text-xs">
                                        {group.tasks.length} task
                                        {group.tasks.length !== 1 ? "s" : ""}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-muted-foreground">
                                      {group.cycle > 0 ? `Cycle ${group.cycle}` : "Cycle —"}
                                      {dueDate
                                        ? ` • Due ${format(new Date(dueDate), "MMM d, yyyy")}`
                                        : ""}
                                    </div>
                                  </div>

                                  <div className="flex-1 flex justify-center">
                                    <StatusBreakdownBadges
                                      statusCounts={statusBreakdown}
                                      totalTasks={group.tasks.length}
                                      className="mt-0 justify-center"
                                    />
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right">
                                      <div className="text-sm font-semibold text-slate-700 dark:text-foreground">
                                        {assignedInGroup} / {group.tasks.length}
                                      </div>
                                      <div className="text-xs text-slate-500 dark:text-muted-foreground">Assigned</div>
                                    </div>
                                    {someSelected && (
                                      <Badge
                                        variant="outline"
                                        className="bg-blue-50 text-blue-700 border-blue-200 text-xs dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                      >
                                        {ids.filter((id) => selectedTasks.has(id)).length} selected
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </AccordionTrigger>
                            </div>
                            <AccordionContent className="bg-slate-50/60 dark:bg-muted/40">
                              <div className="p-4 space-y-3">
                                {group.tasks.map((task) =>
                                  renderTaskRow(task, true)
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  ) : (
                    <div className="p-4 space-y-3">
                      {safe.social_site.map((task) => renderTaskRow(task))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="web2_site" className="mt-0">
            <div className="w-full space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card">
                {(() => {
                  const cycleGroups = groupTasksByCycle(safe.web2_site);
                  const useCycles =
                    cycleGroups.length > 1 ||
                    (cycleGroups.length === 1 && cycleGroups[0].cycle > 0);

                  const renderTaskRow = (task: Task, isNested = false) => {
                    const isSelected = selectedTasks.has(task.id);
                    const assignment = taskAssignments.find(
                      (a) => a.taskId === task.id
                    );
                    const firstSelectedTaskId = selectedTasksOrder.find((id) =>
                      selectedTasks.has(id)
                    );
                    const isFirstSelectedTask = firstSelectedTaskId === task.id;
                    const isMultipleSelected = selectedTasks.size > 1;

                    return (
                      <TaskListItem
                        key={task.id}
                        task={task}
                        siteType="web2_site"
                        teamAgents={teamAgentsWithLabels}
                        allAgents={allAgentsWithLabels}
                        agents={agentsWithLabels}
                        isSelected={isSelected}
                        assignment={assignment}
                        isFirstSelectedTask={isFirstSelectedTask}
                        isMultipleSelected={isMultipleSelected}
                        note={taskNotes[task.id] || ""}
                        onTaskSelection={onTaskSelection}
                        onTaskAssignment={onTaskAssignment}
                        onNoteChange={(note) => onNoteChange(task.id, note)}
                        onPriorityChange={onPriorityChange}
                        priorityUpdating={priorityUpdating[task.id]}
                        isNested={isNested}
                      />
                    );
                  };

                  return useCycles && cycleGroups.length ? (
                    <Accordion
                      type="multiple"
                      className="divide-y divide-slate-200 dark:divide-border"
                    >
                      {cycleGroups.map((group) => {
                        const ids = group.tasks.map((t) => t.id);
                        const allSelected = ids.every((id) =>
                          selectedTasks.has(id)
                        );
                        const someSelected = ids.some((id) =>
                          selectedTasks.has(id)
                        );
                        const assignedInGroup = group.tasks.filter(
                          (t) =>
                            taskAssignments.some((a) => a.taskId === t.id) ||
                            Boolean(t.assignedTo) ||
                            Boolean((t as any)?.assignedToId)
                        ).length;
                        const dueDate = group.tasks[0]?.dueDate;
                        const headerLabel = group.isManual 
                          ? `Manual ${group.label}` 
                          : (group.label ?? "").trim() ||
                          group.baseName ||
                          "Task Cycle";
                        const statusBreakdown = getTaskStatusBreakdown(group.tasks, taskAssignments);

                        return (
                          <AccordionItem
                            key={group.isManual ? `manual_${group.label || `cycle-${group.cycle || "na"}`}` : (group.label || `cycle-${group.cycle || "na"}`)}
                            value={group.isManual ? `manual_${group.label || `cycle-${group.cycle || "na"}`}` : (group.label || `cycle-${group.cycle || "na"}`)}
                            className="border-b border-slate-200 last:border-0 dark:border-border"
                          >
                            <div className="flex items-stretch">
                              <div className="flex items-center px-4 py-4">
                                <Checkbox
                                  checked={allSelected}
                                  ref={(el) => {
                                    if (el)
                                      (el as any).indeterminate =
                                        someSelected && !allSelected;
                                  }}
                                  onCheckedChange={() =>
                                    onSelectAllTasks(ids, !allSelected)
                                  }
                                  className="border-slate-300 dark:border-border"
                                />
                              </div>
                              <AccordionTrigger className="flex-1 px-4 py-4 hover:bg-slate-50 hover:no-underline min-h-[88px] dark:hover:bg-muted/40">
                                <div className="flex w-full items-center gap-4">
                                  <div className="min-w-[240px]">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-900 dark:text-foreground">
                                        {headerLabel}
                                      </span>
                                      <Badge variant="outline" className="text-xs">
                                        {group.tasks.length} task
                                        {group.tasks.length !== 1 ? "s" : ""}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-muted-foreground">
                                      {group.cycle > 0 ? `Cycle ${group.cycle}` : "Cycle —"}
                                      {dueDate
                                        ? ` • Due ${format(new Date(dueDate), "MMM d, yyyy")}`
                                        : ""}
                                    </div>
                                  </div>

                                  <div className="flex-1 flex justify-center">
                                    <StatusBreakdownBadges
                                      statusCounts={statusBreakdown}
                                      totalTasks={group.tasks.length}
                                      className="mt-0 justify-center"
                                    />
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right">
                                      <div className="text-sm font-semibold text-slate-700 dark:text-foreground">
                                        {assignedInGroup} / {group.tasks.length}
                                      </div>
                                      <div className="text-xs text-slate-500 dark:text-muted-foreground">Assigned</div>
                                    </div>
                                    {someSelected && (
                                      <Badge
                                        variant="outline"
                                        className="bg-blue-50 text-blue-700 border-blue-200 text-xs dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                      >
                                        {ids.filter((id) => selectedTasks.has(id)).length} selected
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </AccordionTrigger>
                            </div>
                            <AccordionContent className="bg-slate-50/60 dark:bg-muted/40">
                              <div className="p-4 space-y-3">
                                {group.tasks.map((task) =>
                                  renderTaskRow(task, true)
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  ) : (
                    <div className="p-4 space-y-3">
                      {safe.web2_site.map((task) => renderTaskRow(task))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="other_asset" className="mt-0">
            <div className="w-full space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-border dark:bg-card">
                {(() => {
                  const cycleGroups = groupTasksByCycle(safe.other_asset);
                  const useCycles =
                    cycleGroups.length > 1 ||
                    (cycleGroups.length === 1 && cycleGroups[0].cycle > 0);

                  const renderTaskRow = (task: Task, isNested = false) => {
                    const isSelected = selectedTasks.has(task.id);
                    const assignment = taskAssignments.find(
                      (a) => a.taskId === task.id
                    );
                    const firstSelectedTaskId = selectedTasksOrder.find((id) =>
                      selectedTasks.has(id)
                    );
                    const isFirstSelectedTask = firstSelectedTaskId === task.id;
                    const isMultipleSelected = selectedTasks.size > 1;

                    return (
                      <TaskListItem
                        key={task.id}
                        task={task}
                        siteType="other_asset"
                        teamAgents={teamAgentsWithLabels}
                        allAgents={allAgentsWithLabels}
                        agents={agentsWithLabels}
                        isSelected={isSelected}
                        assignment={assignment}
                        isFirstSelectedTask={isFirstSelectedTask}
                        isMultipleSelected={isMultipleSelected}
                        note={taskNotes[task.id] || ""}
                        onTaskSelection={onTaskSelection}
                        onTaskAssignment={onTaskAssignment}
                        onNoteChange={(note) => onNoteChange(task.id, note)}
                        onPriorityChange={onPriorityChange}
                        priorityUpdating={priorityUpdating[task.id]}
                        isNested={isNested}
                      />
                    );
                  };

                  return useCycles && cycleGroups.length ? (
                    <Accordion
                      type="multiple"
                      className="divide-y divide-slate-200 dark:divide-border"
                    >
                      {cycleGroups.map((group) => {
                        const ids = group.tasks.map((t) => t.id);
                        const allSelected = ids.every((id) =>
                          selectedTasks.has(id)
                        );
                        const someSelected = ids.some((id) =>
                          selectedTasks.has(id)
                        );
                        const assignedInGroup = group.tasks.filter(
                          (t) =>
                            taskAssignments.some((a) => a.taskId === t.id) ||
                            Boolean(t.assignedTo) ||
                            Boolean((t as any)?.assignedToId)
                        ).length;
                        const dueDate = group.tasks[0]?.dueDate;
                        const headerLabel = group.isManual 
                          ? `Manual ${group.label}` 
                          : (group.label ?? "").trim() ||
                          group.baseName ||
                          "Task Cycle";
                        const statusBreakdown = getTaskStatusBreakdown(group.tasks, taskAssignments);

                        return (
                          <AccordionItem
                            key={group.isManual ? `manual_${group.label || `cycle-${group.cycle || "na"}`}` : (group.label || `cycle-${group.cycle || "na"}`)}
                            value={group.isManual ? `manual_${group.label || `cycle-${group.cycle || "na"}`}` : (group.label || `cycle-${group.cycle || "na"}`)}
                            className="border-b border-slate-200 last:border-0 dark:border-border"
                          >
                            <div className="flex items-stretch">
                              <div className="flex items-center px-4 py-4">
                                <Checkbox
                                  checked={allSelected}
                                  ref={(el) => {
                                    if (el)
                                      (el as any).indeterminate =
                                        someSelected && !allSelected;
                                  }}
                                  onCheckedChange={() =>
                                    onSelectAllTasks(ids, !allSelected)
                                  }
                                  className="border-slate-300 dark:border-border"
                                />
                              </div>
                              <AccordionTrigger className="flex-1 px-4 py-4 hover:bg-slate-50 hover:no-underline min-h-[88px] dark:hover:bg-muted/40">
                                <div className="flex w-full items-center gap-4">
                                  <div className="min-w-[240px]">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-900 dark:text-foreground">
                                        {headerLabel}
                                      </span>
                                      <Badge variant="outline" className="text-xs">
                                        {group.tasks.length} task
                                        {group.tasks.length !== 1 ? "s" : ""}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-muted-foreground">
                                      {group.cycle > 0 ? `Cycle ${group.cycle}` : "Cycle —"}
                                      {dueDate
                                        ? ` • Due ${format(new Date(dueDate), "MMM d, yyyy")}`
                                        : ""}
                                    </div>
                                  </div>

                                  <div className="flex-1 flex justify-center">
                                    <StatusBreakdownBadges
                                      statusCounts={statusBreakdown}
                                      totalTasks={group.tasks.length}
                                      className="mt-0 justify-center"
                                    />
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-right">
                                      <div className="text-sm font-semibold text-slate-700 dark:text-foreground">
                                        {assignedInGroup} / {group.tasks.length}
                                      </div>
                                      <div className="text-xs text-slate-500 dark:text-muted-foreground">Assigned</div>
                                    </div>
                                    {someSelected && (
                                      <Badge
                                        variant="outline"
                                        className="bg-blue-50 text-blue-700 border-blue-200 text-xs dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                      >
                                        {ids.filter((id) => selectedTasks.has(id)).length} selected
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </AccordionTrigger>
                            </div>
                            <AccordionContent className="bg-slate-50/60 dark:bg-muted/40">
                              <div className="p-4 space-y-3">
                                {group.tasks.map((task) =>
                                  renderTaskRow(task, true)
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  ) : (
                    <div className="p-4 space-y-3">
                      {safe.other_asset.map((task) => renderTaskRow(task))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return null;
}
