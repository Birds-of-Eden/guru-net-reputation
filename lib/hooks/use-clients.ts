// lib/hooks/use-clients.ts
"use client";

import useSWR from "swr";
import { useCallback, useMemo, useState } from "react";
import type { Client } from "@/types/client";

interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface ApiResponse {
  clients: Client[];
  pagination: Pagination;
}

export function useClients() {
  // Local UI state for filters + pagination
  const [page, setPage] = useState(1);
  const [status, setStatusState] = useState<string>("all");
  const [packageId, setPackageIdState] = useState<string>("all");
  const [amId, setAmIdState] = useState<string>("all");
  const [search, setSearchState] = useState<string>("");

  // Changing any filter jumps back to page 1
  const setStatus = useCallback((v: string) => {
    setStatusState(v);
    setPage(1);
  }, []);
  const setPackageId = useCallback((v: string) => {
    setPackageIdState(v);
    setPage(1);
  }, []);
  const setAmId = useCallback((v: string) => {
    setAmIdState(v);
    setPage(1);
  }, []);
  const setSearch = useCallback((v: string) => {
    setSearchState(v);
    setPage(1);
  }, []);

  // Build API URL dynamically
  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "30");

    if (status !== "all") params.set("status", status);
    if (packageId !== "all") params.set("packageId", packageId);
    if (amId !== "all") params.set("amId", amId);
    if (search.trim() !== "") params.set("search", search.trim());

    return `/api/clients?${params.toString()}`;
  }, [page, status, packageId, amId, search]);

  // SWR fetcher
  const fetcher = async (url: string): Promise<ApiResponse> => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load clients");
    return res.json();
  };

  // Fetch via SWR
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(query, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 3000,
    keepPreviousData: true,
  });

  // Server already returns newest-first (createdAt desc), keep that order
  const clients = useMemo(() => data?.clients ?? [], [data?.clients]);
  const pagination = data?.pagination;

  // Helpers
  const nextPage = useCallback(() => {
    if (pagination && page < pagination.totalPages) {
      setPage(page + 1);
    }
  }, [page, pagination]);

  const prevPage = useCallback(() => {
    if (page > 1) setPage(page - 1);
  }, [page]);

  const resetFilters = useCallback(() => {
    setStatusState("all");
    setPackageIdState("all");
    setAmIdState("all");
    setSearchState("");
    setPage(1);
  }, []);

  return {
    clients,
    loading: isLoading && !data,
    isValidating: isLoading,
    error: error ?? null,
    refetch: async () => mutate(),
    pagination,

    // UI state setters
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

    resetFilters,
  };
}
