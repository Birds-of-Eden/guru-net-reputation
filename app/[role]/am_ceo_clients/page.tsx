"use client";

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { useRouter } from "next/navigation";

import { ClientStatusSummary } from "@/components/clients/client-status-summary";
import { ClientCardSkeleton } from "@/components/clients/client-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

import type { Client } from "@/types/client";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { useClients } from "@/lib/hooks/use-clients";
import { AmCeoClientOverviewHeader } from "@/components/clients/am-ceo-client-overview-header";

const AmGroupedClientView = lazy(() =>
  import("@/components/clients/am-grouped-client-view").then((m) => ({
    default: m.AmGroupedClientView,
  }))
);

type AmGroup = {
  am: { id: string; name: string | null; email: string | null };
  clients: Client[];
};

export default function AmCeoClientsPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useUserSession();

  // Use pagination version of hook
  const {
    clients,
    loading,
    pagination,
    page,
    setPage,
    nextPage,
    prevPage,

    status,
    setStatus,

    packageId,
    setPackageId,

    amId,
    setAmId,

    search,
    setSearch,
  } = useClients();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);

  const currentUserId = user?.id ?? "";
  const currentUserRole = (user?.role ?? "").toLowerCase();
  const isAM = currentUserRole === "am";
  const isAMCeo = currentUserRole === "am_ceo";

  // ▼ AM should see only own clients by default — CEO sees ALL
  useEffect(() => {
    if (!sessionLoading && isAM && currentUserId && amId !== currentUserId) {
      setAmId(currentUserId);
    }
  }, [sessionLoading, isAM, currentUserId, amId]);

  // ▼ Load packages
  useEffect(() => {
    const loadPkg = async () => {
      try {
        const res = await fetch("/api/packages");
        const json = await res.json();
        const arr = Array.isArray(json) ? json : json?.data ?? [];
        setPackages(
          arr.map((p: any) => ({ id: p.id, name: p.name ?? "Unnamed" }))
        );
      } catch {
        setPackages([]);
      }
    };

    loadPkg();
  }, []);

  const handleViewClientDetails = (client: Client) => {
    router.push(`/am_ceo/clients/${client.id}`);
  };

  const handleAddNewClient = () => {
    router.push(`/am_ceo/clients/onboarding`);
  };

  // ▼ From API (pagination hook gives filtered results already)
  const filteredClients = clients;

  // ▼ Build AM list for dropdown
  const accountManagers = useMemo(() => {
    return Array.from(
      filteredClients.reduce((map, c) => {
        const id = c.amId ?? c.accountManager?.id;
        if (!id) return map;

        const name = c.accountManager?.name ?? "Unknown AM";
        map.set(id, { id, label: name });

        return map;
      }, new Map<string, { id: string; label: string }>())
    ).map(([, v]) => v);
  }, [filteredClients]);

  // ▼ Group clients by AM
  const groupedClients: AmGroup[] = useMemo(() => {
    const groups = new Map<string, AmGroup>();

    filteredClients.forEach((client) => {
      const amId = client.amId ?? client.accountManager?.id ?? "unassigned";

      if (!groups.has(amId)) {
        groups.set(amId, {
          am: {
            id: amId,
            name: client.accountManager?.name ?? "Unassigned",
            email: client.accountManager?.email ?? null,
          },
          clients: [],
        });
      }

      groups.get(amId)!.clients.push(client);
    });

    return Array.from(groups.values());
  }, [filteredClients]);

  // LOADING UI
  if (sessionLoading || loading) {
    return (
      <div className="py-8 px-4 md:px-6">
        <Skeleton className="h-10 w-64 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <ClientCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4 md:px-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl shadow-lg border mb-8">
        <AmCeoClientOverviewHeader
          searchQuery={search}
          setSearchQuery={setSearch}
          statusFilter={status}
          setStatusFilter={setStatus}
          packageFilter={packageId}
          setPackageFilter={setPackageId}
          packages={packages}
          amFilter={amId}
          setAmFilter={setAmId}
          accountManagers={accountManagers}
          currentUserId={currentUserId}
          currentUserRole={user?.role}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onAddNewClient={handleAddNewClient}
        />

        {/* Summary always uses ALL available clients */}
        <ClientStatusSummary clients={clients} />
      </div>

      {/* GROUPED VIEW */}
      <Suspense 
        fallback={
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                {/* AM Header Skeleton */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-14 w-14 rounded-full bg-gray-200 animate-pulse"></div>
                  <div className="flex-1">
                    <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-6 w-16 rounded-full bg-gray-200 animate-pulse"></div>
                  </div>
                </div>
                
                {/* Client Cards Grid Skeleton */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(3)].map((_, j) => (
                    <ClientCardSkeleton key={j} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        }
      >
        <AmGroupedClientView
          groupedClients={groupedClients}
          onViewDetails={handleViewClientDetails}
          viewMode={viewMode}
          canImpersonateAm={isAMCeo}
          currentUserId={currentUserId}
        />
      </Suspense>

      {/* PAGINATION */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-4">
          <button
            onClick={prevPage}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            Previous
          </button>

          <span className="px-4 py-2 font-medium">
            Page {page} / {pagination.totalPages}
          </span>

          <button
            onClick={nextPage}
            disabled={page === pagination.totalPages}
            className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
