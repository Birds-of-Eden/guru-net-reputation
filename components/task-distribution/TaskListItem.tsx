// components/task-distribution/TaskListItem.tsx

"use client";

import { memo, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  Building2 as DefaultIcon,
} from "lucide-react";
import { Agent, Task, TaskAssignment } from "./distribution-types";
import {
  priorityColors,
  PRIORITY_OPTIONS,
  siteTypeColors,
  siteTypeIcons,
  statusColors,
} from "./task-constants";

import {
  nameToColor,
  getInitialsFromName,
  getInitialsFromParts,
} from "@/utils/avatar";
import { getLoadStats } from "./load-utils";

interface TaskListItemProps {
  task: Task;
  siteType: string;

  // Both pools
  teamAgents: Agent[];
  allAgents: Agent[];

  // kept for compatibility
  agents: Agent[];

  isSelected: boolean;
  assignment: TaskAssignment | undefined;
  isFirstSelectedTask: boolean;
  isMultipleSelected: boolean;
  note: string;
  onTaskSelection: (taskId: string, checked: boolean) => void;
  onTaskAssignment: (
    taskId: string,
    agentId: string,
    isMultipleSelected: boolean,
    isFirstSelectedTask: boolean,
  ) => void;
  onNoteChange: (note: string) => void;
  onPriorityChange: (
    taskId: string,
    priority: (typeof PRIORITY_OPTIONS)[number],
  ) => void;
  priorityUpdating?: boolean;
  isNested?: boolean;
}

