// components/clients/client-card-skeleton.tsx

"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export function ClientCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-xl shadow-lg border border-gray-100 bg-white dark:border-border dark:bg-card">
      {/* Header */}
      <CardHeader className="p-6 border-b border-gray-100 bg-linear-to-r from-cyan-50 to-blue-50 dark:border-border dark:from-cyan-950/40 dark:to-blue-950/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-200 animate-pulse dark:bg-muted"></div>
            <div className="space-y-2">
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse dark:bg-muted"></div>
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse dark:bg-muted"></div>
              <div className="h-3 w-20 bg-gray-200 rounded animate-pulse dark:bg-muted"></div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="h-7 w-20 bg-gray-200 rounded-full animate-pulse dark:bg-muted"></div>
            <div className="h-7 w-24 bg-gray-200 rounded-full animate-pulse dark:bg-muted"></div>
          </div>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="p-6 space-y-5">
        <div className="h-4 w-48 bg-gray-200 rounded animate-pulse dark:bg-muted"></div>
        
        {/* Progress bars */}
        <div className="space-y-3">
          <div className="h-2.5 w-full bg-gray-200 rounded animate-pulse dark:bg-muted"></div>
          <div className="h-2.5 w-full bg-gray-200 rounded animate-pulse dark:bg-muted"></div>
        </div>

        {/* Task Summary */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 dark:bg-muted/40 dark:border-border">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-3 dark:bg-muted"></div>
          <div className="space-y-2">
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse dark:bg-muted"></div>
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse dark:bg-muted"></div>
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse dark:bg-muted"></div>
          </div>
        </div>
      </CardContent>

      {/* Footer */}
      <CardFooter className="border-t border-gray-100 bg-gray-50 p-6 dark:border-border dark:bg-muted/40">
        <div className="flex flex-wrap gap-3 w-full">
          <div className="h-10 flex-1 min-w-[150px] bg-gray-200 rounded-lg animate-pulse dark:bg-muted"></div>
          <div className="h-10 flex-1 min-w-[150px] bg-gray-200 rounded-lg animate-pulse dark:bg-muted"></div>
        </div>
      </CardFooter>
    </Card>
  );
}
