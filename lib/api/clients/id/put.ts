// Generated from original handlers; logic preserved
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { assertIsAMOrNull, coerceSocialMedia, recalcAndStoreClientProgress } from "./helpers";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const {
      name,
      birthdate,
      gender,
      company,
      designation,
      location,
      websites,
      companywebsite,
      companyaddress,
      biography,
      imageDrivelink,
      avatar,
      // progress - αªòαºìαª▓αª╛αºƒαºçαª¿αºìαªƒ αªÑαºçαªòαºç αª¿αºçαª¼αºï αª¿αª╛; αªåαª«αª░αª╛ αª¿αª┐αª£αºçαªç αª░αª┐αªòαºìαª»αª╛αª▓αªòαºüαª▓αºçαªƒ αªòαª░αª¼αºï
      status,
      packageId,
      startDate,
      dueDate,

      articleTopics,
      articleCategories,

      // Γ¼ç∩╕Å αª¿αªñαºüαª¿ αª½αª┐αª▓αºìαªíαªùαºüαª▓αºï (contact/credentials + AM)
      email,
      phone,
      password,
      recoveryEmail,
      amId,
      // Γ¼ç∩╕Å Arbitrary JSON key/value pairs
      otherField,
      socialMedia,
    } = body;

    // amId server-side validation (role must be 'am') ΓÇö allow null to clear
    const amIdValue =
      typeof amId === "string" && amId.trim().length > 0 ? amId : null;
    await assertIsAMOrNull(amIdValue);

    // αªåαª¬αªíαºçαªƒ (progress αª¼αª╛αªª)
    const updated = await prisma.client.update({
      where: { id },
      data: {
        name,
        birthdate: birthdate ? new Date(birthdate) : undefined,
        gender,
        company,
        designation,
        location,

        // αª¿αªñαºüαª¿ αª½αª┐αª▓αºìαªíαªùαºüαª▓αºï αª╕αªéαª░αªòαºìαª╖αªú
        email,
        phone,
        // Persist articleTopics JSON if provided (supports both old and new structure)
        articleTopics: articleCategories
          ? JSON.parse(JSON.stringify(articleCategories))
          : articleTopics
          ? JSON.parse(JSON.stringify(articleTopics))
          : undefined,
        password,
        recoveryEmail,
        websites,
        companywebsite,
        companyaddress,
        biography,
        imageDrivelink,
        avatar,
        status,
        packageId,
        startDate: startDate ? new Date(startDate) : undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,

        // AM αª░αª┐αª▓αºçαª╢αª¿ αªåαª¬αªíαºçαªƒ
        amId: amIdValue, // null αª╣αª▓αºç unlink αª╣αª¼αºç

        // Persist arbitrary JSON if provided
        otherField: otherField ?? undefined,
        socialMedia:
          coerceSocialMedia(socialMedia) === undefined
            ? undefined
            : JSON.parse(JSON.stringify(coerceSocialMedia(socialMedia))),
      } as any,
      include: {
        package: true,
        accountManager: { include: { role: true } }, // AM αªªαºçαªûαª╛αªñαºç
        teamMembers: {
          include: {
            agent: { include: { role: true } },
            team: true,
          },
        },
        tasks: {
          select: {
            id: true,
            name: true,
            status: true,
            priority: true,
            dueDate: true,
            createdAt: true,
            completedAt: true,
            completionLink: true,
            taskCompletionJson: true,
            idealDurationMinutes: true,
            categoryId: true,
            templateSiteAssetId: true,
            assignedToId: true,
            assignedTo: {
              select: { id: true, name: true, email: true, role: { select: { id: true, name: true } } }
            },
            templateSiteAsset: true,
            category: true,
          },
        },
        assignments: {
          include: {
            template: {
              include: {
                sitesAssets: true,
                templateTeamMembers: {
                  include: {
                    agent: { include: { role: true } },
                    team: true,
                  },
                },
              },
            },
            siteAssetSettings: { include: { templateSiteAsset: true } },
            tasks: { 
              select: {
                id: true,
                name: true,
                status: true,
                priority: true,
                dueDate: true,
                createdAt: true,
                completedAt: true,
                completionLink: true,
                taskCompletionJson: true,
                idealDurationMinutes: true,
                categoryId: true,
                templateSiteAssetId: true,
                assignedToId: true,
                assignedTo: { select: { id: true, name: true, email: true } },
                templateSiteAsset: true,
              }
            },
          },
        },
      },
    });

    // αªåαª¬αªíαºçαªƒαºçαª░ αª¬αª░ progress αª░αª┐αªòαºìαª»αª╛αª▓αªòαºüαª▓αºçαªƒ αªòαª░αºç DB-αªñαºç αª▓αª┐αªûαºç αª¿αª┐αª¿
    const fresh = await recalcAndStoreClientProgress(id);

    return NextResponse.json({
      ...updated,
      progress: fresh.progress,
      taskCounts: fresh.taskCounts,
    });
  } catch (error) {
    console.error(`Error updating client ${id}:`, error);
    // AM invalid αª╣αª▓αºç 400 αªªαºçαªôαºƒαª╛ αª╣αºïαªò
    const message =
      error instanceof Error ? error.message : "Failed to update client";
    const status = message.includes("Account Manager") ? 400 : 500;
    return NextResponse.json({ message }, { status });
  }
}
