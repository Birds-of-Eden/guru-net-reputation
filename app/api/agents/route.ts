//api/agents
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

/* ================================
    GET ALL AGENTS
================================ */
export async function GET() {
  try {
    const agents = await prisma.user.findMany({
      where: {
        role: { name: "agent" },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        category: true,
        address: true,
        biography: true,
        status: true,
        createdAt: true,
        image: true,
        role: { select: { name: true } },
        qcId: true, // 🆕 Add QC ID
        qc: { select: { id: true, name: true, email: true } }, // 🆕 Add QC info
      },
      orderBy: { createdAt: "desc" },
    });

    const transformed = agents.map((a) => ({
      id: a.id,
      firstName: a.firstName || "",
      lastName: a.lastName || "",
      email: a.email,
      phone: a.phone || "",
      category: a.category || "",
      address: a.address || "",
      bio: a.biography || "",
      status: a.status.toLowerCase(),
      createdAt: a.createdAt.toISOString(),
      image: a.image,
      role: a.role?.name,
      qcId: a.qcId || null, // 🆕 Return QC ID
      qc: a.qc || null, // 🆕 Return QC details
    }));

    return NextResponse.json(transformed, { status: 200 });
  } catch (error) {
    console.error("Error in GET /api/agents:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

/* ================================
    CREATE NEW AGENT
================================ */
export async function POST(request: Request) {
  try {
    const data = await request.json();

    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      address,
      bio,
      status,
      teamId,
      qcId, // 🆕 Accept QC Supervisor ID
    } = data;

    if (!firstName || !lastName || !email || !password || !teamId) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Email duplication check
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json(
        { message: "Email already exists" },
        { status: 400 }
      );
    }

    // Validate team exists
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      return NextResponse.json(
        { message: "Selected team not found" },
        { status: 400 }
      );
    }

    // Fetch agent role
    const agentRole = await prisma.role.findUnique({
      where: { name: "agent" },
    });
    if (!agentRole) {
      return NextResponse.json(
        { message: "Agent role missing in DB" },
        { status: 500 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // 🆕 Create agent WITH QC assignment
    const newAgent = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        passwordHash,
        phone,
        address: address || null,
        biography: bio || null,
        status: status === "active" ? "active" : "inactive",
        name: `${firstName} ${lastName}`,
        role: {
          connect: { id: agentRole.id },
        },

        emailVerified: false, // ✅ REQUIRED FIELD

        category: team.name,

        qc: qcId ? { connect: { id: qcId } } : undefined, // ✅ QC assignment via relation

        accounts: {
          create: {
            providerId: "credentials",
            accountId: email,
            password: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      },
      include: {
        role: true,
        qc: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(
      {
        message: "Agent created successfully",
        agent: {
          ...newAgent,
          bio: newAgent.biography,
          status: newAgent.status.toLowerCase(),
          createdAt: newAgent.createdAt.toISOString(),
          teamId,
          teamName: team.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/agents:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

/* ================================
    DELETE AGENT
================================ */
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { message: "Missing agent ID" },
        { status: 400 }
      );
    }

    // Remove team links
    await prisma.clientTeamMember.deleteMany({ where: { agentId: id } });
    await prisma.templateTeamMember.deleteMany({ where: { agentId: id } });

    const deleted = await prisma.user.delete({ where: { id } });

    return NextResponse.json(
      { message: "Agent deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in DELETE /api/agents:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

/* ================================
    UPDATE AGENT
================================ */
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    const {
      id,
      firstName,
      lastName,
      email,
      phone,
      address,
      biography,
      bio,
      status,
      teamId,
      password,
      qcId, // 🆕 Accept QC Supervisor
    } = body;

    if (!id) {
      return NextResponse.json(
        { message: "Missing agent ID" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: "Agent not found" }, { status: 404 });
    }

    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken)
        return NextResponse.json(
          { message: "Email already exists" },
          { status: 400 }
        );
    }

    // Team update → map to category
    let categoryUpdate: string | undefined;
    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) {
        return NextResponse.json(
          { message: "Team not found" },
          { status: 400 }
        );
      }
      categoryUpdate = team.name;
    }

    // Password update
    let passwordHashUpdate: string | undefined;
    if (password?.trim()) {
      passwordHashUpdate = await bcrypt.hash(password.trim(), 10);
    }

    // 🆕 Update QC assignment
    const updatedAgent = await prisma.user.update({
      where: { id },
      data: {
        firstName,
        lastName,
        email,
        phone,
        address: address || null,
        biography: biography ?? bio ?? null,
        status: status === "active" ? "active" : "inactive",
        name: `${firstName ?? existing.firstName} ${
          lastName ?? existing.lastName
        }`.trim(),
        qcId: qcId || null, // 🆕 Save QC Supervisor
        ...(categoryUpdate ? { category: categoryUpdate } : {}),
        ...(passwordHashUpdate ? { passwordHash: passwordHashUpdate } : {}),
      },
      include: {
        qc: { select: { id: true, name: true, email: true } }, // 🆕 Include QC details
      },
    });

    return NextResponse.json(
      {
        message: "Agent updated successfully",
        agent: {
          ...updatedAgent,
          bio: updatedAgent.biography,
          status: updatedAgent.status.toLowerCase(),
          createdAt: updatedAgent.createdAt.toISOString(),
          teamId,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in PUT /api/agents:", error);
    return NextResponse.json(
      { message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
