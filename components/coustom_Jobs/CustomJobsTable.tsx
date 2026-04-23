// ================================
// FILE: components/custom-jobs/CustomJobsTable.tsx
// ================================
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AssignmentModal from "./AssignmentModal";
import AMUpdateModal from "./AMUpdateModal";
import JobDetailsModal from "./JobDetailsModal";
import { ClientOption, CustomJob, UserOption } from "./customJobsTypes";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Pencil, Trash2, Eye, CheckIcon, ChevronsUpDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BackgroundGradient } from "../ui/background-gradient";
import { useAuth } from "@/context/auth-context";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function priorityBadgeClass(priority: string) {
  switch (priority) {
    case "urgent":
      return "bg-red-500/10 text-red-700 border border-red-200 hover:bg-red-500/20";
    case "high":
      return "bg-orange-500/10 text-orange-700 border border-orange-200 hover:bg-orange-500/20";
    case "medium":
      return "bg-amber-500/10 text-amber-700 border border-amber-200 hover:bg-amber-500/20";
    default:
      return "bg-emerald-500/10 text-emerald-700 border border-emerald-200 hover:bg-emerald-500/20";
  }
}

function normalizeText(value: string | undefined | null) {
  return (value || "").trim().toLowerCase();
}

function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function getJobSearchRank(job: CustomJob, search: string): { matched: boolean; rank: number } {
  const q = normalizeText(search);
  const name = normalizeText(stripHtml(job.name));
  const clientName = normalizeText(job.clientName);
  const amName = normalizeText(job.amName);

  if (!q) {
    return { matched: true, rank: 0 };
  }

  let rank: number = 0;
  let matched = false;

  // Exact match on task name
  if (name === q) {
    rank = 100;
    matched = true;
  }
  // Task name starts with query
  else if (name.startsWith(q)) {
    rank = 80;
    matched = true;
  }
  // Task name contains query
  else if (name.includes(q)) {
    rank = 60;
    matched = true;
  }

  // Exact match on client name
  if (clientName === q) {
    rank = Math.max(rank, 90);
    matched = true;
  }
  // Client name starts with query
  else if (clientName.startsWith(q)) {
    rank = Math.max(rank, 70);
    matched = true;
  }
  // Client name contains query
  else if (clientName.includes(q)) {
    rank = Math.max(rank, 50);
    matched = true;
  }

  // AM name contains query
  if (amName.includes(q)) {
    rank = Math.max(rank, 40);
    matched = true;
  }

  return { matched, rank };
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "requested":
      return "bg-violet-500/10 text-violet-700 border border-violet-200 hover:bg-violet-500/20";
    case "approved":
      return "bg-blue-500/10 text-blue-700 border border-blue-200 hover:bg-blue-500/20";
    case "pending":
      return "bg-amber-500/10 text-amber-700 border border-amber-200 hover:bg-amber-500/20";
    case "in_progress":
      return "bg-indigo-500/10 text-indigo-700 border border-indigo-200 hover:bg-indigo-500/20";
    case "completed":
      return "bg-emerald-500/10 text-emerald-700 border border-emerald-200 hover:bg-emerald-500/20";
    case "overdue":
      return "bg-red-500/10 text-red-700 border border-red-200 hover:bg-red-500/20";
    case "reassigned":
      return "bg-red-500/10 text-red-700 border border-red-200 hover:bg-red-500/20";
    case "qc_approved":
      return "bg-green-500/10 text-green-700 border border-green-200 hover:bg-green-500/20";
    default:
      return "bg-slate-500/10 text-slate-700 border border-slate-200 hover:bg-slate-500/20";
  }
}

interface CustomJobsTableProps {
  jobs?: CustomJob[];
  onRefresh?: () => void;
}

