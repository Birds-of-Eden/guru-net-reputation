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
  const [status, setStatus] = useState<string>("all");
  const [packageId, setPackageId] = useState<string>("all");
  const [amId, setAmId] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

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
  });

  const clients = useMemo(() => {
    const items = [...(data?.clients ?? [])];
    items.sort((a, b) => {
      const aDraft = String(a.status ?? "").trim().toLowerCase() === "draft";
      const bDraft = String(b.status ?? "").trim().toLowerCase() === "draft";
      if (aDraft !== bDraft) return aDraft ? -1 : 1;

      const aCreated = new Date(a.createdAt ?? 0).getTime();
      const bCreated = new Date(b.createdAt ?? 0).getTime();
      return bCreated - aCreated;
    });
    return items;
  }, [data?.clients]);
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
    setStatus("all");
    setPackageId("all");
    setAmId("all");
    setSearch("");
    setPage(1);
  }, []);

  return {
    clients,
    loading: isLoading,
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
