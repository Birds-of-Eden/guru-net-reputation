// app/[role]/data_entry_dashboard/page.tsx

"use client";

import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ClientOverviewHeader } from "@/components/clients/client-overview-header";
import { ClientStatusSummary } from "@/components/clients/client-status-summary";
import { ClientGrid } from "@/components/clients/client-grid";
import { ClientList } from "@/components/clients/client-list";
import type { Client } from "@/types/client";

// ✅ useSession এর বদলে তোমার কাস্টম হুক
import { useUserSession } from "@/lib/hooks/use-user-session";
import DataEntryClientStats from "@/components/dataentry/DataEntryClientStats";
import useSWR from "swr";

// Lazy load components for better performance
const LazyClientGrid = lazy(() => import("@/components/clients/client-grid").then(m => ({ default: m.ClientGrid })));
const LazyClientList = lazy(() => import("@/components/clients/client-list").then(m => ({ default: m.ClientList })));

// Custom hooks for data fetching with SWR
const useClientsData = (currentUserId?: string, isAM?: boolean) => {
  const { data: clientsData, error, isLoading, mutate } = useSWR(
    currentUserId ? "/api/dataentryclient" : null,
    async (url: string) => {
      const fetchUrl = new URL(url, window.location.origin);
      if (isAM && currentUserId) fetchUrl.searchParams.set("amId", currentUserId);
      if (!isAM && currentUserId) fetchUrl.searchParams.set("assignedAgentId", currentUserId);

      const response = await fetch(fetchUrl.toString(), { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch clients");

      const payload = await response.json();
      return Array.isArray(payload?.clients) ? (payload.clients as Client[]) : [];
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 10000,
      refreshInterval: 30000,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  );

  return { clients: clientsData || [], loading: isLoading, error, refetch: mutate };
};

const usePackagesData = () => {
  const { data: packagesData, error, isLoading } = useSWR(
    "/api/packages",
    async (url: string) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch packages");

      const raw = await response.json();
      const list = Array.isArray(raw) ? raw : raw?.data ?? [];

      return (list as any[]).map((p) => ({
        id: String(p?.id),
        name: String(p?.name ?? "Unnamed"),
      }));
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 30000,
      refreshInterval: 300000, // 5 minutes for packages
      errorRetryCount: 2,
      errorRetryInterval: 3000,
    }
  );

  return { packages: packagesData || [], loading: isLoading, error };
};

export default function ClientsPage() {
  const router = useRouter();

  // ✅ কাস্টম সেশন হুক
  const { user: sessionUser, loading: sessionLoading } = useUserSession();

  // User context
  const currentUserId = sessionUser?.id ?? undefined;
  const currentUserRole =
    (sessionUser?.role as string | undefined) ||
    (sessionUser?.roleId as string | undefined);
  const isAM = (currentUserRole ?? "").toLowerCase() === "am";

  // Use SWR hooks for data fetching
  const { clients, loading: clientsLoading, refetch: refetchClients } = useClientsData(
    currentUserId,
    isAM
  );
  const { packages, loading: packagesLoading } = usePackagesData();

  // Combined loading state
  const loading = clientsLoading || packagesLoading;

  // View mode state
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Debounced search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [amFilter, setAmFilter] = useState("all");

  // AM filter auto-set effect
  useEffect(() => {
    if (!sessionLoading && isAM && currentUserId && amFilter !== currentUserId) {
      setAmFilter(currentUserId);
    }
  }, [sessionLoading, isAM, currentUserId, amFilter]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Pre-indexed filtering for O(1) lookups
  const filteredClients = useMemo(() => {
    let result = clients;

    // Apply search filter
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase().trim();
      result = result.filter((client) =>
        client?.name?.toLowerCase().includes(query) ||
        client?.company?.toLowerCase().includes(query) ||
        client?.designation?.toLowerCase().includes(query) ||
        client?.email?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      result = result.filter(
        (client) => (client?.status ?? "").toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Apply package filter
    if (packageFilter !== "all") {
      result = result.filter((client) => client?.packageId === packageFilter);
    }

    // Apply AM filter
    const effectiveAmFilter = isAM && currentUserId ? currentUserId : amFilter;
    if (effectiveAmFilter !== "all") {
      result = result.filter(
        (client) => (client?.amId ?? client?.accountManager?.id) === effectiveAmFilter
      );
    }

    return result;
  }, [clients, debouncedSearch, statusFilter, packageFilter, amFilter, isAM, currentUserId]);

  // Build account manager options safely
  const accountManagers = useMemo(() => {
    return Array.from(
      clients.reduce((map, client) => {
        const id = client?.amId ?? client?.accountManager?.id;
        if (!id) return map;
        const nm = client?.accountManager?.name ?? null;
        const email = client?.accountManager?.email ?? null;
        const label = nm ? (email ? `${nm} (${email})` : nm) : id;
        if (!map.has(id)) map.set(id, { id, label });
        return map;
      }, new Map<string, { id: string; label: string }>())
    ).map(([, v]) => v);
  }, [clients]);

  // Optimized callback functions
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

  // Navigate to details
  const handleViewClientDetails = useCallback((client: Client) => {
    router.push(`/data_entry/clients/${client.id}`);
  }, [router]);

  const handleAddNewClient = useCallback(() => {
    const role = (currentUserRole ?? "").toLowerCase();
    if (role === "data_entry") {
      router.push(`/${role}/data_entry/clients/onboarding`);
    }
  }, [currentUserRole, router]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setPackageFilter("all");
    setAmFilter(isAM && currentUserId ? currentUserId : "all");
  }, [isAM, currentUserId]);

  // ✅ loading UI: সেশন লোড + ডেটা লোড—দুটোই কভার
  if (loading || sessionLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

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

      {/* Clients Grid or List with Lazy Loading */}
      {filteredClients.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-lg border border-gray-100">
          <p className="text-lg font-medium mb-2">
            No clients found matching your criteria.
          </p>
          <p className="text-sm">Try adjusting your search or filters.</p>
          {(searchQuery || statusFilter !== "all" || packageFilter !== "all" || amFilter !== "all") && (
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
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
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
      )}
    </div>
  );
}
