// components/client-self-dashboard.tsx
"use client";

import { useMemo } from "react";
import { useUserSession } from "@/lib/hooks/use-user-session";
import useSWR from "swr";
import { ClientDashboard } from "@/components/clients/clientsID/client-dashboard";
import { Client } from "@/types/client";

function normalizeClientData(apiData: any): Client {
  const uncategorized = {
    id: "uncategorized",
    name: "Uncategorized",
    description: "",
  };

  return {
    ...apiData,
    companywebsite:
      apiData?.companywebsite && typeof apiData.companywebsite === "string"
        ? apiData.companywebsite
        : "",
    tasks: (apiData?.tasks ?? []).map((t: any) => ({
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
  };
}

// Fetcher for client data
const clientFetcher = async (url: string): Promise<any> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch client");
  return res.json();
};

export default function ClientSelfDashboard() {
  // ✅ Use optimized hooks with SWR
  const { user, loading: sessionLoading } = useUserSession();
  const clientId = user?.clientId ?? null;
  
  // ✅ Fetch client data only if clientId exists
  const { data: rawClientData, error: clientError, isLoading: clientLoading } = useSWR(
    clientId ? `/api/clients/${clientId}` : null,
    clientFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
      refreshInterval: 300000, // Auto-refresh every 5 min
    }
  );
  
  // ✅ Process client data with useMemo
  const clientData = useMemo(() => {
    return rawClientData ? normalizeClientData(rawClientData) : null;
  }, [rawClientData]);
  
  const loading = sessionLoading || clientLoading;
  const error = clientError ? (clientError instanceof Error ? clientError.message : "Something went wrong") : null;

  return (
    <div className="min-h-[300px] p-4">
      <div className="bg-white rounded-lg border p-4">
        {loading ? (
          <p className="text-sm text-gray-600">Loading session...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : clientId && clientData ? (
          <ClientDashboard clientData={clientData} />
        ) : clientId && !clientData ? (
          <p className="text-sm text-gray-600">Loading client data...</p>
        ) : (
          <p className="text-sm text-gray-600">
            No client is associated with your session.
          </p>
        )}
      </div>
    </div>
  );
}
