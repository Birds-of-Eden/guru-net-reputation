"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  CheckCircle,
  Clock,
  FileText,
  Download,
  RefreshCw,
  Plus,
} from "lucide-react";
import CustomJobsTable from "./CustomJobsTable";
import CustomJobFormModal from "./CustomJobFormModal";

interface CustomJob {
  id: string;
  name: string;
  status: string;
  priority: string;
  date: string | null;
  clientId: string;
  clientName: string;
  amId: string;
  amName: string;
  assignedToId: string | null;
  assignedToName: string;
  issueStatus: string;
  qcStatus: string;
  clientNotificationUpdate: string;
  link: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  taskCompletionJson?: {
    count?: number;
    links?: string;
    link?: string;
  };
  taskType?: string;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function CustomJobsDashboard() {
  const [jobs, setJobs] = useState<CustomJob[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<"today" | "this_month" | "previous_month" | "date_range">("today");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | string>("all");
  const [showAddJobModal, setShowAddJobModal] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/custom-jobs");
      const result = await res.json();
      setJobs(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error(error);
      setJobs([]);
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

  useEffect(() => {
    fetchJobs();
    fetchClients();
  }, []);

  const filteredJobs = useMemo(() => {
    if (!Array.isArray(jobs)) return [];

    let filtered = [...jobs];

    // Date filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (dateFilter === "today") {
      filtered = filtered.filter((job) => {
        if (!job.createdAt) return false;
        const jobDate = new Date(job.createdAt);
        return jobDate >= today;
      });
    } else if (dateFilter === "this_month") {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter((job) => {
        if (!job.createdAt) return false;
        const jobDate = new Date(job.createdAt);
        return jobDate >= firstDayOfMonth;
      });
    } else if (dateFilter === "previous_month") {
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const firstDayOfPreviousMonth = new Date(previousMonth.getFullYear(), previousMonth.getMonth(), 1);
      const lastDayOfPreviousMonth = new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 0);
      filtered = filtered.filter((job) => {
        if (!job.createdAt) return false;
        const jobDate = new Date(job.createdAt);
        return jobDate >= firstDayOfPreviousMonth && jobDate <= lastDayOfPreviousMonth;
      });
    } else if (dateFilter === "date_range" && startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59);
      filtered = filtered.filter((job) => {
        if (!job.createdAt) return false;
        const jobDate = new Date(job.createdAt);
        return jobDate >= start && jobDate <= end;
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((job) => job.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter((job) => job.priority === priorityFilter);
    }

    return filtered;
  }, [jobs, dateFilter, startDate, endDate, statusFilter, priorityFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredJobs.length;
    const requested = filteredJobs.filter((j) => j.status === "requested").length;
    const approved = filteredJobs.filter((j) => j.status === "approved").length;
    const pending = filteredJobs.filter((j) => j.status === "pending").length;
    const inProgress = filteredJobs.filter((j) => j.status === "in_progress").length;
    const completed = filteredJobs.filter((j) => j.status === "completed").length;
    const qcApproved = filteredJobs.filter((j) => j.status === "qc_approved").length;

    // Count total sub-tasks from taskCompletionJson
    const totalSubTasks = filteredJobs.reduce((sum, job) => {
      const count = job.taskCompletionJson?.count || 0;
      return sum + count;
    }, 0);

    return {
      total,
      requested,
      approved,
      pending,
      inProgress,
      completed,
      qcApproved,
      totalSubTasks,
    };
  }, [filteredJobs]);

  // Chart data
  const statusChartData = [
    { name: "Requested", value: stats.requested, color: COLORS[0] },
    { name: "Approved", value: stats.approved, color: COLORS[1] },
    { name: "Pending", value: stats.pending, color: COLORS[2] },
    { name: "In Progress", value: stats.inProgress, color: COLORS[3] },
    { name: "Completed", value: stats.completed, color: COLORS[4] },
  ];

  const priorityChartData = [
    { name: "Urgent", value: filteredJobs.filter((j) => j.priority === "urgent").length },
    { name: "High", value: filteredJobs.filter((j) => j.priority === "high").length },
    { name: "Medium", value: filteredJobs.filter((j) => j.priority === "medium").length },
    { name: "Low", value: filteredJobs.filter((j) => j.priority === "low").length },
  ].filter(item => item.value > 0);

  // Monthly trend data
  const monthlyTrendData = useMemo(() => {
    const months: Record<string, number> = {};
    filteredJobs.forEach((job) => {
      if (!job.createdAt) return;
      try {
        const date = new Date(job.createdAt);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        months[key] = (months[key] || 0) + 1;
      } catch (e) {
        console.error("Error parsing date:", job.createdAt, e);
      }
    });

    return Object.entries(months)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredJobs]);

  const priorityBadgeClass = (priority: string) => {
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
  };

  const statusBadgeClass = (status: string) => {
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
  };

  return (
    <div className="space-y-6 p-6 bg-linear-to-br from-slate-50 via-white to-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black bg-linear-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Custom Jobs Dashboard
          </h1>
          <p className="text-slate-600 mt-1">Premium analytics and management for custom job tasks</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchJobs} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button
            onClick={() => setShowAddJobModal(true)}
            className="bg-green-600 hover:bg-green-700 gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Job
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-2 border-slate-200 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:gap-6">
            <div className="flex-1">
              <label className="text-sm font-bold text-slate-700 mb-2 block">Date Filter</label>
              <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="previous_month">Previous Month</SelectItem>
                  <SelectItem value="date_range">Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {dateFilter === "date_range" && (
              <>
                <div className="flex-1">
                  <label className="text-sm font-bold text-slate-700 mb-2 block">Start Date</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-bold text-slate-700 mb-2 block">End Date</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="flex-1">
              <label className="text-sm font-bold text-slate-700 mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="requested">Requested</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="qc_approved">QC Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-bold text-slate-700 mb-2 block">Priority</label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2 border-blue-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Jobs</p>
                <p className="text-3xl font-black text-blue-600 mt-2">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-emerald-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Completed</p>
                <p className="text-3xl font-black text-emerald-600 mt-2">{stats.completed}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-amber-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Pending</p>
                <p className="text-3xl font-black text-amber-600 mt-2">{stats.pending + stats.inProgress}</p>
              </div>
              <div className="p-3 bg-amber-100 rounded-full">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-purple-200 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Sub-Tasks</p>
                <p className="text-3xl font-black text-purple-600 mt-2">{stats.totalSubTasks}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-2 border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-2 border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 border-slate-200 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Monthly Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <CustomJobsTable
        dateFilter={dateFilter}
        startDate={startDate}
        endDate={endDate}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
      />

      <CustomJobFormModal
        open={showAddJobModal}
        onClose={() => setShowAddJobModal(false)}
        onSuccess={() => {
          fetchJobs();
          setShowAddJobModal(false);
        }}
        editingJob={null}
        clients={clients}
      />
    </div>
  );
}
