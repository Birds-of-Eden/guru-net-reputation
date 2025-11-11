// hooks/useSalesOverview.ts
import useSWR from "swr";
import { useMemo } from "react";

// ✅ Fast fetcher with cache control
const salesFetcher = async (url: string) => {
  const res = await fetch(url, {
    next: { revalidate: 60 }, // Cache for 60s
  });
  if (!res.ok) {
    const error: any = new Error("Failed to fetch sales overview");
    error.status = res.status;
    throw error;
  }
  return res.json();
};

export function useSalesOverview() {
  // ✅ SWR with aggressive caching
  const {
    data: rawData,
    error,
    isLoading,
    mutate,
  } = useSWR("/api/am/sales/overview", salesFetcher, {
    // ✅ Aggressive caching for instant loads
    dedupingInterval: 60000, // 60s dedup
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    refreshInterval: 0, // Manual refresh only
    keepPreviousData: true,
    revalidateIfStale: false,
    errorRetryCount: 3,
    errorRetryInterval: 1000,
  });

  // ✅ Memoized data processing
  const data = useMemo(() => {
    if (!rawData) return null;

    // Pre-process and validate data
    return {
      ...rawData,
      summary: {
        totalWithPackage: rawData.summary?.totalWithPackage || 0,
        totalSales: rawData.summary?.totalSales || 0,
        active: rawData.summary?.active || 0,
        expired: rawData.summary?.expired || 0,
        startingSoon: rawData.summary?.startingSoon || 0,
        expiringSoon: rawData.summary?.expiringSoon || 0,
        missingDates: rawData.summary?.missingDates || 0,
      },
      timeseries: (rawData.timeseries || []).map((item: any) => ({
        day: item.day,
        starts: item.starts || 0,
      })),
      byPackage: (rawData.byPackage || []).map((pkg: any) => ({
        ...pkg,
        clients: pkg.clients || 0,
        active: pkg.active || 0,
        expired: pkg.expired || 0,
        avgDaysLeft: pkg.avgDaysLeft || 0,
      })),
      packageSales: rawData.packageSales || [],
      totalSales: rawData.totalSales || 0,
      recent: rawData.recent || [],
      groupedClients: rawData.groupedClients || [],
    };
  }, [rawData]);

  return {
    data,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load sales data") : null,
    mutate,
    // Helper to force refresh
    refresh: () => mutate(),
  };
}
