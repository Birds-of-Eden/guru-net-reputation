// ================================
// FILE: components/custom-jobs/CustomJobsTable.tsx
// ================================
"use client";

import { useEffect, useMemo, useState } from "react";
import CustomJobFormModal from "./CustomJobFormModal";
import AssignmentModal from "./AssignmentModal";
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
import { Plus, Search, Pencil, Trash2, Eye } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BackgroundGradient } from "../ui/background-gradient";

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
    case "qc_approved":
      return "bg-green-500/10 text-green-700 border border-green-200 hover:bg-green-500/20";
    default:
      return "bg-slate-500/10 text-slate-700 border border-slate-200 hover:bg-slate-500/20";
  }
}

interface CustomJobsTableProps {
  dateFilter?: "today" | "this_month" | "previous_month" | "date_range";
  startDate?: string;
  endDate?: string;
  statusFilter?: string;
  priorityFilter?: string;
}

export default function CustomJobsTable({
  dateFilter = "today",
  startDate = "",
  endDate = "",
  statusFilter = "all",
  priorityFilter = "all",
}: CustomJobsTableProps) {
  const [jobs, setJobs] = useState<CustomJob[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [agents, setAgents] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CustomJob | null>(null);
  const [search, setSearch] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assigningJobId, setAssigningJobId] = useState<string | null>(null);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<CustomJob | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/custom-jobs?search=${encodeURIComponent(search)}`,
      );
      const result = await res.json();
      setJobs(result.data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch("/api/clients");
      const result = await res.json();
      const list = result?.clients || [];
      setClients(list.map((item: any) => ({ id: item.id, name: item.name })));
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
    fetchJobs();
    fetchClients();
    fetchAgents();
  }, []);

  const filtered = useMemo(() => {
    let result = jobs;

    // Apply date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (dateFilter === "today") {
      result = result.filter((job) => {
        if (!job.date) return false;
        const jobDate = new Date(job.date);
        return jobDate >= today;
      });
    } else if (dateFilter === "this_month") {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      result = result.filter((job) => {
        if (!job.date) return false;
        const jobDate = new Date(job.date);
        return jobDate >= firstDayOfMonth;
      });
    } else if (dateFilter === "previous_month") {
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const firstDayOfPreviousMonth = new Date(
        previousMonth.getFullYear(),
        previousMonth.getMonth(),
        1,
      );
      const lastDayOfPreviousMonth = new Date(
        previousMonth.getFullYear(),
        previousMonth.getMonth() + 1,
        0,
      );
      result = result.filter((job) => {
        if (!job.date) return false;
        const jobDate = new Date(job.date);
        return (
          jobDate >= firstDayOfPreviousMonth &&
          jobDate <= lastDayOfPreviousMonth
        );
      });
    } else if (dateFilter === "date_range" && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59);
      result = result.filter((job) => {
        if (!job.date) return false;
        const jobDate = new Date(job.date);
        return jobDate >= start && jobDate <= end;
      });
    }

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter((job) => job.status === statusFilter);
    }

    // Apply priority filter
    if (priorityFilter !== "all") {
      result = result.filter((job) => job.priority === priorityFilter);
    }

    return result;
  }, [jobs, dateFilter, startDate, endDate, statusFilter, priorityFilter]);

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
      await fetchJobs();
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
      const res = await fetch(`/api/custom-jobs/${assigningJobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedToId: agentId,
          status: "pending",
          idealDurationMinutes: idealDurationMinutes || 30,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success)
        throw new Error(result.message || "Assign failed");
      await fetchJobs();
    } catch (error) {
      console.error(error);
      throw error;
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
      await fetchJobs();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Status update failed");
    }
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
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by task or client..."
                className="h-10 rounded-xl border-slate-200 bg-white pl-10 pr-4 shadow-sm focus-visible:ring-2 focus-visible:ring-amber-500"
              />
            </div>

            <Button
              onClick={fetchJobs}
              className="h-10 rounded-xl bg-amber-500 px-4 text-white shadow-sm transition hover:bg-amber-600"
            >
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
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
                  AM Update
                </TableHead>
                <TableHead className="font-semibold text-slate-700">
                  View Details
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
                            <p className="line-clamp-2 text-sm text-slate-700 leading-relaxed">
                              {job.name}
                            </p>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="max-w-md max-h-[400px] overflow-auto"
                          >
                            <p className="text-sm whitespace-pre-wrap">
                              {job.name}
                            </p>
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
                      {job.status === "requested" ? (
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
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700">
                          <div className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                          {job.assignedToName}
                        </span>
                      ) : job.status === "approved" ? (
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
                    <TableCell className="min-w-[220px] max-w-[300px]">
                      {job.clientNotificationUpdate ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <p className="line-clamp-2 text-sm text-slate-600 leading-relaxed">
                                {job.clientNotificationUpdate}
                              </p>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-md max-h-[400px] overflow-auto"
                            >
                              <p className="text-sm whitespace-pre-wrap">
                                {job.clientNotificationUpdate}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingJob(job);
                            setOpen(true);
                          }}
                          disabled={job.status === "qc_approved"}
                          className="h-8 w-8 rounded-md hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(job.id)}
                          className="h-8 w-8 rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          disabled={job.status === "qc_approved"}
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

      <CustomJobFormModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={fetchJobs}
        editingJob={editingJob}
        clients={clients}
      />
      <AssignmentModal
        open={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setAssigningJobId(null);
        }}
        onAssign={handleAssign}
        agents={agents}
        taskName={jobs.find((j) => j.id === assigningJobId)?.name}
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
    </Card>
  );
}
