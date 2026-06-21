// @ts-nocheck
// File: app/[role]/sales/page.tsx

"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesOverview } from "@/hooks/useSalesOverview";

// ✅ Lazy load heavy components for better performance
const ClientsTable = React.lazy(() =>
  import("@/components/sales/ClientsTable").then((m) => ({
    default: m.ClientsTable,
  })),
);
const PackageSalesTable = React.lazy(() =>
  import("@/components/sales/PackageSalesTable").then((m) => ({
    default: m.PackageSalesTable,
  })),
);
const ChartsSection = React.lazy(() =>
  import("@/components/sales/ChartsSection").then((m) => ({
    default: m.ChartsSection,
  })),
);
const PackagesOverview = React.lazy(() =>
  import("@/components/sales/PackagesOverview").then((m) => ({
    default: m.PackagesOverview,
  })),
);
const SalesSpotlight = React.lazy(() =>
  import("@/components/sales/SalesSpotlight").then((m) => ({
    default: m.SalesSpotlight,
  })),
);
const SmartInsights = React.lazy(() =>
  import("@/components/sales/SmartInsights").then((m) => ({
    default: m.SmartInsights,
  })),
);
const RenewalForecast = React.lazy(() =>
  import("@/components/sales/RenewalForecast").then((m) => ({
    default: m.RenewalForecast,
  })),
);
const SalesKPIGrid = React.lazy(() =>
  import("@/components/sales/SalesKPIGrid").then((m) => ({
    default: m.SalesKPIGrid,
  })),
);
const RetentionGauge = React.lazy(() =>
  import("@/components/sales/RetentionGauge").then((m) => ({
    default: m.RetentionGauge,
  })),
);
const TopPackagesShareRace = React.lazy(() =>
  import("@/components/sales/TopPackagesShareRace").then((m) => ({
    default: m.TopPackagesShareRace,
  })),
);

