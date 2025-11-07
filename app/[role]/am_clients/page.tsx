// app/[role]/am_clients/page.tsx

"use client";

import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ClientOverviewHeader } from "@/components/clients/client-overview-header";
import { ClientStatusSummary } from "@/components/clients/client-status-summary";
import { ClientCardSkeleton } from "@/components/clients/client-card-skeleton";
import type { Client } from "@/types/client";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { useClients } from "@/lib/hooks/use-clients";
// Lazy load heavy components
const ClientGrid = lazy(() => import("@/components/clients/client-grid").then(m => ({ default: m.ClientGrid })));
const ClientList = lazy(() => import("@/components/clients/client-list").then(m => ({ default: m.ClientList })));

export default function ClientsPage() {
  const router = useRouter();

  // ✅ হুক থেকে user / loading সঠিকভাবে নাও
  const { user, loading: sessionLoading } = useUserSession();

  // Use optimized custom hook for client fetching with caching
  const { clients, loading } = useClients();
  
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [amFilter, setAmFilter] = useState("all");

  // Debounce search input to reduce filtering operations
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);

  const currentUserId = user?.id ?? undefined;
  const currentUserRole = user?.role ?? undefined; // hook এ role string আসে
  const isAM = (currentUserRole ?? "").toLowerCase() === "am";

  // ✅ AM হলে UI ফিল্টারও জোর করে নিজের amId-তে সেট করো
  useEffect(() => {
    if (
      !sessionLoading &&
      isAM &&
      currentUserId &&
      amFilter !== currentUserId
    ) {
      setAmFilter(currentUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLoading, isAM, currentUserId]);


  // --- Packages ফেচ - Memoized ---
  const fetchPackages = useCallback(async () => {
    try {
      const resp = await fetch("/api/packages");
      if (!resp.ok) throw new Error("Failed to fetch packages");

      const raw = await resp.json();
      const list =
        (Array.isArray(raw) && raw) ||
        (Array.isArray(raw?.data) && raw.data) ||
        [];

      const mapped: { id: string; name: string }[] = (list as any[]).map(
        (p) => ({
          id: String(p.id),
          name: String(p.name ?? "Unnamed"),
        })
      );
      setPackages(mapped);
    } catch {
      // fallback: বর্তমান clients থেকে derive করো
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
  }, [clients]);

  // Fetch packages only when clients are loaded
  useEffect(() => {
    if (!sessionLoading && clients.length > 0) {
      fetchPackages();
    }
  }, [sessionLoading, clients.length, fetchPackages]);

  // Navigate to details
  const handleViewClientDetails = (client: Client) => {
    router.push(`/am/clients/${client.id}`);
  };

  const handleAddNewClient = useCallback(() => {
    router.push("/am/clients/onboarding");
  }, [router]);

  // Account manager options build (AM হলে নিজেরটাই থাকবে)
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

  // Client-side নিরাপত্তা ফিল্টার with useMemo
  const filteredClients = useMemo(() => clients.filter((client) => {
    // status filter
    if (
      statusFilter !== "all" &&
      (client.status ?? "").toLowerCase() !== statusFilter.toLowerCase()
    ) {
      return false;
    }

    // package filter (string compare)
    const clientPkgId =
      client.packageId != null ? String(client.packageId) : null;
    if (packageFilter !== "all" && clientPkgId !== String(packageFilter)) {
      return false;
    }

    // AM scope (string compare)
    const effectiveAmFilter =
      isAM && currentUserId
        ? String(currentUserId)
        : amFilter === "all"
        ? "all"
        : String(amFilter);
    const clientAm = client.amId ?? client.accountManager?.id ?? null;
    if (
      effectiveAmFilter !== "all" &&
      String(clientAm ?? "") !== effectiveAmFilter
    ) {
      return false;
    }

    // search filter using debounced search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      const hit =
        client.name?.toLowerCase().includes(q) ||
        client.company?.toLowerCase().includes(q) ||
        client.designation?.toLowerCase().includes(q) ||
        client.email?.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  }), [clients, statusFilter, packageFilter, isAM, currentUserId, amFilter, debouncedSearch]);

  // Loading UI with skeleton
  if (sessionLoading || loading) {
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
      {/* Header + Summary */}
      <div className="bg-white p-6 rounded-xl shadow-lg mb-8 border border-gray-100">
        <ClientOverviewHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          packageFilter={packageFilter}
          setPackageFilter={setPackageFilter}
          packages={packages} // [{ id, name }]
          amFilter={amFilter}
          setAmFilter={setAmFilter}
          accountManagers={accountManagers} // [{ id, label }]
          currentUserId={currentUserId}
          currentUserRole={currentUserRole} // e.g. "am"
          viewMode={viewMode}
          setViewMode={setViewMode}
          onAddNewClient={handleAddNewClient}
        />
        <ClientStatusSummary clients={clients} />
      </div>

      {/* Clients Grid or List with Suspense for lazy loading */}
      {filteredClients.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-lg border border-gray-100">
          <p className="text-lg font-medium mb-2">
            No clients found matching your criteria.
          </p>
          <p className="text-sm">Try adjusting your search or filters.</p>
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
              clients={filteredClients}
              onViewDetails={handleViewClientDetails}
            />
          ) : (
            <ClientList
              clients={filteredClients}
              onViewDetails={handleViewClientDetails}
            />
          )}
        </Suspense>
      )}
    </div>
  );
}
