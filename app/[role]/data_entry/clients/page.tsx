// app/[role]/data_entry_dashboard/page.tsx

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
import useSWR from "swr";

import { ClientOverviewHeader } from "@/components/clients/client-overview-header";
import { ClientStatusSummary } from "@/components/clients/client-status-summary";
import DataEntryClientStats from "@/components/dataentry/DataEntryClientStats";
import { ClientCardSkeleton } from "@/components/clients/client-card-skeleton";

import type { Client } from "@/types/client";
import { useUserSession } from "@/lib/hooks/use-user-session";

const LazyClientGrid = lazy(() =>
  import("@/components/clients/client-grid").then((m) => ({
    default: m.ClientGrid,
  }))
);
const LazyClientList = lazy(() =>
  import("@/components/clients/client-list").then((m) => ({
    default: m.ClientList,
  }))
);

// -------------------- SWR fetchers --------------------

type ClientsApiResponse = {
  clients: Client[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
};

const clientsFetcher = async (url: string): Promise<ClientsApiResponse> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to fetch clients");
  }
  const json = await res.json();
  const clients = Array.isArray(json?.clients)
    ? (json.clients as Client[])
    : [];
  const pagination = json?.pagination ?? {
    page: 1,
    pageSize: clients.length,
    totalCount: clients.length,
    totalPages: 1,
  };
  return { clients, pagination };
};

type PackageItem = { id: string; name: string };

const packagesFetcher = async (url: string): Promise<PackageItem[]> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch packages");
  const raw = await res.json();
  const list = Array.isArray(raw) ? raw : raw?.data ?? [];
  return (list as any[]).map((p) => ({
    id: String(p?.id),
    name: String(p?.name ?? "Unnamed"),
  }));
};

// -------------------- PAGE --------------------

