// components/clients/client-card.tsx
//lint error fixed

"use client";

import {
  memo,
  useState,
  useMemo,
  useCallback,
  useRef,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import {
  FileText,
  Eye,
  Package,
  ListChecks,
  Trash2,
  ArrowUpCircle,
  Heart,
  Calendar,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitialsFromName, nameToColor } from "@/utils/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { toast } from "sonner";

import type { Client, TaskStatusCounts } from "@/types/client";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { hasPermissionClient } from "@/lib/permissions-client";
import ImpersonateButton from "@/components/users/ImpersonateButton";
import { handleDeleteClient } from "./handleDeleteClient";
import DangerDeleteClientModal from "./DangerDeleteClientModal";
import PackageUpgradeDialog from "@/components/clients/PackageUpgradeDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ClientCardProps {
  client: Client;
  clientUserId?: string | null;
  onViewDetails?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: (clientId: string) => void;
}

// Track in-flight client dashboard prefetches to avoid duplicate fetches
const clientDashboardWarmups = new Map<string, Promise<any>>();

const ClientCardComponent = function ClientCard({
  client,
  clientUserId,
  onViewDetails,
  isFavorite = false,
  onToggleFavorite,
}: ClientCardProps) {
  const { user, loading: permsLoading } = useUserSession();
  const router = useRouter();
  const { mutate: mutateCache } = useSWRConfig();
  const [, startNavigate] = useTransition();

  const [deleted, setDeleted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openDanger, setOpenDanger] = useState(false);
  const [openUpgrade, setOpenUpgrade] = useState(false);
  const prefetchedDetailUrlRef = useRef<string | null>(null);

  // ⚡ OPTIMIZED: Memoize utility functions
  const normalizeStatus = useCallback((raw?: string | null) => {
    const s = (raw ?? "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[\-\s]+/g, "_");
    if (
      [
        "done",
        "complete",
        "completed",
        "finished",
        "qc_approved",
        "approved",
      ].includes(s)
    )
      return "completed";
    if (
      ["in_progress", "in-progress", "progress", "doing", "working"].includes(s)
    )
      return "in_progress";
    if (["overdue", "late"].includes(s)) return "overdue";
    if (
      [
        "pending",
        "todo",
        "not_started",
        "on_hold",
        "paused",
        "backlog",
      ].includes(s)
    )
      return "pending";
    if (["cancelled", "canceled"].includes(s)) return "cancelled";
    return s || "pending";
  }, []);

  const parseDate = useCallback((v?: string | Date | null) => {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }, []);

  // ⚡ OPTIMIZED: Memoize task counts from taskSummary
  const taskCounts: TaskStatusCounts = useMemo(() => {
    return client.taskSummary ?? {
      pending: 0,
      in_progress: 0,
      completed: 0,
      overdue: 0,
      cancelled: 0,
    };
  }, [client.taskSummary]);

  const totalTasks = taskCounts.pending +
    taskCounts.in_progress +
    taskCounts.completed +
    taskCounts.overdue +
    taskCounts.cancelled;


  // ⚡ OPTIMIZED: Memoize date formatting
  const formatDate = useCallback(
    (v?: string | Date | null) => {
      const d = parseDate(v);
      return d
        ? d.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "—";
    },
    [parseDate]
  );

  // ⚡ OPTIMIZED: Memoize role and segment
  const { role, segment } = useMemo(() => {
    const roleRaw = (user as any)?.role?.name ?? (user as any)?.role;
    const role =
      typeof roleRaw === "string" ? roleRaw.toLowerCase() : undefined;
    const segment = role && /^[a-z0-9_-]+$/.test(role) ? role : "admin";
    return { role, segment };
  }, [user]);

  const swrKey = "/api/clients";

  // ⚡ OPTIMIZED: Memoize detail URL for prefetching
  const detailUrl = useMemo(() => {
    if (segment === "data_entry") {
      return `/data_entry/clients/${client.id}`;
    }
    return `/${segment}/clients/${client.id}`;
  }, [segment, client.id]);

  const canViewDetails =
    !permsLoading &&
    hasPermissionClient(user?.permissions, "client_card_client_view");

  const prefetchDetails = useCallback(() => {
    if (prefetchedDetailUrlRef.current === detailUrl) return;
    prefetchedDetailUrlRef.current = detailUrl;
    try {
      // useRouter().prefetch may be undefined or sync; guard and ignore errors
      (router as any)?.prefetch?.(detailUrl);
    } catch {
      prefetchedDetailUrlRef.current = null;
    }
  }, [router, detailUrl]);

  const warmClientDashboard = useCallback(() => {
    const key = `/api/clients/${client.id}`;
    if (clientDashboardWarmups.has(key)) return clientDashboardWarmups.get(key);

    const p = fetch(key, { next: { revalidate: 60 } })
      .then((res) => {
        if (!res.ok) throw new Error("failed to preload client");
        return res.json();
      })
      .then((data) => {
        mutateCache(key, data, false);
        return data;
      })
      .catch(() => {
        clientDashboardWarmups.delete(key);
      });

    clientDashboardWarmups.set(key, p);
    return p;
  }, [client.id, mutateCache]);

  const primeDetailsLight = useCallback(() => {
    if (!canViewDetails) return;
    prefetchDetails();
  }, [canViewDetails, prefetchDetails]);

  const primeDetails = useCallback(() => {
    if (!canViewDetails) return;
    prefetchDetails();
    warmClientDashboard();
  }, [canViewDetails, prefetchDetails, warmClientDashboard]);

  async function handleDelete() {
    setIsDeleting(true);
    const ok = await handleDeleteClient(client.id, swrKey);
    if (ok) {
      setDeleted(true);
      router.refresh();
      setOpenDanger(false);
    }
    setIsDeleting(false);
  }

  const handleViewDetails = useCallback(
    (event?: { preventDefault?: () => void }) => {
      primeDetails();
      if (onViewDetails) {
        event?.preventDefault?.();
        return onViewDetails();
      }
      startNavigate(() => router.push(detailUrl));
    },
    [onViewDetails, router, detailUrl, primeDetails, startNavigate]
  );

  const handleViewTasks = () => {
    if (segment === "data_entry") {
      router.push(`/data_entry/data_entry/clients/${client.id}/tasks`);
    } else {
      router.push(`/${segment}/clients/${client.id}/tasks`);
    }
  };

  const handleUpgrade = () => setOpenUpgrade(true);
  const isAmCeo = role === "am_ceo";

  // Early returns after all hooks are called
  if (deleted) return null;
  if (!client) {
    return (
      <Card className="p-6 text-center text-gray-500">Invalid client data</Card>
    );
  }

  return (
    <Card
      className="overflow-hidden rounded-xl shadow-lg border border-gray-100 transition-all duration-300 hover:shadow-xl hover:scale-[1.01] bg-white"
      onMouseEnter={primeDetailsLight}
      onFocus={primeDetailsLight}
    >
      {/* Header */}
      <CardHeader className="p-6 border-b border-gray-100 bg-gradient-to-r from-cyan-50 to-blue-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-4 border-white shadow-md">
              <AvatarImage src={client.avatar || undefined} alt={client.name} />
              <AvatarFallback
                className="text-white text-2xl font-bold"
                style={{ backgroundColor: nameToColor(client.name) }}
              >
                {getInitialsFromName(client.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{client.name}</h2>
              <p className="text-gray-600 text-sm">{client.company}</p>
              <p className="text-gray-500 text-xs">{client.designation}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {isAmCeo && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite?.(client.id)}
                      className={`p-2 rounded-full border transition-all ${
                        isFavorite
                          ? "bg-rose-50 border-rose-200 text-rose-600"
                          : "bg-white border-gray-200 text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <Heart
                        className={`h-5 w-5 ${
                          isFavorite ? "fill-current" : ""
                        }`}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <Badge
              className={
                client.status === "active"
                  ? "bg-emerald-100 text-emerald-800 text-sm font-medium px-3 py-1.5 rounded-full"
                  : client.status === "inactive"
                  ? "bg-gray-100 text-gray-800 text-sm font-medium px-3 py-1.5 rounded-full"
                  : "bg-amber-100 text-amber-800 text-sm font-medium px-3 py-1.5 rounded-full"
              }
            >
              {client.status || "Pending"}
            </Badge>

            <Badge
              variant="outline"
              className="bg-gray-50 text-gray-700 font-medium border-gray-200 px-3 py-1.5 rounded-full"
            >
              <Package className="h-4 w-4 inline-block mr-1 text-cyan-600" />
              {client.package?.name || client.packageId || "No Package"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="p-2 space-y-5">
        <div className="pl-2">
          <span className="font-medium text-gray-800">Account Manager:</span>{" "}
          <span className="font-bold text-gray-800">
            {client.accountManager?.name}
          </span>
        </div>

        {/* Timeline */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-cyan-600" />
            <h3 className="font-semibold text-gray-800">Package Timeline</h3>
          </div>

          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <div className="text-gray-600">Start Date:</div>
            <div className="font-medium text-gray-800">
              {formatDate(
                (client as any)?.startDate || (client as any)?.createdAt
              )}
            </div>

            <div className="text-gray-600">End Date:</div>
            <div className="font-medium text-gray-800">
              {formatDate((client as any)?.dueDate)}
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="p-2">
          <div className="flex items-center justify-between text-sm mb-2 gap-2">
            <span className="text-gray-700 font-medium whitespace-nowrap">
              Overall Progress
            </span>
            <span className="font-bold text-gray-900 whitespace-nowrap">
              {client.overallProgress ?? 0}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden mb-2">
            <div
              className="h-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
              style={{ width: `${client.overallProgress ?? 0}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm mb-2 gap-2">
            <span className="text-gray-700 font-medium whitespace-nowrap">
              This Month Progress
            </span>
            <span className="font-bold text-gray-900 whitespace-nowrap">
              {client.monthProgress ?? 0}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
              style={{ width: `${client.monthProgress ?? 0}%` }}
            />
          </div>
        </div>

        {/* Task Summary */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-5 w-5 text-cyan-600" />
            <h3 className="font-semibold text-gray-800">Task Summary</h3>
          </div>
          {totalTasks > 0 ? (
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <div className="text-gray-600">Total Tasks:</div>
              <div className="font-medium text-gray-800">{totalTasks}</div>

              <div className="text-gray-600">Completed:</div>
              <div className="font-medium text-emerald-700">
                {taskCounts.completed}
              </div>

              <div className="text-gray-600">In Progress:</div>
              <div className="font-medium text-blue-700">
                {taskCounts.in_progress}
              </div>

              <div className="text-gray-600">Pending:</div>
              <div className="font-medium text-amber-700">
                {taskCounts.pending}
              </div>

              <div className="text-gray-600">Overdue:</div>
              <div className="font-medium text-red-700">
                {taskCounts.overdue}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No tasks assigned</p>
          )}
        </div>
      </CardContent>

      {/* Footer */}
      <CardFooter className="border-t border-gray-100 bg-gray-50 p-6">
        <div className="flex flex-wrap gap-3 w-full">
          {canViewDetails && (
            <Button
              onClick={handleViewDetails}
              onPointerDown={primeDetails}
              onMouseEnter={prefetchDetails}
              onFocus={prefetchDetails}
              onTouchStart={prefetchDetails}
              className="flex-1 min-w-[150px] bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md rounded-lg px-5 py-2.5 transition-all duration-300"
            >
              <Eye className="h-4 w-4 mr-2" /> View Details
            </Button>
          )}

          {!permsLoading &&
            hasPermissionClient(
              user?.permissions,
              "client_card_Upgrade_Package"
            ) && (
              <Button
                onClick={handleUpgrade}
                className="flex-1 min-w-[150px] bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md rounded-lg px-5 py-2.5 transition-all duration-300"
              >
                <ArrowUpCircle className="h-4 w-4 mr-2" /> Upgrade Package
              </Button>
            )}

          {!permsLoading &&
            hasPermissionClient(user?.permissions, "client_card_delete") && (
              <Button
                onClick={() => setOpenDanger(true)}
                disabled={isDeleting}
                className="flex-1 min-w-[150px] bg-gradient-to-r from-rose-500 to-red-500 text-white shadow-md rounded-lg px-5 py-2.5 transition-all duration-300"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            )}

          {!permsLoading &&
            hasPermissionClient(user?.permissions, "client_card_task_view") && (
              <Button
                onClick={handleViewTasks}
                className="flex-1 min-w-[150px] bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md rounded-lg px-5 py-2.5 transition-all duration-300"
              >
                <ListChecks className="h-4 w-4 mr-2" /> View Tasks
              </Button>
            )}

          {clientUserId && (
            <ImpersonateButton
              targetUserId={clientUserId}
              targetName={client.name}
              className="flex-1 min-w-[150px] bg-gradient-to-r from-gray-900 to-black text-white shadow-lg rounded-lg px-5 py-2.5 transition-all duration-300"
            />
          )}
        </div>
      </CardFooter>

      <DangerDeleteClientModal
        open={openDanger}
        onOpenChange={setOpenDanger}
        clientId={client.id}
        clientName={client.name}
        isDeleting={isDeleting}
        onConfirm={handleDelete}
      />

      <PackageUpgradeDialog
        open={openUpgrade}
        onOpenChange={setOpenUpgrade}
        clientId={client.id}
        currentPackageId={client?.package?.id ?? null}
        onUpgraded={() => {
          toast.success("Package upgraded");
          router.refresh();
        }}
      />
    </Card>
  );
};

export const ClientCard = memo(ClientCardComponent);
