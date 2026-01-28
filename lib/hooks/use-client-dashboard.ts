// lib/hooks/use-client-dashboard.ts
"use client";

import useSWR from "swr";
import { useEffect, useMemo } from "react";
import { Client } from "@/types/client";

const clientDashboardFetcher = async (url: string): Promise<any> => {
  const res = await fetch(url, {
    // Always hit origin; avoid ISR/route-cache from client-side fetches
    cache: "no-store",
  });
  if (!res.ok) {
    const error: any = new Error("Failed to fetch client dashboard");
    error.status = res.status;
    throw error;
  }
  return res.json();
};

interface UseClientDashboardOptions {
  clientId: string | null | undefined;
  // Enable sessionStorage hydration
  enableCache?: boolean;
  // Toggle near real-time refetching
  realtime?: boolean;
  // Optional custom polling interval (ms) when realtime=true
  refreshIntervalMs?: number;
}

const buildStorageKey = (clientId: string) => `client-dashboard:${clientId}`;

const readPersistedClient = (clientId?: string | null) => {
  if (!clientId || typeof window === "undefined") return undefined;
  try {
    const raw = window.sessionStorage.getItem(buildStorageKey(clientId));
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
};

export function useClientDashboard(options: UseClientDashboardOptions) {
  const {
    clientId,
    enableCache = true,
    realtime = false,
    refreshIntervalMs,
  } = options;

  // Reuse last-seen data from sessionStorage to make repeat visits instant
  const fallbackData = useMemo(
    () => (enableCache ? readPersistedClient(clientId) : undefined),
    [clientId, enableCache]
  );

  // SWR with aggressive caching configuration
  const {
    data: rawData,
    error,
    isLoading,
    mutate,
  } = useSWR(
    clientId ? `/api/clients/${clientId}` : null,
    clientDashboardFetcher,
    {
      // Keep previous data while fetching fresh
      keepPreviousData: true,
      // Default: single fetch + manual refresh to avoid request spam
      dedupingInterval: realtime ? 0 : enableCache ? 60000 : 5000,
      revalidateIfStale: realtime,
      revalidateOnFocus: realtime,
      revalidateOnReconnect: realtime,
      refreshInterval: realtime ? Math.max(800, refreshIntervalMs ?? 1000) : 0,
      // Seed with last cached data for instant direct visits
      fallbackData,
      // Error retry with exponential backoff
      errorRetryCount: 3,
      errorRetryInterval: 1000,
      // Suspense mode for better loading states
      suspense: false,
    }
  );

  useEffect(() => {
    if (!clientId || !rawData) return;
    try {
      window.sessionStorage.setItem(
        buildStorageKey(clientId),
        JSON.stringify(rawData)
      );
    } catch {
      /* ignore storage failures */
    }
  }, [clientId, rawData]);

  // Normalize client data with memoization
  const clientData = useMemo(() => {
    if (!rawData) return null;

    const uncategorized = {
      id: "uncategorized",
      name: "Uncategorized",
      description: "",
    };

    return {
      ...rawData,
      companywebsite:
        rawData?.companywebsite && typeof rawData.companywebsite === "string"
          ? rawData.companywebsite
          : "",
      tasks: (rawData?.tasks ?? []).map((t: any) => ({
        ...t,
        categoryId: t?.category?.id ?? t?.categoryId ?? "uncategorized",
        category: t?.category ?? uncategorized,
        name: String(t?.name ?? ""),
        priority: String(t?.priority ?? "medium"),
        status: String(t?.status ?? "pending"),
        templateSiteAsset: {
          ...t?.templateSiteAsset,
          type: String(t?.templateSiteAsset?.type ?? ""),
          name: String(t?.templateSiteAsset?.name ?? ""),
          url: String(t?.templateSiteAsset?.url ?? ""),
        },
      })),
    } as Client;
  }, [rawData]);

  return {
    clientData,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load client") : null,
    mutate,
    // Helper to force refresh
    refresh: () => mutate(),
  };
}
