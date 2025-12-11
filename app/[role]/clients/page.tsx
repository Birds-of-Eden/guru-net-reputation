"use client";

import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ClientOverviewHeader } from "@/components/clients/client-overview-header";
import { ClientStatusSummary } from "@/components/clients/client-status-summary";

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

import { ClientCardSkeleton } from "@/components/clients/client-card-skeleton";
import type { Client } from "@/types/client";
import { useRoleSegment } from "@/lib/hooks/use-role-segment";
import { useClients } from "@/lib/hooks/use-clients";

export default function ClientsPage() {
  const router = useRouter();
  const roleSegment = useRoleSegment();

  // NEW hook structure (pagination + filters)
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

  // Fetch Packages for filter dropdowns
  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await fetch("/api/packages");
        const raw = await res.json();
        const list = Array.isArray(raw) ? raw : raw?.data ?? [];
        setPackages(
          list.map((p: any) => ({
            id: String(p.id),
            name: p.name ?? "Unnamed",
          }))
        );
      } catch {
        setPackages([]);
      }
    };

    fetchPackages();
  }, []);

  const handleViewClientDetails = useCallback(
    (client: Client) => {
      router.push(`/${roleSegment}/clients/${client.id}`);
    },
    [router, roleSegment]
  );

  const handleAddNewClient = useCallback(
    () => router.push(`/${roleSegment}/clients/onboarding`),
    [router, roleSegment]
  );

  const accountManagers = Array.from(
    clients.reduce((map, c) => {
      const id = c.amId ?? c.accountManager?.id;
      if (!id) return map;
      const name = c.accountManager?.name ?? "Unknown AM";

      if (!map.has(id)) {
        map.set(id, { id, label: name });
      }

      return map;
    }, new Map<string, { id: string; label: string }>())
  ).map(([, v]) => v);

  if (loading) {
    return (
      <div className="py-8 px-4 md:px-6">
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-100">
          <div className="h-12 bg-gray-200 rounded animate-pulse mb-4"></div>
          <div className="flex gap-4 mb-4">
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
          viewMode={viewMode}
          setViewMode={setViewMode}
          onAddNewClient={handleAddNewClient}
        />

        <ClientStatusSummary clients={clients} />
      </div>

      {/* Client List / Grid */}
      {clients.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-lg border border-gray-100">
          <p className="text-lg font-medium mb-2">
            No clients found matching your criteria.
          </p>
        </div>
      ) : (
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
      )}

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
    </div>
  );
}
