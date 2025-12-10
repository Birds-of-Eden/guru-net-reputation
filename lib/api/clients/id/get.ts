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
    // ⚡ CRITICAL OPTIMIZATION: Fetch client data FIRST without waiting for progress calculation
    const client = await prisma.client.findUnique({
      where: { id },
      select: buildClientSelect(isDistributionView),
    });

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
      progress: client.progress ?? 0,
      taskCounts: null,
    };

    // ⚡ FIRE-AND-FORGET: Recalculate progress in background (non-blocking)
    // This updates the database but doesn't block the response
    if (!isDistributionView) {
      recalcAndStoreClientProgress(id).catch((err) => {
        console.error(`Background progress calc failed for ${id}:`, err);
      });
    }

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
