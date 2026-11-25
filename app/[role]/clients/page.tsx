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

// Build page list like: 1 … 4 5 [6] 7 8 … 20
function getPageItems(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const items: (number | "ellipsis")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) items.push("ellipsis");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < totalPages - 1) items.push("ellipsis");
  items.push(totalPages);
  return items;
}

function ClientsPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const btn =
    "min-w-9 h-9 px-3 rounded-md border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const idle =
    "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 dark:bg-card dark:border-border dark:text-foreground dark:hover:bg-muted";
  const active =
    "bg-primary border-primary text-primary-foreground";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-10">
      <p className="text-sm text-gray-500 dark:text-muted-foreground">
        Showing <span className="font-medium">{from}</span>–
        <span className="font-medium">{to}</span> of{" "}
        <span className="font-medium">{totalCount}</span> clients
      </p>

      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center gap-1" aria-label="Pagination">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className={`${btn} ${idle}`}
          >
            Previous
          </button>
          {getPageItems(page, totalPages).map((item, i) =>
            item === "ellipsis" ? (
              <span key={`e${i}`} className="px-2 text-gray-400">
                …
              </span>
            ) : (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                aria-current={item === page ? "page" : undefined}
                className={`${btn} ${item === page ? active : idle}`}
              >
                {item}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className={`${btn} ${idle}`}
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}

// Client Data Section Component
function ClientDataSection({ 
  clients, 
  loading, 
  viewMode, 
  handleViewClientDetails,
  pagination,
  page,
  goToPage,
}: {
  clients: Client[];
  loading: boolean;
  viewMode: "grid" | "list";
  handleViewClientDetails: (client: Client) => void;
  pagination: any;
  page: number;
  goToPage: (page: number) => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <ClientCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-100 dark:bg-card dark:border-border">
        <ClientStatusSummary clients={clients} />
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-lg border border-gray-100 dark:text-muted-foreground dark:bg-card dark:border-border">
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
      {pagination && pagination.totalCount > 0 && (
        <ClientsPagination
          page={page}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          pageSize={pagination.pageSize}
          onPageChange={goToPage}
        />
      )}
    </>
  );
}

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

  const goToPage = useCallback(
    (p: number) => {
      setPage(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setPage]
  );

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

  return (
    <div className="py-8 px-4 md:px-6">
      {/* Header - No refresh */}
      <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-100 dark:bg-card dark:border-border">
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
      </div>

      {/* Client Data Section - Refresh only this part */}
      <ClientDataSection 
        clients={clients}
        loading={loading}
        viewMode={viewMode}
        handleViewClientDetails={handleViewClientDetails}
        pagination={pagination}
        page={page}
        goToPage={goToPage}
      />
    </div>
  );
}
