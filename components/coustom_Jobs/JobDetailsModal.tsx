"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, User2, ShieldCheck, Flag, Link2, ExternalLink } from "lucide-react";
import { CustomJob } from "./customJobsTypes";
import { BackgroundGradient } from "../ui/background-gradient";
import { sanitizeRichHtml } from "@/lib/sanitize-html";

interface JobDetailsModalProps {
  open: boolean;
  onClose: () => void;
  job: CustomJob | null;
}

function getPriorityColor(priority?: string) {
  switch (priority) {
    case "urgent":
      return "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300 dark:border-red-800";
    case "high":
      return "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-800";
    case "medium":
      return "bg-yellow-500/10 text-yellow-700 border-yellow-200 dark:text-yellow-300 dark:border-yellow-800";
    case "low":
      return "bg-slate-500/10 text-slate-700 border-slate-200 dark:text-foreground dark:border-border";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-200 dark:text-foreground dark:border-border";
  }
}

function getStatusColor(status?: string) {
  switch (status) {
    case "qc_approved":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800";
    case "completed":
      return "bg-green-500/10 text-green-700 border-green-200 dark:text-green-300 dark:border-green-800";
    case "in_progress":
      return "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-800";
    case "pending":
      return "bg-slate-500/10 text-slate-700 border-slate-200 dark:text-foreground dark:border-border";
    case "cancelled":
      return "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300 dark:border-red-800";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-200 dark:text-foreground dark:border-border";
  }
}

function getAmUpdateColor(status?: string | null) {
  switch (status) {
    case "approved":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-300 dark:border-emerald-800";
    case "rejected":
      return "bg-red-500/10 text-red-700 border-red-200 dark:text-red-300 dark:border-red-800";
    default:
      return "bg-gray-500/10 text-gray-700 border-gray-200 dark:text-foreground dark:border-border";
  }
}

function extractLinks(data: any): string[] {
  if (!data?.links) return [];
  return String(data.links)
    .split(",")
    .map((l: string) => l.trim())
    .filter(Boolean);
}

function getDomainName(link: string) {
  try {
    return new URL(link).hostname.replace("www.", "");
  } catch {
    return link;
  }
}

export default function JobDetailsModal({
  open,
  onClose,
  job,
}: JobDetailsModalProps) {
  if (!job) return null;

  const json = job.taskCompletionJson || {};
  const links = extractLinks(json);
  const amUpdateStatus = json.amUpdateStatus;
  const amUpdateNote = json.notes;

  const openAllLinks = () => {
    links.forEach((link) => {
      window.open(link, "_blank");
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl overflow-x-hidden rounded-2xl border-0 p-0 shadow-2xl">
        <div className="max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <div className="border-b bg-linear-to-r from-indigo-600 via-violet-600 to-blue-600 px-6 py-5 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tight">
                Custom Job Details
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge
                className={`border ${getStatusColor(job.status)} bg-white/95 dark:bg-card/95`}
              >
                {job.status?.replace(/_/g, " ") || "unknown"}
              </Badge>
              <Badge
                className={`border ${getPriorityColor(job.priority)} bg-white/95 dark:bg-card/95`}
              >
                {job.priority || "unknown"}
              </Badge>
            </div>
          </div>

          <div className="space-y-6 bg-slate-50 p-6 dark:bg-muted/40">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-card">
                <div className="mb-2 flex items-center gap-2 text-slate-500 dark:text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Date
                  </span>
                </div>
                <p className="wrap-break-word text-sm font-semibold text-slate-900 dark:text-foreground">
                  {job.date ? new Date(job.date).toLocaleDateString() : "-"}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-card">
                <div className="mb-2 flex items-center gap-2 text-slate-500 dark:text-muted-foreground">
                  <User2 className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Client
                  </span>
                </div>
                <p className="wrap-break-word text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {job.clientName || "-"}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-card">
                <div className="mb-2 flex items-center gap-2 text-slate-500 dark:text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    AM Name
                  </span>
                </div>
                <p className="wrap-break-word text-sm font-semibold text-slate-900 dark:text-foreground">
                  {job.amName || "-"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-card">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
                Task
              </h3>
              <div 
                className="rounded-xl bg-indigo-50 p-4 text-sm leading-7 text-slate-800 whitespace-pre-wrap wrap-break-word [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800 dark:bg-indigo-950/40 dark:text-foreground dark:[&_a]:text-blue-400 dark:[&_a:hover]:text-blue-300"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(job.name) || "-" }}
              />
            </div>

            {links.length > 0 && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-card">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
                      Links ({links.length})
                    </h3>
                  </div>
                 < BackgroundGradient>
                  <Button
                    onClick={openAllLinks}
                    className="gap-2 text-xs bg-transparent hover:bg-transparent hover:text-gray-100"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Open All
                  </Button>
                 </BackgroundGradient>

                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {links.map((link, i) => (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group rounded-xl border border-blue-100 bg-blue-50 p-4 transition hover:border-blue-200 hover:bg-blue-100/70 dark:border-blue-800 dark:bg-blue-950/40 dark:hover:border-blue-800 dark:hover:bg-blue-900/40"
                    >
                      <div className="flex items-start gap-3 overflow-hidden">
                        <div className="mt-0.5 rounded-lg bg-white p-2 text-blue-600 shadow-sm dark:bg-card dark:text-blue-400">
                          <Link2 className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                            {getDomainName(link)}
                          </p>
                          <p className="mt-1 break-all text-xs text-slate-600 dark:text-muted-foreground">
                            {link}
                          </p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-card">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
                  Assigned To
                </p>
                <p className="wrap-break-word text-sm font-medium text-slate-900 dark:text-foreground">
                  {job.assignedToName || "-"}
                </p>
              </div>

              <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-card">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
                  Status
                </p>
                <Badge className={`border ${getStatusColor(job.status)}`}>
                  {job.status?.replace(/_/g, " ") || "-"}
                </Badge>
              </div>

              <div className="rounded-2xl border bg-white p-4 shadow-sm dark:bg-card">
                <div className="mb-2 flex items-center gap-2 text-slate-500 dark:text-muted-foreground">
                  <Flag className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-wide">
                    Priority
                  </p>
                </div>
                <Badge className={`border ${getPriorityColor(job.priority)}`}>
                  {job.priority || "-"}
                </Badge>
              </div>
            </div>

            {job.notes && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-card">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
                  Notes
                </h3>
                <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-4 text-sm text-slate-800 whitespace-pre-wrap wrap-break-word dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-foreground">
                  {job.notes}
                </div>
              </div>
            )}

            {(amUpdateStatus || amUpdateNote) && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm dark:bg-card">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
                    AM Update
                  </h3>
                  <Badge className={`border ${getAmUpdateColor(amUpdateStatus)}`}>
                    {amUpdateStatus || "pending"}
                  </Badge>
                </div>
                <div
                  className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm text-slate-800 whitespace-pre-wrap wrap-break-word [&_p]:my-0 [&_a]:text-blue-600 [&_a]:underline dark:border-sky-800 dark:bg-sky-950/40 dark:text-foreground dark:[&_a]:text-blue-400"
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(amUpdateNote) || "<p>-</p>" }}
                />
              </div>
            )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
