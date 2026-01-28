// app/admin/am_clients/[clientId]/page.tsx
"use client";

import { use } from "react";
import { useClientDashboard } from "@/lib/hooks/use-client-dashboard";
import { ClientDashboard } from "@/components/clients/clientsID/client-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

// ✅ Skeleton loader for client dashboard
function ClientDashboardSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* Header skeleton */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm rounded-lg">
        <div className="px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <div className="flex space-x-4">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </div>
            <div className="flex space-x-6">
              <Skeleton className="h-12 w-20" />
              <Skeleton className="h-12 w-20" />
              <Skeleton className="h-12 w-20" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Content skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export default function AMClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  // ✅ Unwrap params using React.use()
  const { clientId } = use(params);
  
  // ✅ Use optimized hook with aggressive caching
  const { clientData, isLoading, error, refresh } = useClientDashboard({
    clientId,
    enableCache: true,
    realtime: false,
  });

  // ✅ Show skeleton loader during initial load
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <ClientDashboardSkeleton />
      </div>
    );
  }

  // ✅ Show error state
  if (error) {
    return (
      <div className="min-h-screen p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800">Error Loading Client</h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Show not found state
  if (!clientData) {
    return (
      <div className="min-h-screen p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-800">Client Not Found</h3>
              <p className="text-sm text-yellow-600 mt-1">
                The requested client could not be found.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <ClientDashboard clientData={clientData} refreshClient={refresh} />
    </div>
  );
}