export const TaskListItem = memo(function TaskListItem({
  task,
  siteType,
  teamAgents,
  allAgents,
  isSelected,
  assignment,
  isFirstSelectedTask,
  isMultipleSelected,
  note,
  onTaskSelection,
  onTaskAssignment,
  onNoteChange,
  onPriorityChange,
  priorityUpdating,
  isNested,
}: TaskListItemProps) {
  // Per-row source selector
  const [agentSource, setAgentSource] = useState<"team" | "all">("team");
  const baseList = agentSource === "team" ? teamAgents : allAgents;

  const filteredAgents = useMemo(() => {
    const categoryMap: Record<string, string> = {
      social_site: "social",
      web2_site: "web2",
      other_asset: "general",
    };
    const targetCategory = categoryMap[siteType] || "general";
    return baseList.filter((agent: any) => {
      return (
        agent?.category?.toLowerCase() === targetCategory ||
        agent?.role?.name?.toLowerCase() === "agent"
      );
    });
  }, [baseList, siteType]);

  const priorityValue = (task as any)?.priority ?? "medium";
  const priorityKey = String(priorityValue).toLowerCase();
  const statusValue = (task as any)?.status ?? "pending";
  const statusKey = String(statusValue).toLowerCase();
  const isPriorityLocked =
    statusKey === "completed" || statusKey === "qc_approved";
  const assignedAgent: Agent | null = (task as any)?.assignedTo ?? null;
  const assignedAgentId: string | null = (task as any)?.assignedToId ?? null;
  const combinedAgents = useMemo(
    () => [...teamAgents, ...allAgents],
    [teamAgents, allAgents],
  );

  const SiteIcon =
    siteTypeIcons[siteType as keyof typeof siteTypeIcons] || DefaultIcon;
  const siteTone =
    siteTypeColors[siteType as keyof typeof siteTypeColors] ??
    "bg-slate-50 text-slate-700 border-slate-200";
  const shouldDisableDropdown =
    isMultipleSelected && isSelected && !isFirstSelectedTask;
  const isLinkedToFirst = shouldDisableDropdown;
  const shouldDisablePriority =
    isPriorityLocked || shouldDisableDropdown || priorityUpdating;

  const handleAssignmentChange = (agentId: string) => {
    onTaskAssignment(task.id, agentId, isMultipleSelected, isFirstSelectedTask);
  };

  // Extract agent display logic to avoid syntax errors
  const resolvedAgent =
    assignedAgent ||
    combinedAgents.find((a: any) => a.id === assignedAgentId) ||
    null;
  const assignedDisplayName =
    resolvedAgent?.name ||
    `${(resolvedAgent as any)?.firstName ?? ""} ${
      (resolvedAgent as any)?.lastName ?? ""
    }`.trim() ||
    resolvedAgent?.email ||
    "Assigned";

  const previewAgent = combinedAgents.find(
    (a: any) => a.id === assignment?.agentId,
  );
  const previewDisplayName =
    previewAgent?.name ||
    `${previewAgent?.firstName ?? ""} ${previewAgent?.lastName ?? ""}`.trim() ||
    previewAgent?.email ||
    "Agent";

  const LoadChips = (a: any) => {
    const { P, IP, O, R, active, weighted } = getLoadStats(a);

    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <Badge
          variant="outline"
          className="border-slate-200 bg-white text-slate-700"
        >
          {active} active
        </Badge>
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 text-amber-700"
        >
          W:{weighted}
        </Badge>
        <div className="mx-1 h-3.5 w-px bg-slate-200" />
        <Badge
          variant="outline"
          className="border-slate-200 bg-white text-slate-700"
        >
          P:{P}
        </Badge>
        <Badge
          variant="outline"
          className="border-indigo-200 bg-indigo-50 text-indigo-700"
        >
          IP:{IP}
        </Badge>
        <Badge
          variant="outline"
          className="border-rose-200 bg-rose-50 text-rose-700"
        >
          O:{O}
        </Badge>
        <Badge
          variant="outline"
          className="border-orange-200 bg-orange-50 text-orange-700"
        >
          R:{R}
        </Badge>
      </div>
    );
  };

  function AvatarWithFallback({
    name,
    image,
    size = "h-7 w-7",
    ring = "ring-2 ring-blue-300",
    textClass = "text-xs",
  }: {
    name: string;
    image?: string | null;
    size?: string;
    ring?: string;
    textClass?: string;
  }) {
    const bg = nameToColor(name || "user");
    const initials = getInitialsFromName(name || "U");
    return (
      <Avatar className={`${size} ${ring} shadow-sm`}>
        {image ? <AvatarImage src={image} alt={name} /> : null}
        <AvatarFallback
          style={{ backgroundColor: bg }}
          className={`text-white font-bold ${textClass}`}
        >
          {initials || "U"}
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <Card
      className={[
        "transition-all duration-200 shadow-sm border bg-white",
        isNested ? "rounded-lg" : "rounded-xl",
        isSelected
          ? "border-blue-300 ring-2 ring-blue-100"
          : "border-slate-200 hover:border-slate-300",
      ].join(" ")}
    >
      <CardContent className="p-5 max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
        <div className="flex items-start gap-4">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) =>
              onTaskSelection(task.id, checked as boolean)
            }
            className="mt-1 w-4 h-4 rounded border border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:text-white"
          />

          <div className={`p-2 rounded-lg border ${siteTone}`}>
            <SiteIcon className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <h3 className="text-sm font-semibold text-slate-900 truncate">
                {task.name}
              </h3>
              <div className="flex items-center space-x-2">
                <Badge
                  className={`text-[11px] font-semibold ${
                    priorityColors[
                      (priorityKey as keyof typeof priorityColors) ?? "medium"
                    ] || priorityColors.medium
                  }`}
                >
                  {priorityKey.toUpperCase()}
                </Badge>
                <Select
                  value={priorityKey}
                  onValueChange={(value) =>
                    onPriorityChange(
                      task.id,
                      value as (typeof PRIORITY_OPTIONS)[number],
                    )
                  }
                  disabled={shouldDisablePriority}
                >
                  <SelectTrigger
                    className="h-8 w-[120px] text-[11px] border-dashed border-blue-200 hover:border-blue-400 bg-white shadow-sm"
                    title={
                      isPriorityLocked
                        ? "Priority locked for completed/QC approved tasks"
                        : shouldDisableDropdown
                        ? "Controlled by the first selected task"
                        : undefined
                    }
                  >
                    <SelectValue
                      placeholder={priorityUpdating ? "Updating..." : "Priority"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className="text-[11px]"
                      >
                        {option.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge
                  className={`text-[11px] font-semibold ${
                    statusColors[
                      (statusKey as keyof typeof statusColors) ?? "pending"
                    ] || statusColors.pending
                  }`}
                >
                  {statusKey.replace("_", " ").toUpperCase()}
                </Badge>
              </div>
            </div>

            {task.templateSiteAsset?.description && (
              <p className="text-xs text-slate-600 mt-1 truncate">
                {task.templateSiteAsset.description}
              </p>
            )}

            <div className="flex items-center flex-wrap gap-3 mt-2 text-xs text-slate-600">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50">
                <CalendarDays className="h-3.5 w-3.5 text-slate-600" />
                <span className="font-medium">
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              </div>
              {task.idealDurationMinutes && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50">
                  <Clock className="h-3.5 w-3.5 text-slate-600" />
                  <span className="font-medium">
                    {task.idealDurationMinutes}min
                  </span>
                </div>
              )}
              {task.templateSiteAsset?.isRequired && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span className="font-medium">Required</span>
                </div>
              )}
            </div>
          </div>

          <div className="w-full max-w-md">
            {assignedAgent || assignedAgentId ? (
              (() => {
                const resolvedAgent =
                  assignedAgent ||
                  combinedAgents.find((a: any) => a.id === assignedAgentId) ||
                  null;
                const displayName =
                  resolvedAgent?.name ||
                  `${(resolvedAgent as any)?.firstName ?? ""} ${
                    (resolvedAgent as any)?.lastName ?? ""
                  }`.trim() ||
                  resolvedAgent?.email ||
                  "Assigned";
                /* Already assigned - static display */
                return (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-emerald-300 bg-emerald-50">
                    <AvatarWithFallback
                      name={assignedDisplayName}
                      image={(resolvedAgent as any)?.image || undefined}
                      ring="ring-2 ring-emerald-300"
                      size="h-6 w-6"
                      textClass="text-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-emerald-800 truncate">
                        {assignedDisplayName}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
                  </div>
                );
              })()
            ) : assignment ? (
              /* Preview chosen agent - static display */
              <div className="flex items-center gap-2 p-3 rounded-lg border border-blue-300 bg-blue-50">
                <AvatarWithFallback
                  name={previewDisplayName}
                  image={previewAgent?.image || undefined}
                  ring="ring-2 ring-blue-300"
                  size="h-6 w-6"
                  textClass="text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-blue-800 truncate">
                    {previewDisplayName}
                  </p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-blue-700 shrink-0" />
              </div>
            ) : (
              <>
                {isSelected ? (
                  <div className="flex flex-col gap-2">
                    {/* Top row: Source select + available count + (optional) Bulk chip */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex items-center gap-2 sm:flex-1">
                        <span className="text-xs font-semibold text-slate-700 shrink-0">
                          Choose Agent List:
                        </span>

                        <Select
                          value={agentSource}
                          onValueChange={(v: "team" | "all") =>
                            setAgentSource(v)
                          }
                        >
                          <SelectTrigger
                            disabled={isLinkedToFirst}
                            className={[
                              "border border-slate-300 hover:border-slate-400 h-9 text-xs sm:text-sm w-full sm:max-w-[180px] rounded-lg bg-white",
                              isLinkedToFirst
                                ? "opacity-60 cursor-not-allowed"
                                : "",
                            ].join(" ")}
                          >
                            <SelectValue
                              placeholder={
                                isLinkedToFirst
                                  ? "Linked to first task"
                                  : "Select list"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="team">Team Agents</SelectItem>
                            <SelectItem value="all">All Agents</SelectItem>
                          </SelectContent>
                        </Select>

                        <span className="text-[11px] text-slate-600 px-2 py-1 rounded-full bg-slate-100 border border-slate-200">
                          {agentSource === "team"
                            ? teamAgents.length
                            : allAgents.length}{" "}
                          available
                        </span>
                        {isLinkedToFirst && (
                          <span className="ml-1 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            Linked
                          </span>
                        )}
                      </div>

                      {isFirstSelectedTask && isMultipleSelected && (
                        <span className="inline-flex items-center self-start sm:self-auto gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                          Bulk
                        </span>
                      )}
                    </div>

                    {/* Bottom row: Assign-to select (grows) */}
                    <div className="flex items-center">
                      <Select
                        value=""
                        onValueChange={handleAssignmentChange}
                        disabled={shouldDisableDropdown}
                      >
                        <SelectTrigger
                          className={[
                            "h-10 text-sm w-full rounded-lg transition-all duration-150 shadow-sm",
                            shouldDisableDropdown
                              ? "border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed"
                              : "border-slate-300 hover:border-slate-400 bg-white",
                          ].join(" ")}
                        >
                          <SelectValue
                            placeholder={
                              shouldDisableDropdown
                                ? "Controlled by first task..."
                                : isFirstSelectedTask && isMultipleSelected
                                  ? "Choose agent for multiple tasks..."
                                  : "Choose agent..."
                            }
                          />
                        </SelectTrigger>

                        <SelectContent className="rounded-xl border shadow-lg p-2 w-[min(28rem,90vw)]">
                          {/* Legend bar */}
                          <div className="px-3 py-2 mb-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-slate-400" />{" "}
                                P
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-indigo-500" />{" "}
                                IP
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-rose-500" />{" "}
                                O
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-orange-500" />{" "}
                                R
                              </span>
                              <span className="ml-auto">Active / W</span>
                            </div>
                          </div>

                          {/* Agent list */}
                          <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                            {filteredAgents.map((agent: any) => {
                              const display =
                                agent.name ||
                                `${agent.firstName ?? ""} ${
                                  agent.lastName ?? ""
                                }`.trim() ||
                                agent.email ||
                                "Agent";
                              const initials = getInitialsFromParts(
                                agent.firstName,
                                agent.lastName,
                                agent.name || agent.email,
                              );
                              const bg = nameToColor(display);

                              return (
                                <SelectItem
                                  key={agent.id}
                                  value={agent.id}
                                  className="rounded-lg m-0 px-2 py-2 hover:bg-slate-50"
                                >
                                  <div className="flex items-start gap-2">
                                    <Avatar className="h-7 w-7 ring-2 ring-blue-200 shadow-sm">
                                      {agent.image ? (
                                        <AvatarImage
                                          src={agent.image}
                                          alt={display}
                                        />
                                      ) : null}
                                      <AvatarFallback
                                        style={{ backgroundColor: bg }}
                                        className="text-white text-[10px] font-bold"
                                      >
                                        {initials || "A"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[13px] font-semibold text-slate-900 truncate">
                                        {display}
                                      </div>
                                      <LoadChips {...agent} />
                                    </div>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                  /* Not selected yet */
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50">
                    <User className="h-4 w-4 text-slate-600" />
                    <span className="text-xs text-slate-700 font-medium">
                      Select to assign
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* notes */}
        <div className="mt-4 space-y-2">
          <label
            htmlFor={`note-${task.id}`}
            className="text-xs font-semibold text-slate-800"
          >
            Task Notes
          </label>

          <div className="relative">
            <textarea
              id={`note-${task.id}`}
              rows={2}
              placeholder="Add your notes here..."
              className="w-full text-sm p-3 rounded-lg border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400 focus:border-slate-300 resize-none transition-all duration-150 placeholder-slate-400 text-slate-800"
              value={note}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  onNoteChange(e.target.value);
                }
              }}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <span className="text-xs text-slate-400 font-medium">
                {note?.length || 0}/500
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
