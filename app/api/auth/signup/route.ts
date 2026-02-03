import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { name, email, password, role } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Get default role if not specified
    let userRole = role;
    if (!userRole) {
      const defaultRole = await prisma.role.findFirst({
        where: { name: "client" },
      });
      userRole = defaultRole?.id || null;
    } else {
      // If role is specified, find the role ID
      const roleRecord = await prisma.role.findFirst({
        where: { name: userRole },
      });
      userRole = roleRecord?.id || null;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash: hashedPassword,
        roleId: userRole,
        emailVerified: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      { 
        message: "User created successfully",
        user
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
