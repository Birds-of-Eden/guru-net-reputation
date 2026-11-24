import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/api-guard";

// replace with your real agent role ID
const AGENT_ROLE_ID = "cmdfrtlm00001spw8i3n0bqer";

export async function GET() {
  const __access = await requireStaff();
  if (__access instanceof NextResponse) return __access;
  try {
    const agents = await prisma.user.findMany({
      where: {
        roleId: AGENT_ROLE_ID,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    });

    return NextResponse.json(agents, { status: 200 });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json(
      { message: "Failed to fetch agents", error: error.message },
      { status: 500 }
    );
  }
}
