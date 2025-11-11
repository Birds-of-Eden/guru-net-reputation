// app/api/am/sales/overview/route.ts

import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/am/sales/overview
export async function GET() {
  try {
    const now = new Date();
    const in14 = new Date(now);
    in14.setDate(in14.getDate() + 14);
    const in30 = new Date(now);
    in30.setDate(in30.getDate() + 30);
    const since = new Date();
    since.setDate(since.getDate() - 90);

    // ✅ Parallel execution for faster response
    const [clients, timeseriesData] = await Promise.all([
      // ✅ Optimized query with selective fields only
      prisma.client.findMany({
        where: { packageId: { not: null } },
        select: {
          id: true,
          name: true,
          company: true,
          email: true,
          startDate: true,
          dueDate: true,
          packageId: true,
          // ✅ Only essential package fields
          package: { 
            select: { 
              id: true, 
              name: true, 
              totalMonths: true 
            } 
          },
        },
        // ✅ Limit results for better performance
        take: 1000,
        orderBy: { id: "desc" }, // Faster than updatedAt
      }),
      
      // ✅ Parallel timeseries query
      prisma.$queryRawUnsafe<{ day: string; starts: number }[]>(
        `
          SELECT
            to_char(date_trunc('day', "startDate"), 'YYYY-MM-DD') as day,
            COUNT(*)::int as starts
          FROM "Client"
          WHERE "packageId" IS NOT NULL
            AND "startDate" IS NOT NULL
            AND "startDate" >= $1
          GROUP BY 1
          ORDER BY 1 ASC
          LIMIT 90
        `,
        since
      ),
    ]);

    // ✅ Optimized status calculation with single loop
    type Status = "active" | "expired" | "upcoming" | "unknown";
    let totalWithPackage = 0;
    let active = 0, expired = 0, startingSoon = 0, expiringSoon = 0, missingDates = 0;
    
    const byPackageMap = new Map<string, {
      packageId: string;
      packageName: string | null;
      totalMonths: number | null;
      clients: number;
      active: number;
      expired: number;
      daysLeftAcc: number;
      daysLeftCount: number;
    }>();

    const enriched = clients.map((c) => {
      totalWithPackage++;
      let status: Status = "unknown";
      
      // Calculate status and update counters in single pass
      if (c.startDate && c.dueDate) {
        if (c.startDate <= now && c.dueDate >= now) {
          status = "active";
          active++;
        } else if (c.dueDate < now) {
          status = "expired";
          expired++;
        } else if (c.startDate > now) {
          status = "upcoming";
        }
        
        // Check for soon dates
        if (c.startDate > now && c.startDate <= in14) startingSoon++;
        if (c.dueDate >= now && c.dueDate <= in30) expiringSoon++;
      } else {
        missingDates++;
      }

      // ✅ Build package map in same loop
      const key = c.packageId as string;
      const pkg = byPackageMap.get(key) ?? {
        packageId: key,
        packageName: c.package?.name ?? null,
        totalMonths: c.package?.totalMonths ?? null,
        clients: 0,
        active: 0,
        expired: 0,
        daysLeftAcc: 0,
        daysLeftCount: 0,
      };
      
      pkg.clients++;
      if (status === "active") pkg.active++;
      else if (status === "expired") pkg.expired++;
      
      if (c.startDate && c.dueDate) {
        const daysLeft = Math.floor((c.dueDate.getTime() - now.getTime()) / 86400000);
        pkg.daysLeftAcc += daysLeft;
        pkg.daysLeftCount++;
      }
      
      byPackageMap.set(key, pkg);
      return { ...c, status };
    });

    // ✅ Pre-computed summary
    const summary = {
      totalWithPackage,
      totalSales: totalWithPackage,
      active,
      expired,
      startingSoon,
      expiringSoon,
      missingDates,
    };

    // ✅ Optimized package processing
    const byPackage = Array.from(byPackageMap.values())
      .map((e) => ({
        packageId: e.packageId,
        packageName: e.packageName,
        totalMonths: e.totalMonths,
        clients: e.clients,
        active: e.active,
        expired: e.expired,
        avgDaysLeft: e.daysLeftCount ? Math.round(e.daysLeftAcc / e.daysLeftCount) : 0,
      }))
      .sort((a, b) => b.clients - a.clients);

    // ✅ Package sales calculation
    const totalSales = byPackage.reduce((s, r) => s + r.clients, 0);
    const packageSales = byPackage.map((p) => ({
      packageId: p.packageId,
      packageName: p.packageName || 'Unknown Package',
      sales: p.clients,
      sharePercent: totalSales && p.clients ? Math.round((p.clients * 10000) / totalSales) / 100 : 0,
    }));

    // ✅ Optimized grouped clients (limit to top 10 packages)
    const groupedClients = byPackage.slice(0, 10).map((pkg) => ({
      packageId: pkg.packageId,
      packageName: pkg.packageName,
      totalMonths: pkg.totalMonths,
      count: pkg.clients,
      clients: enriched
        .filter((c) => c.packageId === pkg.packageId)
        .slice(0, 50) // Limit clients per package
        .map((c) => ({
          id: c.id,
          name: c.name,
          company: c.company,
          email: c.email,
          startDate: c.startDate,
          dueDate: c.dueDate,
          status: c.status,
        })),
    }));

    // ✅ Safe timeseries data
    const safeTimeseries = (timeseriesData || []).map(item => ({
      ...item,
      starts: item.starts || 0
    }));

    // ✅ Add aggressive cache headers
    return NextResponse.json({
      summary,
      timeseries: safeTimeseries,
      byPackage,
      packageSales,
      totalSales,
      recent: enriched.slice(0, 20),
      groupedClients,
    }, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        "CDN-Cache-Control": "public, s-maxage=60",
      },
    });
  } catch (error) {
    console.error("Error fetching sales overview:", error);
    return NextResponse.json(
      { message: "Failed to fetch sales overview" },
      { status: 500 }
    );
  }
}