export default function CustomJobsTable({
  jobs: initialJobs = [],
  onRefresh,
}: CustomJobsTableProps) {
  const [jobs, setJobs] = useState<CustomJob[]>(initialJobs);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [agents, setAgents] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningJobId, setAssigningJobId] = useState<string | null>(null);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<CustomJob | null>(null);
  const [amUpdateModalOpen, setAmUpdateModalOpen] = useState(false);
  const [amUpdatingJob, setAmUpdatingJob] = useState<CustomJob | null>(null);
  const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [reassigningJobId, setReassigningJobId] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const { user } = useAuth();
  const userRole = typeof user?.role === "string" ? user?.role : (user?.role as any)?.name;
  const userId = user?.id;
  const isAM = userRole === "am";
  const role = typeof params?.role === "string" ? params.role : "";

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/clients");
      const result = await res.json();
      const list = Array.isArray(result?.clients) ? result.clients : [];
      const scopedList =
        isAM && userId
          ? list.filter((item: any) => item.amId === userId)
          : list;
      setClients(scopedList.map((item: any) => ({ id: item.id, name: item.name })));
    } catch (error) {
      console.error(error);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      const result = await res.json();
      const list = Array.isArray(result) ? result : [];
      setAgents(
        list.map((item: any) => ({
          id: item.id,
          name: `${item.firstName} ${item.lastName}`,
          email: item.email,
          category: item.category,
          image: item.image,
        })),
      );
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    setJobs(
      isAM && userId
        ? initialJobs.filter((job) => job.amId === userId)
        : initialJobs,
    );
    fetchClients();
    fetchAgents();
  }, [initialJobs, isAM, userId]);

  const filteredJobs = useMemo(() => {
    const ranked = jobs
      .map((job) => {
        const rank = getJobSearchRank(job, searchInput);
        return { job, rank };
      })
      .filter((item) => item.rank.matched);

    ranked.sort((a, b) => b.rank.rank - a.rank.rank);

    return ranked.map((item) => item.job);
  }, [jobs, searchInput]);

  const filtered = useMemo(() => {
    // Dashboard already filtered by date, status, priority, client
    // Table only needs to handle search filtering
    return filteredJobs;
  }, [filteredJobs]);

  const getAmUpdateStatus = (job?: CustomJob | null) =>
    job?.taskCompletionJson?.amUpdateStatus || null;

  const getAmUpdateNote = (job?: CustomJob | null) =>
    job?.taskCompletionJson?.notes || "";

  const handleDelete = async (id: string) => {
    const ok = window.confirm(
      "Are you sure you want to delete this custom job?",
    );
    if (!ok) return;

    try {
      const res = await fetch(`/api/custom-jobs/${id}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok || !result.success)
        throw new Error(result.message || "Delete failed");
      onRefresh?.();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const handleAssign = async (
    agentId: string,
    idealDurationMinutes?: number,
  ) => {
    if (!assigningJobId) return;

    try {
      const dueDate = new Date().toISOString();

      const res = await fetch(`/api/custom-jobs/${assigningJobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToId: agentId,
          status: "pending",
          idealDurationMinutes: idealDurationMinutes || 30,
          dueDate,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success)
        throw new Error(result.message || "Assign failed");
      onRefresh?.();
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const handleReassignToCurrentAgent = async (job: CustomJob) => {
    try {
      setReassigningJobId(job.id);
      const dueDate = new Date().toISOString();

      const res = await fetch(`/api/custom-jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "reassigned",
          dueDate,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Reassign failed");
      }
      onRefresh?.();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Reassign failed");
    } finally {
      setReassigningJobId(null);
    }
  };

  const handleStatusChange = async (
    jobId: string,
    status: CustomJob["status"],
  ) => {
    try {
      const res = await fetch(`/api/custom-jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await res.json();
      if (!res.ok || !result.success)
        throw new Error(result.message || "Status update failed");
      onRefresh?.();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Status update failed");
    }
  };

  const handleAmUpdate = async (
    status: "approved" | "rejected",
    note: string,
  ) => {
    if (!amUpdatingJob) return;

    const res = await fetch(`/api/custom-jobs/${amUpdatingJob.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amUpdateStatus: status,
        completionNotes: note,
      }),
    });

    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || "Failed to save AM update");
    }

    onRefresh?.();
  };

  return (
    <Card>
      <CardHeader className="border-b bg-linear-to-r from-amber-50 via-white to-orange-50">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-800">
              Custom Jobs
            </CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Manage and track custom job requests
            </CardDescription>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <Popover open={searchPopoverOpen} onOpenChange={setSearchPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={searchPopoverOpen}
                  className="w-full justify-between sm:w-[280px] h-10 rounded-xl border-slate-200 bg-white shadow-sm focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  <span className="truncate">
                    {searchInput || "Search by task or client..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[320px] p-0">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search task or client..."
                    value={searchInput}
                    onValueChange={setSearchInput}
                  />
                  <CommandList>
                    <CommandEmpty>No jobs found.</CommandEmpty>
                    <CommandGroup>
                      {filteredJobs.slice(0, 10).map((job) => (
                        <CommandItem
                          key={job.id}
                          value={job.id}
                          onSelect={() => {
                            setSearchInput(stripHtml(job.name));
                            setSearchPopoverOpen(false);
                          }}
                        >
                          <CheckIcon
                            className={cn(
                              "mr-2 h-4 w-4",
                              searchInput === stripHtml(job.name) ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="truncate">
                            {stripHtml(job.name)} - {job.clientName}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-lg border bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-linear-to-r from-slate-50 to-slate-100 border-b-2">
                <TableHead className="font-semibold text-slate-700">
                  Date
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  Client
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  AM
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  Task
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  Priority
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  Status
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  Assigned To
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  View Details
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  AM Updates
                </TableHead>
                <TableHead className="font-semibold text-slate-700 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No custom jobs found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((job, index) => (
                  <TableRow
                    key={job.id}
                    className="hover:bg-slate-50/80 transition-colors border-b last:border-b-0"
                  >
                    <TableCell className="whitespace-nowrap text-sm text-slate-600">
                      {job.date ? new Date(job.date).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className="font-medium text-sm text-indigo-700">
                        {job.clientName || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-slate-600">
                      {job.amName || "-"}
                    </TableCell>
                    <TableCell className="min-w-[280px] max-w-[400px]">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div 
                              className="line-clamp-2 text-sm text-slate-700 leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: job.name || "-" }}
                            />
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-md max-h-[400px] overflow-auto"
                          >
                            <div 
                              className="text-sm whitespace-pre-wrap [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800"
                              dangerouslySetInnerHTML={{ __html: job.name || "-" }}
                            />
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        className={`${priorityBadgeClass(job.priority)} rounded-md px-2.5 py-1 text-xs font-medium`}
                      >
                        {job.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {job.status === "requested" && !isAM ? (
                        <select
                          value={job.status}
                          onChange={(e) =>
                            handleStatusChange(
                              job.id,
                              e.target.value as CustomJob["status"],
                            )
                          }
                          className="h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          <option value="requested">Requested</option>
                          <option value="approved">Approved</option>
                        </select>
                      ) : (
                        <Badge
                          className={`${statusBadgeClass(job.status)} rounded-md px-2.5 py-1 text-xs font-medium`}
                        >
                          {job.status?.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {job.assignedToName ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                            {job.assignedToName}
                          </span>
                          {getAmUpdateStatus(job) === "rejected" && !isAM && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReassignToCurrentAgent(job)}
                              disabled={reassigningJobId === job.id}
                              className="h-8 rounded-md px-3 text-xs font-medium bg-red-500 hover:bg-red-700 text-white hover:text-white"
                            >
                              {reassigningJobId === job.id ? "Reassigning..." : "Reassign"}
                            </Button>
                          )}
                        </div>
                      ) : job.status === "approved" && !isAM ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setAssigningJobId(job.id);
                            setAssignModalOpen(true);
                          }}
                          className="h-8 rounded-md bg-linear-to-r from-emerald-500 to-emerald-600 px-3 text-xs font-medium text-white shadow-sm hover:from-emerald-600 hover:to-emerald-700"
                        >
                          Assign
                        </Button>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <BackgroundGradient>
                        <Button
                          onClick={() => {
                            setSelectedJob(job);
                            setViewDetailsModalOpen(true);
                          }}
                          className="gap-2 h-8 rounded-md px-3 text-xs font-medium bg-transparent hover:bg-transparent hover:text-gray-100"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </BackgroundGradient>
                    </TableCell>
                    <TableCell className="w-[120px]">
                      <Button
                        size="sm"
                        onClick={() => {
                          setAmUpdatingJob(job);
                          setAmUpdateModalOpen(true);
                        }}
                        className="h-8 rounded-md bg-linear-to-r from-sky-500 to-violet-600 px-2 text-[11px] font-medium text-white shadow-sm hover:from-sky-600 hover:to-violet-700"
                      >
                        AM Update
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            router.push(
                              `/${role}/distribution/custom_jobs/${job.id}/edit`,
                            )
                          }
                          disabled={job.status === "qc_approved" || job.status === "completed"}
                          className="h-8 w-8 rounded-md hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(job.id)}
                          className="h-8 w-8 rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          disabled={job.status === "qc_approved" || job.status === "completed"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <AssignmentModal
        open={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setAssigningJobId(null);
        }}
        onAssign={handleAssign}
        agents={agents}
        preferredAgentId={jobs.find((j) => j.id === assigningJobId)?.assignedToId}
        taskName={jobs.find((j) => j.id === assigningJobId)?.name ? stripHtml(jobs.find((j) => j.id === assigningJobId)?.name) : undefined}
        taskPriority={jobs.find((j) => j.id === assigningJobId)?.priority}
      />
      <JobDetailsModal
        open={viewDetailsModalOpen}
        onClose={() => {
          setViewDetailsModalOpen(false);
          setSelectedJob(null);
        }}
        job={selectedJob}
      />
      <AMUpdateModal
        open={amUpdateModalOpen}
        onClose={() => {
          setAmUpdateModalOpen(false);
          setAmUpdatingJob(null);
        }}
        onSubmit={handleAmUpdate}
        taskName={amUpdatingJob?.name ? stripHtml(amUpdatingJob.name) : undefined}
        initialStatus={getAmUpdateStatus(amUpdatingJob)}
        initialNote={getAmUpdateNote(amUpdatingJob)}
        canEdit={
          isAM &&
          !!amUpdatingJob &&
          (amUpdatingJob.status === "completed" ||
            amUpdatingJob.status === "qc_approved")
        }
      />
    </Card>
  );
}
