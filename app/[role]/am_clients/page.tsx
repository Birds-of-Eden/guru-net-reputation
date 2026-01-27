// app/[role]/am_clients/page.tsx

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

import { ClientOverviewHeader } from "@/components/clients/client-overview-header";
import { ClientStatusSummary } from "@/components/clients/client-status-summary";
import { ClientCardSkeleton } from "@/components/clients/client-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Client } from "@/types/client";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { useClients } from "@/lib/hooks/use-clients";

// Lazy load heavy components
const ClientGrid = lazy(() =>
  import("@/components/clients/client-grid").then((m) => ({
    default: m.ClientGrid,
  }))
);
const ClientList = lazy(() =>
  import("@/components/clients/client-list").then((m) => ({
    default: m.ClientList,
  }))
);

export default function AmClientsPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useUserSession();

  const {
    clients,
    loading,
    pagination,
    page,
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

  const currentUserId = user?.id ?? undefined;
  const currentUserRole = (user?.role as string | undefined) ?? undefined;
  const isAM = (currentUserRole ?? "").toLowerCase() === "am";

  // Force AM to only see their own clients
  useEffect(() => {
    if (!sessionLoading && isAM && currentUserId && amId !== currentUserId) {
      setAmId(currentUserId);
    }
  }, [sessionLoading, isAM, currentUserId, amId, setAmId]);

  // Fetch packages for dropdown
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const resp = await fetch("/api/packages");
        const raw = await resp.json();
        const list =
          (Array.isArray(raw) && raw) ||
          (Array.isArray(raw?.data) && raw.data) ||
          [];

        setPackages(
          (list as any[]).map((p) => ({
            id: String(p.id),
            name: String(p.name ?? "Unnamed"),
          }))
        );
      } catch {
        // fallback from current clients
        const derived = Array.from(
          clients.reduce((map, c) => {
            if (c.packageId)
              map.set(String(c.packageId), {
                id: String(c.packageId),
                name: c.package?.name ?? String(c.packageId),
              });
            return map;
          }, new Map<string, { id: string; name: string }>())
        ).map(([, v]) => v);
        setPackages(derived);
      }
    };

    if (!sessionLoading) {
      fetchPackages();
    }
  }, [sessionLoading, clients]);

  const handleViewClientDetails = (client: Client) => {
    router.push(`/am/clients/${client.id}`);
  };

  const handleAddNewClient = useCallback(() => {
    router.push("/am/clients/onboarding");
  }, [router]);

  // AM dropdown options (from currently loaded clients)
  const accountManagers = useMemo(
    () =>
      Array.from(
        clients.reduce((map, c) => {
          const id = c.amId ?? c.accountManager?.id;
          if (!id) return map;
          const nm = c.accountManager?.name ?? null;
          const email = c.accountManager?.email ?? null;
          const label = nm ? (email ? `${nm} (${email})` : nm) : String(id);
          if (!map.has(String(id)))
            map.set(String(id), { id: String(id), label });
          return map;
        }, new Map<string, { id: string; label: string }>())
      ).map(([, v]) => v),
    [clients]
  );

  // Client Data Section Component
  function ClientDataSection({ 
    clients,
    loading,
    viewMode,
    handleViewClientDetails,
    pagination,
    page,
    prevPage,
    nextPage
  }: {
    clients: Client[];
    loading: boolean;
    viewMode: "grid" | "list";
    handleViewClientDetails: (client: Client) => void;
    pagination: any;
    page: number;
    prevPage: () => void;
    nextPage: () => void;
  }) {
    if (loading) {
      return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={`client-skeleton-${index}`} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-18 rounded-full" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Skeleton className="h-9 flex-1 rounded" />
                  <Skeleton className="h-9 w-20 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    const hasClients = clients.length > 0;

    return (
      <>
        {!hasClients ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-lg border border-gray-100">
            <p className="text-lg font-medium mb-2">
              No clients found matching your criteria.
            </p>
            <p className="text-sm">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            <Suspense
              fallback={
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <ClientCardSkeleton key={i} />
                  ))}
                </div>
              }
            >
              {viewMode === "grid" ? (
                <ClientGrid
                  clients={clients}
                  onViewDetails={handleViewClientDetails}
                />
              ) : (
                <ClientList
                  clients={clients}
                  onViewDetails={handleViewClientDetails}
                />
              )}
            </Suspense>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex justify-center gap-4 mt-10">
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
          </>
        )}
      </>
    );
  }

  return (
    <div className="py-8 px-4 md:px-6">
      {/* Header + Summary - No refresh */}
      <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-100">
        <ClientOverviewHeader
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
          currentUserRole={currentUserRole}
          viewMode={viewMode}
          setViewMode={setViewMode}
          onAddNewClient={handleAddNewClient}
        />

        <ClientStatusSummary clients={clients} />
      </div>

      {/* Client Data Section - Refresh only this part */}
      <ClientDataSection 
        clients={clients}
        loading={loading}
        viewMode={viewMode}
        handleViewClientDetails={handleViewClientDetails}
        pagination={pagination}
        page={page}
        prevPage={prevPage}
        nextPage={nextPage}
      />
    </div>
  );
}
