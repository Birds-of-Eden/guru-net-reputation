// lib/hooks/use-template-management.ts
"use client";

import useSWR from "swr";
import { useMemo, useCallback } from "react";

interface SiteAsset {
  id: string;
  type: string;
  [key: string]: unknown;
}

interface TemplateSiteAsset {
  id: string;
  defaultPostingFrequency: number | null;
  [key: string]: unknown;
}

interface SiteAssetSetting {
  id: string;
  requiredFrequency: number | null;
  templateSiteAsset?: TemplateSiteAsset;
  [key: string]: unknown;
}

interface Template {
  id: string;
  sitesAssets?: SiteAsset[];
  templateTeamMembers?: Array<{ id: string }>;
  [key: string]: unknown;
}

interface Assignment {
  id: string;
  template: Template;
  siteAssetSettings?: SiteAssetSetting[];
  [key: string]: unknown;
}

interface ApiError extends Error {
  status?: number;
}

// Fast fetcher with cache control
const templateFetcher = async (url: string): Promise<Assignment[]> => {
  const res = await fetch(url, {
    next: { revalidate: 30 }, // Cache for 30s
  });
  if (!res.ok) {
    const error = new Error("Failed to fetch template data") as ApiError;
    error.status = res.status;
    throw error;
  }
  return res.json();
};

interface UseTemplateManagementOptions {
  clientId: string | null | undefined;
  enableCache?: boolean;
}

export function useTemplateManagement(options: UseTemplateManagementOptions) {
  const { clientId, enableCache = true } = options;

  // SWR with aggressive caching
  const {
    data: assignments,
    error,
    isLoading,
    mutate,
  } = useSWR(
    clientId ? `/api/assignments?clientId=${clientId}` : null,
    templateFetcher,
    {
      // Aggressive caching for instant loads
      dedupingInterval: enableCache ? 30000 : 2000, // 30s dedup
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0, // Manual refresh only
      keepPreviousData: true,
      revalidateIfStale: false,
      errorRetryCount: 3,
      errorRetryInterval: 1000,
    }
  );

  // Get current assignment and template
  const currentAssignment = useMemo(() => {
    if (!assignments || assignments.length === 0) return null;
    return assignments[0]; // Most recent assignment
  }, [assignments]);

  const templateData = useMemo(() => {
    return currentAssignment?.template || null;
  }, [currentAssignment]);

  // Compute stats with memoization
  const stats = useMemo(() => {
    if (!templateData) {
      return {
        totalAssets: 0,
        customOverrides: 0,
        teamMembers: 0,
        assetsByType: {},
      };
    }

    const totalAssets = templateData.sitesAssets?.length || 0;
    
    const assetsByType = templateData.sitesAssets?.reduce((acc: Record<string, number>, asset: SiteAsset) => {
      const type = asset.type || "other";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {}) || {};

    const customOverrides = currentAssignment?.siteAssetSettings?.filter(
      (setting: SiteAssetSetting) => 
        setting.requiredFrequency !== null &&
        setting.templateSiteAsset?.defaultPostingFrequency !== setting.requiredFrequency
    ).length || 0;

    const teamMembers = templateData.templateTeamMembers?.length || 0;

    return {
      totalAssets,
      customOverrides,
      teamMembers,
      assetsByType,
    };
  }, [templateData, currentAssignment]);

  // Refresh helper
  const refresh = useCallback(() => {
    return mutate();
  }, [mutate]);

  return {
    assignment: currentAssignment,
    templateData,
    stats,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load template") : null,
    refresh,
    mutate,
  };
}
