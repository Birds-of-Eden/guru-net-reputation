// ================================
// FILE: components/custom-jobs/CustomJobsTable.tsx
// ================================
"use client";

import { useEffect, useMemo, useState } from "react";
import CustomJobFormModal from "./CustomJobFormModal";
import AssignmentModal from "./AssignmentModal";
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
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function priorityBadgeClass(priority: string) {
  switch (priority) {
    case "urgent":
      return "bg-red-500 text-white hover:bg-red-500";
    case "high":
      return "bg-orange-500 text-white hover:bg-orange-500";
    case "medium":
      return "bg-amber-500 text-white hover:bg-amber-500";
    default:
      return "bg-emerald-500 text-white hover:bg-emerald-500";
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "requested":
      return "bg-violet-100 text-violet-800 hover:bg-violet-100";
    case "approved":
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "pending":
      return "bg-amber-100 text-amber-800 hover:bg-amber-100";
    case "in_progress":
      return "bg-blue-500 text-white hover:bg-blue-500";
    case "completed":
      return "bg-emerald-500 text-white hover:bg-emerald-500";
    case "overdue":
      return "bg-red-500 text-white hover:bg-red-500";
    case "qc_approved":
      return "bg-emerald-500 text-white hover:bg-emerald-500";
    default:
      return "bg-slate-100 text-slate-800 hover:bg-slate-100";
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
      const firstDayOfPreviousMonth = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1);
      const lastDayOfPreviousMonth = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0);
      result = result.filter((job) => {
        if (!job.date) return false;
        const jobDate = new Date(job.date);
        return jobDate >= firstDayOfPreviousMonth && jobDate <= lastDayOfPreviousMonth;
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
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">Custom Jobs</CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              Manage and track custom job requests
            </CardDescription>
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by task/client"
                className="pl-9 w-[220px]"
              />
            </div>
            <Button
              className="border border-amber-600 bg-transparent text-amber-600 hover:bg-amber-500 hover:text-white"
              onClick={fetchJobs}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Date</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>AM</TableHead>
              <TableHead>Task</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>AM Update</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-24 text-center text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-24 text-center text-muted-foreground"
                >
                  No custom jobs found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="whitespace-nowrap">
                    {job.date ? new Date(job.date).toLocaleDateString() : "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-medium">
                    {job.clientName || "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {job.amName || "-"}
                  </TableCell>
                  <TableCell className="min-w-[280px] max-w-[400px]">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="line-clamp-3 text-sm">{job.name}</p>
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
                      className={`${priorityBadgeClass(job.priority)} rounded-full text-xs`}
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
                        className="h-7 rounded-md border bg-background px-2 text-xs"
                      >
                        <option value="requested">Requested</option>
                        <option value="approved">Approved</option>
                      </select>
                    ) : (
                      <Badge
                        className={`${statusBadgeClass(job.status)} text-xs`}
                      >
                        {job.status?.replace(/_/g, " ")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {job.assignedToName ? (
                      <span className="font-medium">{job.assignedToName}</span>
                    ) : job.status === "approved" ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          setAssigningJobId(job.id);
                          setAssignModalOpen(true);
                        }}
                        className="h-7 bg-green-600 hover:bg-green-700 text-xs"
                      >
                        Assign
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[220px] max-w-[300px]">
                    {job.clientNotificationUpdate ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <p className="line-clamp-2 text-sm">
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
                      <span className="text-muted-foreground">-</span>
                    )}
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
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(job.id)}
                        className="text-destructive hover:text-destructive"
                        disabled={job.status === "qc_approved"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
    </Card>
  );
}
