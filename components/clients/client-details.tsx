//lint Error fixed
"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Client, TaskStatusCounts } from "@/types/client";

import {
  Calendar,
  User,
  Briefcase,
  MapPin,
  Cake,
  Package,
  Shield,
  ListChecks,
  Flag,
  Mail,
  Phone,
  Home,
  BookOpen,
  ImageIcon,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  X,
  Users,
  Globe,
  Building2,
  Clock,
  Target,
  ArrowLeft,
  PlusCircle,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRoleSegment } from "@/lib/hooks/use-role-segment";
import { EditKeywordsModal } from "./EditKeywordsModal";

// ✅ Drop-in full-page version of the old modal UI
// Place this file at: app/clients/[clientId]/page.tsx
// or import <ClientDetailsPageContent /> inside your route component.

function getTaskStatusCounts(tasks: Client["tasks"] = []): TaskStatusCounts {
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    overdue: tasks.filter((t) => t.status === "overdue").length,
    cancelled: tasks.filter((t) => t.status === "cancelled").length,
  };
}

function normalizeDriveData(raw: any) {
  if (typeof raw === "string") {
    return {
      driveLink: raw,
      items: [] as Array<{ title?: string; link?: string }>,
    };
  }
  if (Array.isArray(raw)) {
    return {
      driveLink: "",
      items: raw.filter((i) => i?.link || i?.title),
    };
  }
  if (raw && typeof raw === "object") {
    return {
      driveLink: typeof raw.driveLink === "string" ? raw.driveLink : "",
      items: Array.isArray(raw.items)
        ? raw.items.filter((i: any) => i?.link || i?.title)
        : [],
    };
  }
  return {
    driveLink: "",
    items: [] as Array<{ title?: string; link?: string }>,
  };
}

