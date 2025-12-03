// Generated from original handlers; logic preserved
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildClientSelect, recalcAndStoreClientProgress } from "./helpers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const isDistributionView =
    searchParams.get("view")?.toLowerCase() === "distribution";

  try {
    const [client, fresh] = await Promise.all([
      prisma.client.findUnique({
        where: { id },
        select: buildClientSelect(isDistributionView),
      }),
      isDistributionView ? Promise.resolve(null) : recalcAndStoreClientProgress(id),
    ]);

    if (!client)
      return NextResponse.json(
        { message: "Client not found" },
        { status: 404 }
      );

    const socialMedias = Array.isArray((client as any).socialMedia)
      ? ((client as any).socialMedia as any[])
      : [];

    const response = {
      ...client,
      socialMedias,
      progress: fresh?.progress ?? client.progress ?? 0,
      taskCounts: fresh?.taskCounts ?? null,
    };

    // OPTIMIZATION (conditional payload + cache): keep CDN caching but shrink response when distribution view only needs summary.
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        "CDN-Cache-Control": "public, s-maxage=60",
        "Vercel-CDN-Cache-Control": "public, s-maxage=60",
      },
    });
  } catch (error) {
    console.error(`Error fetching client ${id}:`, error);
    return NextResponse.json(
      { message: "Failed to fetch client" },
      { status: 500 }
    );
  }
}