// ✅ Memoized component for better performance
const AMCEOSalesPage = React.memo(function AMCEOSalesPage() {
  // ✅ Use optimized hook with aggressive caching
  const { data, isLoading, mutate, error } = useSalesOverview();
  const [selectedPkg, setSelectedPkg] = React.useState<string | "all">("all");
  const [query, setQuery] = React.useState("");

  // ✅ Memoized data extraction
  const { summary, series, byPackage, packageSales, grouped, totalSales } =
    React.useMemo(
      () => ({
        summary: data?.summary ?? {},
        series: data?.timeseries ?? [],
        byPackage: data?.byPackage ?? [],
        packageSales: data?.packageSales ?? [],
        grouped: data?.groupedClients ?? [],
        totalSales: data?.totalSales ?? data?.summary?.totalSales ?? 0,
      }),
      [data],
    );

  const ma7 = React.useMemo(() => {
    let sum = 0;
    const res: any[] = [];
    for (let i = 0; i < series.length; i++) {
      sum += series[i].starts;
      if (i >= 7) sum -= series[i - 7].starts;
      res.push({
        day: series[i].day,
        starts: series[i].starts,
        ma: i >= 6 ? +(sum / 7).toFixed(2) : NaN,
      });
    }
    return res;
  }, [series]);

  const cumStarts = React.useMemo(() => {
    let acc = 0;
    return series.map((d) => ({ day: d.day, cumulative: (acc += d.starts) }));
  }, [series]);

  const growth = React.useMemo(() => {
    if (!series?.length) return null;
    const last30 = series.slice(-30);
    const prev30 = series.slice(-60, -30);
    const s1 = last30.reduce((a, b) => a + b.starts, 0);
    const s0 = prev30.reduce((a, b) => a + b.starts, 0);
    return { delta: s1 - s0, pct: s0 ? ((s1 - s0) / s0) * 100 : 0 };
  }, [series]);

  // Loading state with professional skeleton
  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 p-4 space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
        </div>

        {/* Sales Spotlight Skeleton */}
        <Card className="border-0 shadow-lg bg-linear-to-br from-blue-50 to-indigo-50">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`spotlight-${index}`} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </CardContent>
        </Card>

        {/* Smart Insights Skeleton */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`insight-${index}`}
                  className="p-4 border rounded-lg space-y-2"
                >
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* KPI Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={`kpi-${index}`} className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-10 rounded-lg" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-24 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Packages Overview Skeleton */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-10 w-40 rounded-lg" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full rounded-lg" />
          </CardContent>
        </Card>

        {/* Renewal & Retention Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={`gauge-${index}`} className="border-0 shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <Skeleton className="h-[200px] w-[200px] rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Package Sales Table Skeleton */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`table-row-${index}`}
                  className="flex items-center justify-between p-3 border-b"
                >
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Charts Section Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={`chart-${index}`} className="border-0 shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-[250px] w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            CEO — Package Sales
          </h1>
          <p className="text-sm text-slate-600">
            Package performance, client status, and sales distribution
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="rounded-full bg-green-100 text-green-700 border-green-200 hover:bg-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            Live
          </Badge>
          <button
            onClick={() => mutate()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* ✅ Sales Overview Section with Suspense */}
      <React.Suspense
        fallback={<Skeleton className="h-[300px] w-full rounded-lg" />}
      >
        <SalesSpotlight
          isLoading={isLoading}
          totalSales={totalSales}
          growth={growth}
          series={series}
          packageSales={packageSales}
        />
      </React.Suspense>

      <React.Suspense
        fallback={<Skeleton className="h-[200px] w-full rounded-lg" />}
      >
        <SmartInsights summary={summary} byPackage={byPackage} />
      </React.Suspense>

      <React.Suspense
        fallback={
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] w-full rounded-lg" />
            ))}
          </div>
        }
      >
        <SalesKPIGrid
          summary={summary}
          trendData={[
            { label: "Active", value: summary?.active ?? 0 },
            { label: "Expired", value: summary?.expired ?? 0 },
            { label: "Expiring", value: summary?.expiringSoon ?? 0 },
          ]}
          isLoading={isLoading}
        />
      </React.Suspense>

      <React.Suspense
        fallback={<Skeleton className="h-[400px] w-full rounded-lg" />}
      >
        <PackagesOverview
          isLoading={isLoading}
          byPackage={byPackage}
          timeseries={series}
          summary={summary}
          selectedPkg={selectedPkg}
          setSelectedPkg={setSelectedPkg}
        />
      </React.Suspense>

      {/* ✅ Renewal Forecast + Retention Gauge Grid with Suspense */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <React.Suspense
          fallback={<Skeleton className="h-[300px] w-full rounded-lg" />}
        >
          <RetentionGauge
            active={summary?.active ?? 0}
            expired={summary?.expired ?? 0}
          />
        </React.Suspense>

        <React.Suspense
          fallback={<Skeleton className="h-[300px] w-full rounded-lg" />}
        >
          <RenewalForecast
            forecastData={series.slice(-30).map((d) => ({
              day: d.day,
              expiring: Math.floor(d.starts / 2),
            }))}
            isLoading={isLoading}
          />
        </React.Suspense>
      </div>

      <React.Suspense
        fallback={<Skeleton className="h-[400px] w-full rounded-lg" />}
      >
        <PackageSalesTable
          isLoading={isLoading}
          packageSales={packageSales}
          totalSales={totalSales}
        />
      </React.Suspense>

      <React.Suspense
        fallback={<Skeleton className="h-[500px] w-full rounded-lg" />}
      >
        <ClientsTable
          isLoading={isLoading}
          grouped={grouped}
          selectedPkg={selectedPkg}
          setSelectedPkg={setSelectedPkg}
          query={query}
          setQuery={setQuery}
        />
      </React.Suspense>

      <React.Suspense
        fallback={<Skeleton className="h-[300px] w-full rounded-lg" />}
      >
        <TopPackagesShareRace packageSales={packageSales} />
      </React.Suspense>

      <React.Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-[300px] w-full rounded-lg" />
            ))}
          </div>
        }
      >
        <ChartsSection
          isLoading={isLoading}
          series={series}
          ma7={ma7}
          cumStarts={cumStarts}
        />
      </React.Suspense>
    </div>
  );
});

// ✅ Export memoized component
export default AMCEOSalesPage;
// @ts-nocheck
