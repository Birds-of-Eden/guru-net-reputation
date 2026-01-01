// components/task-distribution/TaskTabs.tsx

"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, Globe, Building2, CheckCircle2 } from "lucide-react";
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

type CycleGroup = {
  cycle: number;
  label: string;
  baseName: string;
  tasks: Task[];
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
}

const extractCycleInfo = (taskName: string) => {
  const match = taskName.match(/^(.+?)\\s+-(\\d+)$/);
  if (match) {
    return {
      baseName: match[1].trim(),
      cycle: parseInt(match[2], 10),
      cycleLabel: `-${match[2]}`,
    };
  }
  return { baseName: taskName, cycle: 0, cycleLabel: "" };
};

const groupTasksByCycle = (tasks: Task[]): CycleGroup[] => {
  const grouped: Record<string, CycleGroup> = {};

  tasks.forEach((task) => {
    const cycleInfo = extractCycleInfo(task.name);
    const key = cycleInfo.cycleLabel || "_nocycle";

    if (!grouped[key]) {
      grouped[key] = {
        cycle: cycleInfo.cycle,
        label: cycleInfo.cycleLabel,
        baseName: cycleInfo.baseName,
        tasks: [],
      };
    }

    grouped[key].tasks.push(task);
  });

  return Object.values(grouped).sort((a, b) => {
    if (a.cycle === 0) return 1;
    if (b.cycle === 0) return -1;
    return a.cycle - b.cycle;
  });
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
          isNested={isNested}
        />
      );
    };

    return (
      <div className="w-full space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto pr-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {useCycles && cycleGroups.length ? (
            <Accordion type="multiple" className="divide-y divide-slate-200">
              {cycleGroups.map((group) => {
                const ids = group.tasks.map((t) => t.id);
                const allSelected = ids.every((id) => selectedTasks.has(id));
                const someSelected = ids.some((id) => selectedTasks.has(id));
                const assignedInGroup = group.tasks.filter((t) =>
                  taskAssignments.some((a) => a.taskId === t.id)
                ).length;
                const dueDate = group.tasks[0]?.dueDate;
                const headerLabel =
                  (group.label ?? "").trim() || group.baseName || "Task Cycle";

                return (
                  <AccordionItem
                    key={group.label || `cycle-${group.cycle || "na"}`}
                    value={group.label || `cycle-${group.cycle || "na"}`}
                    className="border-b border-slate-200 last:border-0"
                  >
                    <div className="flex items-stretch">
                      <div className="flex items-center px-4 py-3">
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
                          className="border-slate-300"
                        />
                      </div>
                      <AccordionTrigger className="flex-1 px-4 py-3 hover:bg-slate-50 hover:no-underline">
                        <div className="flex items-center gap-3 flex-1 text-left">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">
                                {headerLabel}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {group.tasks.length} task
                                {group.tasks.length !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            <div className="text-xs text-slate-500">
                              {group.cycle > 0
                                ? `Cycle ${group.cycle}`
                                : "Cycle —"}
                              {dueDate
                                ? ` • Due ${format(
                                    new Date(dueDate),
                                    "MMM d, yyyy"
                                  )}`
                                : ""}
                            </div>
                          </div>
                          {someSelected && (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                            >
                              {ids.filter((id) => selectedTasks.has(id)).length}{" "}
                              selected
                            </Badge>
                          )}
                          {assignedInGroup > 0 && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                            >
                              {assignedInGroup} assigned
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                    </div>
                    <AccordionContent className="bg-slate-50/60">
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
      "group relative inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold border transition-colors data-[state=active]:bg-blue-600 data-[state=active]:text-white border-slate-200";

    return (
      <div className="w-full space-y-3">
        {/* Master "Select All for Current Tab" control */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
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
                className="border-slate-300"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">
                Select All
              </span>
              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-xs">
                {currentTabTaskIds.length} tasks
              </Badge>
              {someCurrentTabSelected && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                  {currentTabTaskIds.filter(id => selectedTasks.has(id)).length} selected
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tabs header */}
          <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <TabsList className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3 bg-transparent p-0">
              {/* Social Sites */}
              <TabsTrigger value="social_site" className={baseTrigger}>
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-md bg-indigo-50 text-indigo-700 p-1.5">
                    <Users className="h-4 w-4" aria-hidden />
                  </span>
                  <span>Social Sites</span>
                </span>
                <Badge
                  variant="outline"
                  className="ml-1 bg-white text-slate-900"
                >
                  {safe.social_site.length}
                </Badge>
              </TabsTrigger>

              {/* Web2 Sites */}
              <TabsTrigger value="web2_site" className={baseTrigger}>
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-md bg-sky-50 text-sky-700 p-1.5">
                    <Globe className="h-4 w-4" aria-hidden />
                  </span>
                  <span>Web2 Sites</span>
                </span>
                <Badge
                  variant="outline"
                  className="ml-1 bg-white text-slate-900"
                >
                  {safe.web2_site.length}
                </Badge>
              </TabsTrigger>

              {/* Other Assets */}
              <TabsTrigger value="other_asset" className={baseTrigger}>
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center rounded-md bg-slate-50 text-slate-700 p-1.5">
                    <Building2 className="h-4 w-4" aria-hidden />
                  </span>
                  <span>Other Assets</span>
                </span>
                <Badge
                  variant="outline"
                  className="ml-1 bg-white text-slate-900"
                >
                  {safe.other_asset.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab panes with cycle-based accordions */}
          <TabsContent value="social_site" className="mt-0">
            <div className="w-full space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto pr-2">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
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
                        isNested={isNested}
                      />
                    );
                  };

                  return useCycles && cycleGroups.length ? (
                    <Accordion
                      type="multiple"
                      className="divide-y divide-slate-200"
                    >
                      {cycleGroups.map((group) => {
                        const ids = group.tasks.map((t) => t.id);
                        const allSelected = ids.every((id) =>
                          selectedTasks.has(id)
                        );
                        const someSelected = ids.some((id) =>
                          selectedTasks.has(id)
                        );
                        const assignedInGroup = group.tasks.filter((t) =>
                          taskAssignments.some((a) => a.taskId === t.id)
                        ).length;
                        const dueDate = group.tasks[0]?.dueDate;
                        const headerLabel =
                          (group.label ?? "").trim() ||
                          group.baseName ||
                          "Task Cycle";

                        return (
                          <AccordionItem
                            key={group.label || `cycle-${group.cycle || "na"}`}
                            value={
                              group.label || `cycle-${group.cycle || "na"}`
                            }
                            className="border-b border-slate-200 last:border-0"
                          >
                            <div className="flex items-stretch">
                              <div className="flex items-center px-4 py-3">
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
                                  className="border-slate-300"
                                />
                              </div>
                              <AccordionTrigger className="flex-1 px-4 py-3 hover:bg-slate-50 hover:no-underline">
                                <div className="flex items-center gap-3 flex-1 text-left">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-900">
                                        {headerLabel}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {group.tasks.length} task
                                        {group.tasks.length !== 1 ? "s" : ""}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {group.cycle > 0
                                        ? `Cycle ${group.cycle}`
                                        : "Cycle —"}
                                      {dueDate
                                        ? ` • Due ${format(
                                            new Date(dueDate),
                                            "MMM d, yyyy"
                                          )}`
                                        : ""}
                                    </div>
                                  </div>
                                  {someSelected && (
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                                    >
                                      {
                                        ids.filter((id) =>
                                          selectedTasks.has(id)
                                        ).length
                                      }{" "}
                                      selected
                                    </Badge>
                                  )}
                                  {assignedInGroup > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                                    >
                                      {assignedInGroup} assigned
                                    </Badge>
                                  )}
                                </div>
                              </AccordionTrigger>
                            </div>
                            <AccordionContent className="bg-slate-50/60">
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
            <div className="w-full space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto pr-2">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
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
                        isNested={isNested}
                      />
                    );
                  };

                  return useCycles && cycleGroups.length ? (
                    <Accordion
                      type="multiple"
                      className="divide-y divide-slate-200"
                    >
                      {cycleGroups.map((group) => {
                        const ids = group.tasks.map((t) => t.id);
                        const allSelected = ids.every((id) =>
                          selectedTasks.has(id)
                        );
                        const someSelected = ids.some((id) =>
                          selectedTasks.has(id)
                        );
                        const assignedInGroup = group.tasks.filter((t) =>
                          taskAssignments.some((a) => a.taskId === t.id)
                        ).length;
                        const dueDate = group.tasks[0]?.dueDate;
                        const headerLabel =
                          (group.label ?? "").trim() ||
                          group.baseName ||
                          "Task Cycle";

                        return (
                          <AccordionItem
                            key={group.label || `cycle-${group.cycle || "na"}`}
                            value={
                              group.label || `cycle-${group.cycle || "na"}`
                            }
                            className="border-b border-slate-200 last:border-0"
                          >
                            <div className="flex items-stretch">
                              <div className="flex items-center px-4 py-3">
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
                                  className="border-slate-300"
                                />
                              </div>
                              <AccordionTrigger className="flex-1 px-4 py-3 hover:bg-slate-50 hover:no-underline">
                                <div className="flex items-center gap-3 flex-1 text-left">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-900">
                                        {headerLabel}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {group.tasks.length} task
                                        {group.tasks.length !== 1 ? "s" : ""}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {group.cycle > 0
                                        ? `Cycle ${group.cycle}`
                                        : "Cycle —"}
                                      {dueDate
                                        ? ` • Due ${format(
                                            new Date(dueDate),
                                            "MMM d, yyyy"
                                          )}`
                                        : ""}
                                    </div>
                                  </div>
                                  {someSelected && (
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                                    >
                                      {
                                        ids.filter((id) =>
                                          selectedTasks.has(id)
                                        ).length
                                      }{" "}
                                      selected
                                    </Badge>
                                  )}
                                  {assignedInGroup > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                                    >
                                      {assignedInGroup} assigned
                                    </Badge>
                                  )}
                                </div>
                              </AccordionTrigger>
                            </div>
                            <AccordionContent className="bg-slate-50/60">
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
            <div className="w-full space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto pr-2">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
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
                        isNested={isNested}
                      />
                    );
                  };

                  return useCycles && cycleGroups.length ? (
                    <Accordion
                      type="multiple"
                      className="divide-y divide-slate-200"
                    >
                      {cycleGroups.map((group) => {
                        const ids = group.tasks.map((t) => t.id);
                        const allSelected = ids.every((id) =>
                          selectedTasks.has(id)
                        );
                        const someSelected = ids.some((id) =>
                          selectedTasks.has(id)
                        );
                        const assignedInGroup = group.tasks.filter((t) =>
                          taskAssignments.some((a) => a.taskId === t.id)
                        ).length;
                        const dueDate = group.tasks[0]?.dueDate;
                        const headerLabel =
                          (group.label ?? "").trim() ||
                          group.baseName ||
                          "Task Cycle";

                        return (
                          <AccordionItem
                            key={group.label || `cycle-${group.cycle || "na"}`}
                            value={
                              group.label || `cycle-${group.cycle || "na"}`
                            }
                            className="border-b border-slate-200 last:border-0"
                          >
                            <div className="flex items-stretch">
                              <div className="flex items-center px-4 py-3">
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
                                  className="border-slate-300"
                                />
                              </div>
                              <AccordionTrigger className="flex-1 px-4 py-3 hover:bg-slate-50 hover:no-underline">
                                <div className="flex items-center gap-3 flex-1 text-left">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-slate-900">
                                        {headerLabel}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {group.tasks.length} task
                                        {group.tasks.length !== 1 ? "s" : ""}
                                      </Badge>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {group.cycle > 0
                                        ? `Cycle ${group.cycle}`
                                        : "Cycle —"}
                                      {dueDate
                                        ? ` • Due ${format(
                                            new Date(dueDate),
                                            "MMM d, yyyy"
                                          )}`
                                        : ""}
                                    </div>
                                  </div>
                                  {someSelected && (
                                    <Badge
                                      variant="outline"
                                      className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                                    >
                                      {
                                        ids.filter((id) =>
                                          selectedTasks.has(id)
                                        ).length
                                      }{" "}
                                      selected
                                    </Badge>
                                  )}
                                  {assignedInGroup > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                                    >
                                      {assignedInGroup} assigned
                                    </Badge>
                                  )}
                                </div>
                              </AccordionTrigger>
                            </div>
                            <AccordionContent className="bg-slate-50/60">
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