export default function DataEntryDashboardPage() {
  const router = useRouter();
  const { user: sessionUser, loading: sessionLoading } = useUserSession();

  const currentUserId = sessionUser?.id ?? undefined;
  const currentUserRole =
    (sessionUser?.role as string | undefined) ||
    (sessionUser?.roleId as string | undefined);

  const roleLower = (currentUserRole ?? "").toLowerCase();
  const isAM = roleLower === "am";
  const isDataEntry = roleLower === "data_entry";

  // ---------- Filters & pagination ----------
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [amFilter, setAmFilter] = useState("all");

  const [page, setPage] = useState(1);
  const pageSize = 24;

  // Auto-set AM filter to current user if AM
  useEffect(() => {
    if (
      !sessionLoading &&
      isAM &&
      currentUserId &&
      amFilter !== currentUserId
    ) {
      setAmFilter(currentUserId);
    }
  }, [sessionLoading, isAM, currentUserId, amFilter]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build API URL for /api/clients (server-side pagination + AM filter)
  const clientsApiKey = useMemo(() => {
    if (!currentUserId) return null;

    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    // For AM: use amId to limit to own clients
    const effectiveAmFilter = isAM && currentUserId ? currentUserId : amFilter;
    if (effectiveAmFilter && effectiveAmFilter !== "all") {
      params.set("amId", effectiveAmFilter);
    }

    // Backend supports packageId filter already
    if (packageFilter !== "all") {
      params.set("packageId", packageFilter);
    }

    // (Optional) You can also pass search/status here once API supports them

    return `/api/clients?${params.toString()}`;
  }, [currentUserId, isAM, amFilter, packageFilter, page, pageSize]);

  // ---------- SWR: clients ----------
  const {
    data: clientsPayload,
    error: clientsError,
    isLoading: clientsLoading,
    mutate: refetchClients,
  } = useSWR<ClientsApiResponse>(
    clientsApiKey,
    clientsApiKey ? clientsFetcher : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 8000,
      refreshInterval: 30000,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  );

  const clients = clientsPayload?.clients ?? [];
  const pagination = clientsPayload?.pagination ?? {
    page: 1,
    pageSize,
    totalCount: clients.length,
    totalPages: 1,
  };

  // ---------- SWR: packages ----------
  const { data: packagesData, isLoading: packagesLoading } = useSWR<
    PackageItem[]
  >("/api/packages", packagesFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 30000,
    refreshInterval: 300000,
    errorRetryCount: 2,
    errorRetryInterval: 3000,
  });

  const packages = packagesData ?? [];
  const loading = sessionLoading || clientsLoading || packagesLoading;

  // ---------- Filtered clients (search + status on current page) ----------
  const filteredClients = useMemo(() => {
    let result = clients;

    // 🟦 NEW: Only show clients assigned to this data-entry user
    if (isDataEntry && currentUserId) {
      result = result.filter((client) =>
        client.teamMembers?.some((tm) => tm.agentId === currentUserId)
      );
    }

    // Search filter
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      result = result.filter(
        (client) =>
          client?.name?.toLowerCase().includes(q) ||
          client?.company?.toLowerCase().includes(q) ||
          client?.designation?.toLowerCase().includes(q) ||
          client?.email?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      const s = statusFilter.toLowerCase();
      result = result.filter(
        (client) => (client?.status ?? "").toLowerCase() === s
      );
    }

    // Package filter (backup filter)
    if (packageFilter !== "all") {
      result = result.filter((client) => client?.packageId === packageFilter);
    }

    // AM Filter (backup)
    const effectiveAmFilter = isAM && currentUserId ? currentUserId : amFilter;
    if (effectiveAmFilter !== "all") {
      result = result.filter(
        (client) =>
          (client?.amId ?? client?.accountManager?.id) === effectiveAmFilter
      );
    }

    return result;
  }, [
    clients,
    debouncedSearch,
    statusFilter,
    packageFilter,
    amFilter,
    isAM,
    isDataEntry,
    currentUserId,
  ]);

  // ---------- Account managers options ----------
  const accountManagers = useMemo(() => {
    return Array.from(
      clients.reduce((map, client) => {
        const rawId = client?.amId ?? client?.accountManager?.id;
        if (!rawId) return map;
        // Prefix to avoid collisions with other possible ids
        const id = `am:${rawId}`;
        const nm = client?.accountManager?.name ?? null;
        const email = client?.accountManager?.email ?? null;
        const label = nm ? (email ? `${nm} (${email})` : nm) : rawId;
        if (!map.has(id)) map.set(id, { id, label, rawId });
        return map;
      }, new Map<string, { id: string; label: string; rawId: string }>())
    ).map(([, v]) => ({ id: v.id, label: v.label }));
  }, [clients]);

  // We also need the "raw" AM id to send to backend; derive it from amFilter
  const effectiveBackendAmId = useMemo(() => {
    // If AM, force own id
    if (isAM && currentUserId) return currentUserId;

    if (amFilter === "all") return undefined;
    // amFilter stores "am:<rawId>" form
    if (amFilter.startsWith("am:")) {
      return amFilter.slice(3);
    }
    return amFilter;
  }, [amFilter, isAM, currentUserId]);

  // If backend AM filter changed, go back to first page
  useEffect(() => {
    setPage(1);
  }, [effectiveBackendAmId, packageFilter, statusFilter, debouncedSearch]);

  // ---------- Handlers ----------
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value);
  }, []);

  const handlePackageFilterChange = useCallback((value: string) => {
    setPackageFilter(value);
  }, []);

  const handleAmFilterChange = useCallback((value: string) => {
    setAmFilter(value);
  }, []);

  const handleViewModeChange = useCallback((mode: "grid" | "list") => {
    setViewMode(mode);
  }, []);

  const handleViewClientDetails = useCallback(
    (client: Client) => {
      router.push(`/data_entry/clients/${client.id}`);
    },
    [router]
  );

  const handleAddNewClient = useCallback(() => {
    if (isDataEntry) {
      router.push(`/data_entry/data_entry/clients/onboarding`);
    }
  }, [isDataEntry, router]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setPackageFilter("all");
    setAmFilter(isAM && currentUserId ? `am:${currentUserId}` : "all");
    setPage(1);
  }, [isAM, currentUserId]);

  const handleNextPage = useCallback(() => {
    if (page < pagination.totalPages) setPage((p) => p + 1);
  }, [page, pagination.totalPages]);

  const handlePrevPage = useCallback(() => {
    if (page > 1) setPage((p) => p - 1);
  }, [page]);

  // ---------- Loading ----------
  if (loading) {
    return (
      <div className="py-8 px-4 md:px-6">
        <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-100">
          <div className="h-12 bg-gray-200 rounded animate-pulse mb-4" />
          <div className="flex gap-4 mb-4">
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
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

  // ---------- Render ----------
  return (
    <div className="py-8 px-4 md:px-6">
      {/* Header + Summary */}
      <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-100">
        <ClientOverviewHeader
          searchQuery={searchQuery}
          setSearchQuery={handleSearchChange}
          statusFilter={statusFilter}
          setStatusFilter={handleStatusFilterChange}
          packageFilter={packageFilter}
          setPackageFilter={handlePackageFilterChange}
          packages={packages}
          amFilter={amFilter}
          setAmFilter={handleAmFilterChange}
          accountManagers={accountManagers}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          viewMode={viewMode}
          setViewMode={handleViewModeChange}
          onAddNewClient={handleAddNewClient}
        />
        <ClientStatusSummary clients={clients} />
      </div>

      {/* Data Entry Client Stats */}
      <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-100">
        <DataEntryClientStats clients={clients} />
      </div>

      {/* Clients list + pagination */}
      {filteredClients.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-lg border border-gray-100">
          <p className="text-lg font-medium mb-2">
            No clients found matching your criteria.
          </p>
          <p className="text-sm">Try adjusting your search or filters.</p>
          {(searchQuery ||
            statusFilter !== "all" ||
            packageFilter !== "all" ||
            amFilter !== "all") && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleClearFilters}
                className="rounded-2xl h-12 px-6 font-semibold border-2 hover:bg-slate-100 transition-all"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500" />
              </div>
            }
          >
            {viewMode === "grid" ? (
              <LazyClientGrid
                clients={filteredClients}
                onViewDetails={handleViewClientDetails}
              />
            ) : (
              <LazyClientList
                clients={filteredClients}
                onViewDetails={handleViewClientDetails}
              />
            )}
          </Suspense>

          {/* Pagination controls */}
          <div className="mt-6 flex items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              Page <span className="font-semibold">{pagination.page}</span> of{" "}
              <span className="font-semibold">{pagination.totalPages}</span> •{" "}
              <span className="font-semibold">
                {pagination.totalCount.toLocaleString()}
              </span>{" "}
              clients
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrevPage}
                disabled={page <= 1}
                className="px-4 py-2 rounded-lg border bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={page >= pagination.totalPages}
                className="px-4 py-2 rounded-lg border bg-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
