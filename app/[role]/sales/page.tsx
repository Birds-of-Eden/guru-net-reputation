// File: app/[role]/sales/page.tsx

"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientsTable } from "@/components/sales/ClientsTable";
import { PackageSalesTable } from "@/components/sales/PackageSalesTable";
import { ChartsSection } from "@/components/sales/ChartsSection";
import { PackagesOverview } from "@/components/sales/PackagesOverview";
import { SalesSpotlight } from "@/components/sales/SalesSpotlight";
import { useSalesOverview } from "@/hooks/useSalesOverview";
import { SmartInsights } from "@/components/sales/SmartInsights";
import { RenewalForecast } from "@/components/sales/RenewalForecast";
import { SalesKPIGrid } from "@/components/sales/SalesKPIGrid";
import { RetentionGauge } from "@/components/sales/RetentionGauge";
import { TopPackagesShareRace } from "@/components/sales/TopPackagesShareRace";

export default function AMCEOSalesPage() {
  const { data, isLoading, mutate, error } = useSalesOverview();
  const [selectedPkg, setSelectedPkg] = React.useState<string | "all">("all");
  const [query, setQuery] = React.useState("");

  const summary = data?.summary ?? {};
  const series = data?.timeseries ?? [];
  const byPackage = data?.byPackage ?? [];
  const packageSales = data?.packageSales ?? [];
  const grouped = data?.groupedClients ?? [];

  // Derived metrics
  const totalSales = data?.totalSales ?? summary.totalSales ?? 0;

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 space-y-6">
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
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
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
                <div key={`insight-${index}`} className="p-4 border rounded-lg space-y-2">
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
                <div key={`table-row-${index}`} className="flex items-center justify-between p-3 border-b">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            AM CEO — Package Sales
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

      {/* Sales Overview Section */}
      <SalesSpotlight
        isLoading={isLoading}
        totalSales={totalSales}
        growth={growth}
        series={series}
        packageSales={packageSales}
      />

      <SmartInsights summary={summary} byPackage={byPackage} />

      <SalesKPIGrid
        summary={summary}
        trendData={[
          { label: "Active", value: summary?.active ?? 0 },
          { label: "Expired", value: summary?.expired ?? 0 },
          { label: "Expiring", value: summary?.expiringSoon ?? 0 },
        ]}
        isLoading={isLoading}
      />

      <PackagesOverview
        isLoading={isLoading}
        byPackage={byPackage}
        timeseries={series}
        summary={summary}
        selectedPkg={selectedPkg}
        setSelectedPkg={setSelectedPkg}
      />

      {/* 🔹 Renewal Forecast + Retention Gauge Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RetentionGauge
          active={summary?.active ?? 0}
          expired={summary?.expired ?? 0}
        />

        <RenewalForecast
          forecastData={series.slice(-30).map((d) => ({
            day: d.day,
            expiring: Math.floor(d.starts / 2),
          }))}
          isLoading={isLoading}
        />
      </div>

      <PackageSalesTable
        isLoading={isLoading}
        packageSales={packageSales}
        totalSales={totalSales}
      />

      <ClientsTable
        isLoading={isLoading}
        grouped={grouped}
        selectedPkg={selectedPkg}
        setSelectedPkg={setSelectedPkg}
        query={query}
        setQuery={setQuery}
      />

      <TopPackagesShareRace packageSales={packageSales} />

      <ChartsSection
        isLoading={isLoading}
        series={series}
        ma7={ma7}
        cumStarts={cumStarts}
      />
    </div>
  );
}
