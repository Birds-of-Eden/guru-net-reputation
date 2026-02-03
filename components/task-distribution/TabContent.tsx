"use client";

import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { List, Grid3X3, Building2 as DefaultIcon } from "lucide-react";
import { Agent, Task, TaskAssignment } from "./distribution-types";
import { siteTypeIcons } from "./task-constants";
import { TaskCard } from "./TaskCard";
import { TaskListItem } from "./TaskListItem";

type AgentWithLoad = Agent & {
  displayLabel?: string;
  activeCount?: number;
  weightedScore?: number;
  byStatus?: Record<string, number>;
};

interface TabContentProps {
  siteType: string;
  tasks: Task[];

  // NEW: both pools available to each card
  teamAgents: AgentWithLoad[];
  allAgents: AgentWithLoad[];

  // legacy/default list (kept)
  agents: AgentWithLoad[];

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

  titleOverride?: string;
}

function displayName(a: Partial<Agent>) {
  return (
    (a as any)?.name ||
    `${(a as any)?.firstName ?? ""} ${(a as any)?.lastName ?? ""}`.trim() ||
    (a as any)?.email ||
    "Agent"
  );
}

function formatAgentLabel(
  a: Partial<AgentWithLoad>,
  activeCount = 0,
  weightedScore = 0,
  byStatus: Record<string, number> = {}
) {
  const p = byStatus["pending"] ?? 0;
  const ip = byStatus["in_progress"] ?? 0;
  const o = byStatus["overdue"] ?? 0;
  const r = byStatus["reassigned"] ?? 0;
  return `${displayName(
    a
  )} • ${activeCount} active (P:${p} | IP:${ip} | O:${o} | R:${r}) • W:${weightedScore}`;
}

export function TabContent({
  siteType,
  tasks,
  teamAgents,
  allAgents,
  agents,
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
  titleOverride,
}: TabContentProps) {
  // normalize/label sort for each list
  const prep = (list: AgentWithLoad[]) => {
    const enriched = (list || []).map((a: any) => {
      const activeCount = a?.activeCount ?? 0;
      const weightedScore = a?.weightedScore ?? 0;
      const byStatus = a?.byStatus ?? {};
      const displayLabel =
        a?.displayLabel ??
        formatAgentLabel(
          a as AgentWithLoad,
          activeCount,
          weightedScore,
          byStatus
        );
      return {
        ...(a as Agent),
        activeCount,
        weightedScore,
        byStatus,
        displayLabel,
      } as AgentWithLoad;
    });

    enriched.sort(
      (x, y) =>
        (x.weightedScore ?? 0) - (y.weightedScore ?? 0) ||
        (x.activeCount ?? 0) - (y.activeCount ?? 0) ||
        displayName(x).localeCompare(displayName(y))
    );
    return enriched;
  };

  const agentsPrepared = useMemo(() => prep(agents), [agents]);
  const teamAgentsPrepared = useMemo(() => prep(teamAgents), [teamAgents]);
  const allAgentsPrepared = useMemo(() => prep(allAgents), [allAgents]);

  const selectedTasksInTab = tasks.filter((task) =>
    selectedTasks.has(task.id)
  ).length;
  const assignedTasksInTab = tasks.filter((task) =>
    taskAssignments.some((assignment) => assignment.taskId === task.id)
  ).length;

  const siteTypeConfig = {
    social_site: {
      title: "Social Media Tasks",
      description: "Manage social media content and engagement tasks",
    },
    web2_site: {
      title: "Web2 Platform Tasks",
      description: "Handle web2 platform content and management",
    },
    other_asset: {
      title: "Other Asset Tasks",
      description: "Manage miscellaneous assets and content",
    },
  };

  const inferFromFirstTask =
    (tasks?.[0] as any)?.templateSiteAsset?.type ??
    (tasks?.[0] as any)?.siteType ??
    "other_asset";

  const isKnown = (t: string) => t in siteTypeConfig;
  const safeSiteType = isKnown(siteType)
    ? (siteType as keyof typeof siteTypeConfig)
    : isKnown(inferFromFirstTask)
    ? (inferFromFirstTask as keyof typeof siteTypeConfig)
    : "other_asset";

  const finalTitle = titleOverride;

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* controls header - simplified */}
      <div className="rounded-xl border border-slate-200/80 bg-linear-to-r from-indigo-50 via-white to-sky-50 p-4 shadow-sm shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                onSelectAllTasks(
                  tasks.map((t) => t.id),
                  true
                )
              }
              disabled={tasks.length === 0}
              className="border-slate-200"
            >
              Select All ({tasks.length})
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                onSelectAllTasks(
                  tasks.map((t) => t.id),
                  false
                )
              }
              disabled={selectedTasksInTab === 0}
            >
              Clear Selection
            </Button>

            <div className="flex items-center gap-2 text-xs text-slate-600 pl-1">
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold text-slate-900">
                {tasks.length} <span className="text-[11px] font-medium text-slate-600">Total</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 font-semibold text-blue-800">
                {selectedTasksInTab} <span className="text-[11px] font-medium text-blue-700">Selected</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-800">
                {assignedTasksInTab} <span className="text-[11px] font-medium text-emerald-700">Assigned</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* list/grid with scrolling */}
      {tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm flex-1 flex items-center justify-center">
          <h3 className="text-base font-semibold text-slate-900">
            No Tasks Found
          </h3>
          <p className="text-sm text-slate-600">
            There are currently no tasks in this category for the selected
            client.
          </p>
        </div>
      ) : (
        <div 
          className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
          style={{ maxHeight: 'calc(100vh - 16rem)' }}
        >
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                : "space-y-3"
            }
          >
          {tasks.map((task) => {
            const isSelected = selectedTasks.has(task.id);
            const assignment = taskAssignments.find(
              (a) => a.taskId === task.id
            );
            const firstSelectedTaskId = selectedTasksOrder.find((id) =>
              selectedTasks.has(id)
            );
            const isFirstSelectedTask = firstSelectedTaskId === task.id;
            const isMultipleSelected = selectedTasks.size > 1;

            return viewMode === "grid" ? (
              <TaskCard
                key={task.id}
                task={task}
                siteType={safeSiteType}
                // NEW: give both pools to card
                teamAgents={teamAgentsPrepared as Agent[]}
                allAgents={allAgentsPrepared as Agent[]}
                // keep default list (unused now inside card)
                agents={agentsPrepared as Agent[]}
                isSelected={isSelected}
                assignment={assignment}
                isFirstSelectedTask={isFirstSelectedTask}
                isMultipleSelected={isMultipleSelected}
                onTaskSelection={onTaskSelection}
                onTaskAssignment={onTaskAssignment}
                note={taskNotes[task.id] || ""}
                onNoteChange={(note) => onNoteChange(task.id, note)}
                onPriorityChange={onPriorityChange}
                priorityUpdating={priorityUpdating[task.id]}
              />
            ) : (
              <TaskListItem
                key={task.id}
                task={task}
                siteType={safeSiteType}
                // NEW
                teamAgents={teamAgentsPrepared as Agent[]}
                allAgents={allAgentsPrepared as Agent[]}
                // keep default list (unused now inside item)
                agents={agentsPrepared as Agent[]}
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
              />
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
