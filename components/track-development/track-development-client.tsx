// components/track-development/track-development-client.tsx
"use client";

import { useMemo } from "react";
import { useUserSession } from "@/lib/hooks/use-user-session";
import useSWR from "swr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  ArrowRight,
  Package,
  Minus,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// Fetcher for APIs
const fetcher = async (url: string): Promise<any> => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

interface MonthStats {
  start: string;
  end: string;
  pending: number;
  in_progress: number;
  completed: number;
  qc_approved: number;
  overdue: number;
  cancelled: number;
  reassigned: number;
  total: number;
  performance: number;
}

interface DevelopmentSummary {
  clientId: string;
  previousMonth: MonthStats;
  currentMonth: MonthStats;
  difference: {
    completedChange: number;
    performanceChange: number;
    totalChange: number;
  };
  summary: string;
}

export default function TrackDevelopment() {
  const { user, loading: sessionLoading } = useUserSession();
  const clientId = user?.clientId ?? null;

  // Fetch client data (for package dates)
  const { data: clientData, isLoading: clientLoading } = useSWR(
    clientId ? `/api/clients/${clientId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  // Fetch development summary
  const {
    data: devSummary,
    error: devError,
    isLoading: devLoading,
  } = useSWR<DevelopmentSummary>(
    clientId ? `/api/clients/${clientId}/development-summary` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  const isLoading = sessionLoading || clientLoading || devLoading;

  // Format date helper
  const formatDate = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  // Format month name
  const formatMonthName = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!clientId || devError) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Unable to load your development data. Please contact support.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const startDate = clientData?.startDate;
  const dueDate = clientData?.dueDate;
  const packageName = clientData?.package?.name || "N/A";
  const prev = devSummary?.previousMonth;
  const current = devSummary?.currentMonth;
  const diff = devSummary?.difference;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-10 w-10 text-primary" strokeWidth={2} />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Track Your Development
            </h1>
            <p className="text-muted-foreground">
              Monitor your progress with baseline vs current comparison
            </p>
          </div>
        </div>
      </div>

      {/* Package Info Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle>Package Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Package Name</p>
            <p className="text-lg font-bold">{packageName}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              🗓️ Package Start Date
            </p>
            <p className="text-lg font-bold text-green-600">
              {formatDate(startDate)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              🗓️ Package Due Date
            </p>
            <p className="text-lg font-bold text-blue-600">
              {formatDate(dueDate)} ✅
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary */}
      {diff && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {diff.performanceChange >= 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
              Performance Summary
            </CardTitle>
            <CardDescription>{devSummary?.summary}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 border rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Performance Change
              </p>
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`text-2xl font-bold ${
                    diff.performanceChange >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {diff.performanceChange >= 0 ? "+" : ""}
                  {diff.performanceChange}%
                </span>
                {diff.performanceChange >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                )}
              </div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Completed Change
              </p>
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`text-2xl font-bold ${
                    diff.completedChange >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {diff.completedChange >= 0 ? "+" : ""}
                  {diff.completedChange}
                </span>
                {diff.completedChange > 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : diff.completedChange < 0 ? (
                  <TrendingDown className="h-5 w-5 text-red-600" />
                ) : (
                  <Minus className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Total Tasks Change
              </p>
              <div className="flex items-center justify-center gap-2">
                <span
                  className={`text-2xl font-bold ${
                    diff.totalChange >= 0 ? "text-blue-600" : "text-orange-600"
                  }`}
                >
                  {diff.totalChange >= 0 ? "+" : ""}
                  {diff.totalChange}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Baseline vs Current Comparison */}
      {prev && current && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Baseline (Previous Month) */}
          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader className="bg-orange-50 dark:bg-orange-950/20">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-600" />
                Baseline (Previous Month)
              </CardTitle>
              <CardDescription>
                {formatMonthName(prev.start)}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Performance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Performance</span>
                  <span className="font-bold text-orange-600">
                    {prev.performance}%
                  </span>
                </div>
                <Progress
                  value={prev.performance}
                  className="h-3 bg-orange-100"
                />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Completed</span>
                  </div>
                  <p className="text-2xl font-bold">{prev.completed}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">In Progress</span>
                  </div>
                  <p className="text-2xl font-bold">{prev.in_progress}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">Pending</span>
                  </div>
                  <p className="text-2xl font-bold">{prev.pending}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      QC Approved
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold">{prev.qc_approved}</p>
                </div>
              </div>

              {/* Total */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Tasks</span>
                  <span className="text-xl font-bold">{prev.total}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current (Present Month) */}
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="bg-green-50 dark:bg-green-950/20">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                Current (Present Month)
              </CardTitle>
              <CardDescription>
                {formatMonthName(current.start)}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Performance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Performance</span>
                  <span className="font-bold text-green-600">
                    {current.performance}%
                  </span>
                </div>
                <Progress
                  value={current.performance}
                  className="h-3 bg-green-100"
                />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium">Completed</span>
                  </div>
                  <p className="text-2xl font-bold">{current.completed}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">In Progress</span>
                  </div>
                  <p className="text-2xl font-bold">{current.in_progress}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium">Pending</span>
                  </div>
                  <p className="text-2xl font-bold">{current.pending}</p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      QC Approved
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold">{current.qc_approved}</p>
                </div>
              </div>

              {/* Total */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Tasks</span>
                  <span className="text-xl font-bold">{current.total}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Additional Stats */}
      {current && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Metrics</CardTitle>
            <CardDescription>Other task status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Overdue</p>
                <p className="text-2xl font-bold text-red-600">
                  {current.overdue}
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Cancelled</p>
                <p className="text-2xl font-bold text-gray-600">
                  {current.cancelled}
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Reassigned</p>
                <p className="text-2xl font-bold text-purple-600">
                  {current.reassigned}
                </p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">QC Approved</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {current.qc_approved}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
