// components/client-self-dashboard.tsx
"use client";

import { useUserSession } from "@/lib/hooks/use-user-session";
import { useClientDashboard } from "@/lib/hooks/use-client-dashboard";
import { ClientDashboard } from "@/components/clients/clientsID/client-dashboard";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton loader for client dashboard
function ClientDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
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
      <div className="px-6 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export default function ClientSelfDashboard() {
  // ✅ Use optimized auth hook
  const { user, loading: sessionLoading } = useUserSession();
  const clientId = user?.clientId ?? null;
  
  // ✅ Use optimized client dashboard hook with aggressive caching
  const { clientData, isLoading, error } = useClientDashboard({
    clientId,
    enableCache: true,
  });
  
  const loading = sessionLoading || isLoading;

  return (
    <div className="min-h-[300px]">
      {loading ? (
        <ClientDashboardSkeleton />
      ) : error ? (
        <div className="p-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      ) : clientId && clientData ? (
        <ClientDashboard clientData={clientData} />
      ) : (
        <div className="p-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              No client is associated with your session.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