export default function ClientDetailsPage({ clientId }: { clientId: string }) {
  const router = useRouter();
  const roleSegment = useRoleSegment();
  const [isEditKeywordsModalOpen, setIsEditKeywordsModalOpen] = useState(false);

  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    personalInfo: true,
    projectTimeline: true,
    taskSummary: true,
    teamMembers: true,
    assignments: true,
    socialLinks: true,
    biography: true,
    companyInfo: true,
    keywords: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // ⚡ OPTIMIZED: Use SWR for automatic caching and instant loads
  const jsonFetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load client");
    return res.json();
  };

  const {
    data: client,
    isLoading: loading,
    error,
    mutate,
  } = useSWR<Client>(
    clientId ? `/api/clients/${clientId}` : null,
    jsonFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 60 seconds
      onError: (err) => {
        console.error(err);
        toast.error("Failed to load client details");
      },
    },
  );

  const taskCounts = useMemo(
    () => getTaskStatusCounts(client?.tasks),
    [client],
  );
  const driveData = useMemo(
    () => normalizeDriveData(client?.imageDrivelink),
    [client?.imageDrivelink],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 text-center text-gray-600 dark:text-muted-foreground">Client not found.</div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-white via-slate-50 to-slate-100 dark:from-card dark:via-background dark:to-background">
      {/* Page Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-200 dark:bg-card/80 dark:border-border">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="rounded-full"
            >
              <Link href={`/${roleSegment}/clients`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 ring-4 ring-white shadow border border-slate-200 dark:border-border">
                <AvatarImage
                  src={
                    client.avatar ||
                    `/placeholder.svg?height=48&width=48&text=${client.name.substring(0, 2) || "PL"}`
                  }
                  alt={client.name}
                  className="h-12 w-12"
                />
                <AvatarFallback className="bg-slate-700 text-white font-semibold">
                  {client.name.substring(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-foreground">
                  {client.name}
                </h1>
                <p className="text-slate-600 flex items-center gap-2 dark:text-muted-foreground">
                  <Building2 className="h-4 w-4" /> {client.company} •{" "}
                  {client.designation}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => router.push(`/clients/${clientId}/edit`)}
            >
              <Edit className="h-4 w-4" /> Edit
            </Button>
            <Button
              variant="destructive"
              className="flex items-center gap-2"
              onClick={() => toast.message("Hook up your delete flow here")}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        {/* Personal Information */}
        <Section
          title="Personal Information"
          icon={<User className="h-5 w-5 text-slate-700 dark:text-foreground" />}
          open={expandedSections.personalInfo}
          onToggle={() => toggleSection("personalInfo")}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
            {client.birthdate && (
              <InfoCard
                iconBg="bg-rose-100 dark:bg-rose-900/40"
                icon={<Cake className="h-4 w-4 text-rose-600 dark:text-rose-400" />}
                label="Birthdate"
              >
                {format(new Date(client.birthdate), "MMM d, yyyy")}
              </InfoCard>
            )}
            {client.location && (
              <InfoCard
                iconBg="bg-fuchsia-100 dark:bg-fuchsia-900/40"
                icon={<MapPin className="h-4 w-4 text-fuchsia-600 dark:text-fuchsia-400" />}
                label="Location"
              >
                {client.location}
              </InfoCard>
            )}
            <InfoCard
              iconBg="bg-teal-100 dark:bg-teal-900/40"
              icon={<Shield className="h-4 w-4 text-teal-600 dark:text-teal-400" />}
              label="Status"
            >
              <Badge
                className={
                  client.status === "active"
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/40"
                    : client.status === "inactive"
                      ? "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-muted dark:text-foreground dark:border-border dark:hover:bg-muted"
                      : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900/40"
                }
              >
                {client.status || "Pending"}
              </Badge>
            </InfoCard>
            {client.phone && (
              <InfoCard
                iconBg="bg-blue-100 dark:bg-blue-900/40"
                icon={<Phone className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                label="Phone"
              >
                {client.phone}
              </InfoCard>
            )}
            {client.email && (
              <InfoCard
                iconBg="bg-violet-100 dark:bg-violet-900/40"
                icon={<Mail className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
                label="Email"
              >
                {client.email}
              </InfoCard>
            )}
            {client.address && (
              <InfoCard
                className="md:col-span-2"
                iconBg="bg-orange-100 dark:bg-orange-900/40"
                icon={<Home className="h-4 w-4 text-orange-600 dark:text-orange-400" />}
                label="Address"
              >
                {client.address}
              </InfoCard>
            )}
            {client.category && (
              <InfoCard
                iconBg="bg-indigo-100 dark:bg-indigo-900/40"
                icon={<Briefcase className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
                label="Category"
              >
                {client.category}
              </InfoCard>
            )}
          </div>
          <Separator className="my-4" />
          <div>
            <h4 className="text-sm text-slate-500 font-medium mb-3 dark:text-muted-foreground">
              Name Keywords
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              {client.keywords?.map((keyword, index) => (
                <Badge key={index} variant="secondary">
                  {keyword}
                </Badge>
              ))}
              {!client.keywords?.length && (
                <p className="text-sm text-slate-500 dark:text-muted-foreground">No keywords assigned.</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => setIsEditKeywordsModalOpen(true)}
              >
                <Edit className="h-3 w-3 mr-1.5" />
                Edit
              </Button>
            </div>
          </div>
        </Section>

        {/* Project Timeline */}
        <Section
          title="Project Timeline"
          icon={<Calendar className="h-5 w-5 text-slate-700 dark:text-foreground" />}
          open={expandedSections.projectTimeline}
          onToggle={() => toggleSection("projectTimeline")}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            {client.startDate && (
              <InfoCard
                iconBg="bg-emerald-100 dark:bg-emerald-900/40"
                icon={<Flag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                label="Start Date"
              >
                {format(new Date(client.startDate), "MMM d, yyyy")}
              </InfoCard>
            )}
            {client.dueDate && (
              <InfoCard
                iconBg="bg-red-100 dark:bg-red-900/40"
                icon={<Clock className="h-4 w-4 text-red-600 dark:text-red-400" />}
                label="Due Date"
              >
                {format(new Date(client.dueDate), "MMM d, yyyy")}
              </InfoCard>
            )}
            <InfoCard
              iconBg="bg-indigo-100 dark:bg-indigo-900/40"
              icon={<Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />}
              label="Package"
            >
              {client.package?.name || "None"}
            </InfoCard>
          </div>
        </Section>

        {/* Task Summary */}
        <Section
          title="Task Summary"
          icon={<ListChecks className="h-5 w-5 text-slate-700 dark:text-foreground" />}
          open={expandedSections.taskSummary}
          onToggle={() => toggleSection("taskSummary")}
        >
          <div className="space-y-6 mt-2">
            {client.tasks && client.tasks.length > 0 ? (
              <>
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 dark:bg-muted/40 dark:border-border">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-700 font-semibold dark:text-foreground">
                      Completion Rate
                    </span>
                    <span className="font-bold text-2xl text-slate-900 dark:text-foreground">
                      {client.progress || 0}%
                    </span>
                  </div>
                  <Progress
                    value={client.progress || 0}
                    className="h-3 rounded-full"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {Object.entries(taskCounts).map(([status, count]) => {
                    const map = {
                      completed: {
                        color: "bg-emerald-100 dark:bg-emerald-900/40",
                        text: "text-emerald-700 dark:text-emerald-300",
                        icon: "text-emerald-600 dark:text-emerald-400",
                      },
                      in_progress: {
                        color: "bg-blue-100 dark:bg-blue-900/40",
                        text: "text-blue-700 dark:text-blue-300",
                        icon: "text-blue-600 dark:text-blue-400",
                      },
                      pending: {
                        color: "bg-amber-100 dark:bg-amber-900/40",
                        text: "text-amber-700 dark:text-amber-300",
                        icon: "text-amber-600 dark:text-amber-400",
                      },
                      overdue: {
                        color: "bg-red-100 dark:bg-red-900/40",
                        text: "text-red-700 dark:text-red-300",
                        icon: "text-red-600 dark:text-red-400",
                      },
                      cancelled: {
                        color: "bg-slate-100 dark:bg-muted",
                        text: "text-slate-700 dark:text-foreground",
                        icon: "text-slate-600 dark:text-muted-foreground",
                      },
                    } as const;
                    const cfg = map[status as keyof typeof map] ?? map.pending;
                    return (
                      <div
                        key={status}
                        className={`${cfg.color} p-4 rounded-lg border border-slate-200 hover:shadow-sm transition-all duration-200 dark:border-border`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className={`p-2 bg-white rounded-lg shadow-sm dark:bg-card`}>
                            <Target className={`h-4 w-4 ${cfg.icon}`} />
                          </div>
                          <span className={`text-2xl font-bold ${cfg.text}`}>
                            {count}
                          </span>
                        </div>
                        <p
                          className={`text-sm font-medium ${cfg.text} capitalize`}
                        >
                          {status.replace("_", " ")}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 dark:bg-muted/40 dark:border-border">
                  <h4 className="font-semibold text-slate-900 mb-4 dark:text-foreground">
                    Recent Tasks
                  </h4>
                  <div className="space-y-3">
                    {client.tasks.slice(0, 5).map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:shadow-sm transition-all duration-200 dark:bg-card dark:border-border"
                      >
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-foreground">
                            {task.name}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-muted-foreground">
                            {task.templateSiteAsset?.type} •{" "}
                            {task.templateSiteAsset?.name}
                          </p>
                        </div>
                        <Badge
                          className={
                            task.status === "completed"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/40"
                              : task.status === "in_progress"
                                ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/40"
                                : task.status === "pending"
                                  ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-900/40"
                                  : task.status === "overdue"
                                    ? "bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-900/40"
                                    : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-muted dark:text-foreground dark:border-border dark:hover:bg-muted"
                          }
                        >
                          {task.status.replace("_", " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-50 p-8 rounded-lg border border-slate-100 text-center dark:bg-muted/40 dark:border-border">
                <p className="text-slate-500 dark:text-muted-foreground">
                  No tasks assigned to this client yet.
                </p>
              </div>
            )}
          </div>
        </Section>

        {/* Team Members */}
        <Section
          title="Team Members"
          icon={<Users className="h-5 w-5 text-slate-700 dark:text-foreground" />}
          open={expandedSections.teamMembers}
          onToggle={() => toggleSection("teamMembers")}
          badge={client.teamMembers?.length}
        >
          {client.teamMembers && client.teamMembers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
              {client.teamMembers.map((member) => (
                <div
                  key={member.agentId}
                  className="bg-slate-50 p-5 rounded-lg border border-slate-100 hover:bg-slate-100 transition-all duration-200 dark:bg-muted/40 dark:border-border dark:hover:bg-muted"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-12 w-12 ring-2 ring-white shadow-sm border border-slate-200 dark:border-border">
                      <AvatarImage
                        src={member.agent?.image || "/placeholder.svg"}
                        alt={member.agent?.name || ""}
                        className="h-12 w-12"
                      />
                      <AvatarFallback className="bg-slate-600 text-white font-semibold h-12 w-12">
                        {member.agent?.name?.substring(0, 2) || "NA"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-foreground">
                        {member.agent?.name || "Unknown"}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-muted-foreground">
                        {member.agent?.role?.name || member.role || "Member"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/40">
                      {member.teamId || "No Team"}
                    </Badge>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/40">
                      {member.assignedTasks || 0} tasks
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 p-8 rounded-lg border border-slate-100 text-center dark:bg-muted/40 dark:border-border">
              <p className="text-slate-500 dark:text-muted-foreground">
                No team members assigned to this client yet.
              </p>
            </div>
          )}
        </Section>

        {/* Assignments */}
        <Section
          title="Assignments"
          icon={<Briefcase className="h-5 w-5 text-slate-700 dark:text-foreground" />}
          open={expandedSections.assignments}
          onToggle={() => toggleSection("assignments")}
          badge={client.assignments?.length}
        >
          {client.assignments && client.assignments.length > 0 ? (
            <div className="space-y-4 mt-2">
              {client.assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="bg-slate-50 p-6 rounded-lg border border-slate-100 hover:bg-slate-100 transition-all duration-200 dark:bg-muted/40 dark:border-border dark:hover:bg-muted"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-900 text-lg dark:text-foreground">
                      {assignment.template?.name || "Unnamed Assignment"}
                    </h4>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/40">
                      {assignment.status || "Unknown Status"}
                    </Badge>
                  </div>
                  <p className="text-slate-600 mb-4 leading-relaxed dark:text-muted-foreground">
                    {assignment.template?.description ||
                      "No description available"}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-white p-4 rounded-lg border border-slate-200 dark:bg-card dark:border-border">
                      <p className="text-xs text-slate-500 font-medium mb-1 dark:text-muted-foreground">
                        Assigned At
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-foreground">
                        {assignment.assignedAt
                          ? format(
                              new Date(assignment.assignedAt),
                              "MMM d, yyyy",
                            )
                          : "Not specified"}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-slate-200 dark:bg-card dark:border-border">
                      <p className="text-xs text-slate-500 font-medium mb-1 dark:text-muted-foreground">
                        Tasks
                      </p>
                      <p className="font-semibold text-slate-900 dark:text-foreground">
                        {assignment.tasks?.length || 0} tasks
                      </p>
                    </div>
                  </div>
                  {assignment.template?.sitesAssets &&
                    assignment.template.sitesAssets.length > 0 && (
                      <div>
                        <p className="text-sm text-slate-600 font-medium mb-3 dark:text-muted-foreground">
                          Assets
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {assignment.template.sitesAssets.map((asset) => (
                            <Badge
                              key={asset.id}
                              className="bg-indigo-100 text-indigo-700 border-indigo-200 capitalize hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-900/40"
                            >
                              {asset.type.replace("_", " ")}: {asset.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-50 p-8 rounded-lg border border-slate-100 text-center dark:bg-muted/40 dark:border-border">
              <p className="text-slate-500 dark:text-muted-foreground">
                No assignments for this client yet.
              </p>
            </div>
          )}
        </Section>

        {/* Proffessional Background */}
        {(client.companywebsite || client.companyaddress) && (
          <Section
            title="Proffessional Background"
            icon={<Building2 className="h-5 w-5 text-slate-700 dark:text-foreground" />}
            open={expandedSections.companyInfo}
            onToggle={() => toggleSection("companyInfo")}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              {client.companywebsite && (
                <InfoCard
                  iconBg="bg-blue-100 dark:bg-blue-900/40"
                  icon={<Globe className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                  label="Website"
                >
                  <a
                    href={client.companywebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {client.companywebsite}
                  </a>
                </InfoCard>
              )}
              {client.companyaddress && (
                <InfoCard
                  iconBg="bg-emerald-100 dark:bg-emerald-900/40"
                  icon={<MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                  label="Address"
                >
                  {client.companyaddress}
                </InfoCard>
              )}
            </div>
          </Section>
        )}

        {/* Biography */}
        {client.biography && (
          <Section
            title="Biography"
            icon={<BookOpen className="h-5 w-5 text-slate-700 dark:text-foreground" />}
            open={expandedSections.biography}
            onToggle={() => toggleSection("biography")}
          >
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-100 mt-2 dark:bg-muted/40 dark:border-border">
              <p className="text-slate-700 leading-relaxed whitespace-pre-line dark:text-foreground">
                {client.biography}
              </p>
            </div>
          </Section>
        )}

        {/* Image Drive Link */}
        {(driveData.driveLink || driveData.items.length > 0) && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 dark:bg-card dark:border-border">
            <div className="p-6 space-y-4">
              <h3 className="font-semibold text-xl text-slate-900 flex items-center gap-3 dark:text-foreground">
                <div className="p-2.5 bg-slate-100 rounded-lg dark:bg-muted">
                  <ImageIcon className="h-5 w-5 text-slate-700 dark:text-foreground" />
                </div>
                Image Drive Link
              </h3>

              {driveData.driveLink && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 dark:bg-muted/40 dark:border-border">
                  <a
                    href={driveData.driveLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 hover:underline font-medium flex items-center gap-2 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <ImageIcon className="h-4 w-4" />
                    {driveData.driveLink}
                  </a>
                </div>
              )}

              {driveData.items.length > 0 && (
                <div className="space-y-2">
                  {driveData.items.map((item, idx) => (
                    <div
                      key={`${item?.link || item?.title || "link"}-${idx}`}
                      className="flex items-start gap-3 bg-slate-50 border border-slate-100 rounded-lg p-3 dark:bg-muted/40 dark:border-border"
                    >
                      <ImageIcon className="h-4 w-4 text-slate-600 mt-0.5 dark:text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate dark:text-foreground">
                          {item?.title || "(Untitled)"}
                        </p>
                        {item?.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline break-all dark:text-blue-400"
                          >
                            {item.link}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <Separator className="my-6" />

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="flex items-center gap-2"
          >
            <X className="h-4 w-4" /> Close
          </Button>
        </div>
      </main>

      <EditKeywordsModal
        isOpen={isEditKeywordsModalOpen}
        onOpenChange={setIsEditKeywordsModalOpen}
        client={client}
        onKeywordsUpdate={(updatedClient) => {
          mutate(updatedClient, { revalidate: false });
        }}
      />
    </div>
  );
}

/* ----------------------------- Helpers ------------------------------ */

function Section({
  title,
  icon,
  badge,
  children,
  open,
  onToggle,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: number | undefined;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 dark:bg-card dark:border-border">
      <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-border">
        <h3 className="font-semibold text-xl text-slate-900 flex items-center gap-3 dark:text-foreground">
          <div className="p-2.5 bg-slate-100 rounded-lg dark:bg-muted">{icon}</div>
          {title}
          {typeof badge === "number" && (
            <Badge className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-muted dark:text-foreground dark:border-border dark:hover:bg-muted">
              {badge}
            </Badge>
          )}
        </h3>
        <Collapsible open={open} onOpenChange={onToggle}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-9 h-9 p-0 hover:bg-slate-100 rounded-lg dark:hover:bg-muted"
            >
              {open ? (
                <ChevronUp className="h-4 w-4 text-slate-600 dark:text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-600 dark:text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>
      <Collapsible open={open}>
        <CollapsibleContent>
          <div className="p-6 pt-0">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function InfoCard({
  icon,
  iconBg,
  label,
  children,
  className = "",
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-slate-50 p-4 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors dark:bg-muted/40 dark:border-border dark:hover:bg-muted ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 ${iconBg} rounded-lg`}>{icon}</div>
        <div className="flex-1">
          <p className="text-xs text-slate-500 font-medium mb-1 dark:text-muted-foreground">{label}</p>
          <p className="font-semibold text-slate-900 text-sm leading-tight dark:text-foreground">
            {children}
          </p>
        </div>
      </div>
    </div>
  );
}
