// lib/hooks/use-agent-clients.ts
"use client";

import useSWR from "swr";
import { useEffect, useMemo } from "react";
import type { ClientData } from "@/components/agent-task-dashboard-ui";

// Fast fetcher with explicit cache control
const agentClientsFetcher = async (url: string): Promise<ClientData[]> => {
  const res = await fetch(url, {
    // Use stale-while-revalidate for instant loading
    next: { revalidate: 30 }, // Cache for 30s
  });
  if (!res.ok) {
    const error: any = new Error("Failed to fetch agent clients");
    error.status = res.status;
    throw error;
  }
  return res.json();
};

interface UseAgentClientsOptions {
  agentId: string | null | undefined;
  excludeCategories?: string[];
  enableCache?: boolean;
}

const buildStorageKey = (agentId: string, excludeCategories: string[]) =>
  `agent-clients:${agentId}:${excludeCategories.join(",")}`;

const readPersistedClients = (agentId?: string | null, excludeCategories?: string[]) => {
  if (!agentId || typeof window === "undefined") return undefined;
  try {
    const key = buildStorageKey(agentId, excludeCategories || []);
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
};

export function useAgentClients(options: UseAgentClientsOptions) {
  const { agentId, excludeCategories = [], enableCache = true } = options;

  // Reuse last-seen data from sessionStorage to make repeat visits instant
  const fallbackData = useMemo(
    () => (enableCache ? readPersistedClients(agentId, excludeCategories) : undefined),
    [agentId, excludeCategories, enableCache]
  );

  // Build URL with query params
  const url = useMemo(() => {
    if (!agentId) return null;
    const params = new URLSearchParams();
    if (excludeCategories.length > 0) {
      params.set("excludeCategories", excludeCategories.join(","));
    }
    return `/api/tasks/clients/agents/${agentId}?${params.toString()}`;
  }, [agentId, excludeCategories]);

  // SWR with aggressive caching configuration
  const {
    data: clientsData,
    error,
    isLoading,
    mutate,
  } = useSWR(url, agentClientsFetcher, {
    // Aggressive caching for instant loads
    dedupingInterval: enableCache ? 30000 : 2000, // 30s dedup
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
  });

  // Persist data to sessionStorage for instant repeats
  useEffect(() => {
    if (!agentId || !clientsData) return;
    try {
      const key = buildStorageKey(agentId, excludeCategories);
      window.sessionStorage.setItem(key, JSON.stringify(clientsData));
    } catch {
      /* ignore storage failures */
    }
  }, [agentId, clientsData, excludeCategories]);

  return {
    clients: clientsData || [],
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load clients") : null,
    mutate,
    // Helper to force refresh
    refresh: () => mutate(),
  };
}
