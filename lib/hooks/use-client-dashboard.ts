// lib/hooks/use-client-dashboard.ts
"use client";

import useSWR from "swr";
import { useEffect, useMemo } from "react";
import { Client } from "@/types/client";

// Fast fetcher with explicit cache control
const clientDashboardFetcher = async (url: string): Promise<any> => {
  const res = await fetch(url, {
    // Use stale-while-revalidate for instant loading
    next: { revalidate: 60 }, // Cache for 60s
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
  // Enable aggressive caching for faster loads
  enableCache?: boolean;
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
  const { clientId, enableCache = true } = options;

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
      // Aggressive caching for instant loads
      dedupingInterval: enableCache ? 60000 : 2000, // 60s dedup
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: false, // Don't refetch on reconnect
      refreshInterval: 0, // No auto-refresh (manual only)
      // Keep previous data while revalidating
      keepPreviousData: true,
      // Return cache first, then revalidate in background
      revalidateIfStale: false,
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
