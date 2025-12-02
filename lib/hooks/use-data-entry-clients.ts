// lib/hooks/use-data-entry-clients.ts
// Enhanced hook for data entry clients with SWR integration and pre-indexed filtering

"use client";

import useSWR from "swr";
import { useMemo } from "react";
import type { Client } from "@/types/client";

// Pre-indexed data structure for O(1) lookups
interface ClientIndex {
  byStatus: Map<string, Client[]>;
  byPackage: Map<string, Client[]>;
  byAM: Map<string, Client[]>;
  all: Client[];
}

interface UseDataEntryClientsReturn {
  clients: Client[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  // Pre-indexed data for super-fast filtering
  index: ClientIndex;
  // Optimized filter function
  getFilteredClients: (filters: {
    status?: string;
    packageId?: string;
    amId?: string;
    searchQuery?: string;
  }) => Client[];
}

interface FetchParams {
  amId?: string;
  assignedAgentId?: string;
}

// Fetcher function for SWR
const fetcher = async (url: string): Promise<Client[]> => {
  const response = await fetch(url, {
    cache: "force-cache",
    next: { revalidate: 10 },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch data entry clients");
  }

  const payload = await response.json();
  return Array.isArray(payload?.clients) ? payload.clients : [];
};

// Helper function to build pre-indexed data structure
function buildClientIndex(clients: Client[]): ClientIndex {
  const byStatus = new Map<string, Client[]>();
  const byPackage = new Map<string, Client[]>();
  const byAM = new Map<string, Client[]>();

  clients.forEach((client) => {
    // Index by status
    const status = (client.status || "unknown").toLowerCase();
    if (!byStatus.has(status)) byStatus.set(status, []);
    byStatus.get(status)!.push(client);

    // Index by package
    const pkgId = client.packageId || "unassigned";
    if (!byPackage.has(pkgId)) byPackage.set(pkgId, []);
    byPackage.get(pkgId)!.push(client);

    // Index by AM
    const amId = client.amId || client.accountManager?.id || "unassigned";
    if (!byAM.has(amId)) byAM.set(amId, []);
    byAM.get(amId)!.push(client);
  });

  return { byStatus, byPackage, byAM, all: clients };
}

// Build SWR key with params
function buildSwrKey(params?: FetchParams): string | null {
  if (!params) return null;

  const url = new URL("/api/dataentryclient", window.location.origin);
  if (params.amId) url.searchParams.set("amId", params.amId);
  if (params.assignedAgentId) url.searchParams.set("assignedAgentId", params.assignedAgentId);

  return url.toString();
}

export function useDataEntryClients(params?: FetchParams): UseDataEntryClientsReturn {
  // ✅ SWR integration with auto-revalidation
  const swrKey = buildSwrKey(params);
  const { data, error, mutate, isLoading } = useSWR<Client[]>(
    swrKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
      refreshInterval: 30000, // Auto-refresh every 30 seconds
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  );

  // Memoize clients to prevent unnecessary recalculations
  const clients = useMemo(() => data || [], [data]);

  // ✅ Pre-indexed data structure - memoized for performance
  const index = useMemo(() => {
    return buildClientIndex(clients);
  }, [clients]);

  // ✅ Optimized filter function using pre-indexed data
  const getFilteredClients = useMemo(
    () =>
      (filters: {
        status?: string;
        packageId?: string;
        amId?: string;
        searchQuery?: string;
      }) => {
        let result = clients;

        // Use pre-indexed data for O(1) filtering when possible
        if (filters.status && filters.status !== "all") {
          const statusClients = index.byStatus.get(
            filters.status.toLowerCase()
          );
          if (statusClients) {
            result = result.filter((c) => statusClients.includes(c));
          } else {
            return []; // No clients with this status
          }
        }

        if (filters.packageId && filters.packageId !== "all") {
          const pkgClients = index.byPackage.get(filters.packageId);
          if (pkgClients) {
            result = result.filter((c) => pkgClients.includes(c));
          } else {
            return [];
          }
        }

        if (filters.amId && filters.amId !== "all") {
          const amClients = index.byAM.get(filters.amId);
          if (amClients) {
            result = result.filter((c) => amClients.includes(c));
          } else {
            return [];
          }
        }

        // Search filter (still O(n) but on reduced dataset)
        if (filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          result = result.filter(
            (client) =>
              client.name?.toLowerCase().includes(q) ||
              client.company?.toLowerCase().includes(q) ||
              client.designation?.toLowerCase().includes(q) ||
              client.email?.toLowerCase().includes(q)
          );
        }

        return result;
      },
    [clients, index]
  );

  return {
    clients,
    loading: isLoading,
    error: error || null,
    refetch: async () => {
      await mutate();
    },
    index,
    getFilteredClients,
  };
}
