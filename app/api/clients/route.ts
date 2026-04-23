// app/api/clients/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthUser } from "@/lib/getAuthUser";
import { notifyDraftClientCreated } from "@/lib/client-onboarding-notifications";

export const dynamic = "force-dynamic";

// Helper to normalize platform values
const normalizePlatform = (input: unknown): string => {
  const raw = String(input ?? "").trim();
  return raw || "OTHER";
};

// Helper: allowed statuses for article topic usage
const ARTICLE_TOPIC_STATUSES = new Set([
  "Used 1",
  "Used 2",
  "Used 3",
  "Used 4",
  "Used 5",
  "Used 6",
  "Used 7",
  "Used 8",
  "Used 9",
  "Used 10",
  "More then 10",
  "Not yet Used",
]);

type ArticleTopic = {
  topicname: string;
  status: string; // constrained at runtime via ARTICLE_TOPIC_STATUSES
  usedDate?: string | null;
  usedCount?: number;
};

type ImageDriveItem = { title?: string; link?: string };

const normalizeImageDrivelink = (input: unknown) => {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (typeof input === "string") {
    const driveLink = input.trim();
    return driveLink ? { driveLink, items: [] as ImageDriveItem[] } : null;
  }
  if (Array.isArray(input)) {
    const items = input
      .map((item) => ({
        title: String((item as any)?.title ?? "").trim() || undefined,
        link: String((item as any)?.link ?? "").trim() || undefined,
      }))
      .filter((item) => item.title || item.link);
    return items.length ? { driveLink: "", items } : null;
  }
  if (typeof input === "object") {
    const obj = input as any;
    const driveLink =
      typeof obj?.driveLink === "string" ? obj.driveLink.trim() : "";
    const items = Array.isArray(obj?.items)
      ? obj.items
          .map((item: any) => ({
            title: String(item?.title ?? "").trim() || undefined,
            link: String(item?.link ?? "").trim() || undefined,
          }))
          .filter((item: ImageDriveItem) => item.title || item.link)
      : [];
    return driveLink || items.length ? { driveLink, items } : null;
  }
  return null;
};

// Normalize and validate articleTopics input from request body
const normalizeArticleTopics = (input: unknown): ArticleTopic[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const topicname = String((item as any)?.topicname ?? "").trim();
      if (!topicname) return null;

      const rawStatus = String((item as any)?.status ?? "").trim();
      const status = ARTICLE_TOPIC_STATUSES.has(rawStatus)
        ? rawStatus
        : "Not yet Used";

      // usedCount normalization
      let usedCount: number | undefined = undefined;
      const rawCount = (item as any)?.usedCount;
      if (
        rawCount !== undefined &&
        rawCount !== null &&
        !Number.isNaN(Number(rawCount))
      ) {
        usedCount = Math.max(0, Number(rawCount));
      } else {
        const match = /^Used\s+(\d+)$/.exec(status);
        if (match) {
          usedCount = Number(match[1]);
        } else if (status === "More then 10") {
          usedCount = 11;
        } else if (status === "Not yet Used") {
          usedCount = 0;
        }
      }

      // usedDate normalization
      let usedDate: string | null | undefined = undefined;
      const rawDate = (item as any)?.usedDate;
      if (rawDate === null) {
        usedDate = null;
      } else if (rawDate !== undefined) {
        const d = new Date(rawDate);
        usedDate = isNaN(d.getTime()) ? null : d.toISOString();
      }

      return {
        topicname,
        status,
        usedDate: usedDate ?? null,
        usedCount: usedCount ?? 0,
      } as ArticleTopic;
    })
    .filter(Boolean) as ArticleTopic[];
};

// New type for article categories
type ArticleCategory = {
  category: string;
  titles: Array<{
    title: string;
    draftLink: string;
    draftStatus: "Approved" | "Pending" | "Revision";
    status?: string;
    usedCount?: number;
    usedDate?: string | null;
  }>;
};

// Normalize and validate articleCategories input from request body
const normalizeArticleCategories = (input: unknown): ArticleCategory[] => {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      const category = String((item as any)?.category ?? "").trim();
      if (!category) return null;

      const titles = Array.isArray((item as any)?.titles)
        ? (item as any).titles
            .map((t: any) => {
              const title = String(t?.title ?? "").trim();
              if (!title) return null;

              const draftLink = String(t?.draftLink ?? "").trim();
              const draftStatus = ["Approved", "Pending", "Revision"].includes(
                t?.draftStatus,
              )
                ? t.draftStatus
                : "Pending";

              const rawStatus = String(t?.status ?? "").trim();
              const status = ARTICLE_TOPIC_STATUSES.has(rawStatus)
                ? rawStatus
                : "Not yet Used";

              // usedCount normalization
              let usedCount: number | undefined = undefined;
              const rawCount = t?.usedCount;
              if (
                rawCount !== undefined &&
                rawCount !== null &&
                !Number.isNaN(Number(rawCount))
              ) {
                usedCount = Math.max(0, Number(rawCount));
              } else {
                const match = /^Used\s+(\d+)$/.exec(status);
                if (match) {
                  usedCount = Number(match[1]);
                } else if (status === "More then 10") {
                  usedCount = 11;
                } else if (status === "Not yet Used") {
                  usedCount = 0;
                }
              }

              // usedDate normalization
              let usedDate: string | null | undefined = undefined;
              const rawDate = t?.usedDate;
              if (rawDate === null) {
                usedDate = null;
              } else if (rawDate !== undefined) {
                const d = new Date(rawDate);
                usedDate = isNaN(d.getTime()) ? null : d.toISOString();
              }

              return {
                title,
                draftLink,
                draftStatus,
                status,
                usedCount: usedCount ?? 0,
                usedDate: usedDate ?? null,
              };
            })
            .filter(Boolean)
        : [];

      if (titles.length === 0) return null;

      return { category, titles } as ArticleCategory;
    })
    .filter(Boolean) as ArticleCategory[];
};

const parseDate = (v: any): Date | undefined => {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
};

// ============ GET /api/clients ============
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Get current user for AM filtering
    const currentUser = await getAuthUser();
    const userRole = currentUser?.role;
    const userId = currentUser?.id;
    const isAM = userRole === "am";

    const id = searchParams.get("id");
    const packageId = searchParams.get("packageId") || undefined;
    let amId = searchParams.get("amId") || undefined;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;

    // If user is AM, override amId with their own ID (unless explicitly requesting a different AM's clients)
    if (isAM && userId && !amId) {
      amId = userId;
    }

    const page = Number(searchParams.get("page") || "1");
    const pageSize = Number(searchParams.get("pageSize") || "30");
    const skip = (page - 1) * pageSize;

    // ---------- SINGLE CLIENT ----------
    if (id) {
      const client = await prisma.client.findUnique({
        where: { id },
        include: {
          accountManager: { select: { id: true, name: true, email: true } },
          assignments: {
            orderBy: { assignedAt: "desc" },
            select: {
              id: true,
              assignedAt: true,
              status: true,
              template: { select: { id: true, name: true } },
            },
          },
        },
      });
      if (!client) return NextResponse.json(null);
      if (isAM && userId && client.amId !== userId) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 },
        );
      }

      const templateName =
        client.assignments?.find((a) => a?.template?.name)?.template?.name ??
        null;

      const user = await prisma.user.findFirst({
        where: { clientId: id, role: { name: "client" } },
        select: { id: true },
      });

      return NextResponse.json({
        ...client,
        socialMedias: Array.isArray((client as any).socialMedia)
          ? ((client as any).socialMedia as any[])
          : [],
        clientUserId: user?.id ?? null,
        templateName,
      });
    }

    // ---------- TOTAL COUNT ----------
    const whereClause: any = {
      packageId,
      // AM filtering: if user is AM, only show their assigned clients
      ...(isAM && userId ? { amId: userId } : {}),
      // If not AM, use amId from search params if provided
      ...(!isAM && amId ? { amId } : {}),
    };

    if (status && status !== "all") {
      whereClause.status = status;
    }

    if (search && search.trim()) {
      whereClause.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { company: { contains: search.trim(), mode: "insensitive" } },
        { email: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const totalCount = await prisma.client.count({
      where: whereClause,
    });

    // ---------- FETCH CLIENT LIST ----------
    const clients = await prisma.client.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        company: true,
        designation: true,
        avatar: true,
        status: true,
        packageId: true,
        amId: true,
        startDate: true,
        dueDate: true,
        createdAt: true,
        email: true,
        phone: true,
        biography: true,
        imageDrivelink: true,
        location: true,
        companyaddress: true,
        accountManager: { select: { id: true, name: true, email: true } },
        package: { select: { id: true, name: true } },
        teamMembers: { select: { agentId: true } },
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    });

    if (clients.length === 0) {
      return NextResponse.json({
        clients: [],
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
        },
      });
    }

    // ---------- CLIENT IDS ----------
    const clientIds = clients.map((c) => c.id);
    const templateMap = new Map<string, string>();

    if (clientIds.length) {
      const assignments = await prisma.assignment.findMany({
        where: { clientId: { in: clientIds } },
        orderBy: { assignedAt: "desc" },
        select: {
          clientId: true,
          template: { select: { name: true } },
        },
      });

      for (const row of assignments) {
        const name = row.template?.name?.trim();
        if (name && !templateMap.has(row.clientId)) {
          templateMap.set(row.clientId, name);
        }
      }
    }

    // ---------- GET CLIENT USER IDS ----------
    const clientUsers = await prisma.user.findMany({
      where: { clientId: { in: clientIds }, role: { name: "client" } },
      select: { id: true, clientId: true },
    });

    const clientIdToUserId = new Map<string, string>();
    for (const u of clientUsers) {
      if (!clientIdToUserId.has(u.clientId)) {
        clientIdToUserId.set(u.clientId, u.id);
      }
    }

    // ---------- TASK SUMMARY (SAFE RAW SQL) ----------
    const taskSummaryRaw =
      clientIds.length === 0
        ? []
        : await prisma.$queryRaw<
            { clientId: string; status: string; count: number }[]
          >(Prisma.sql`
          SELECT "clientId", 
                 CASE 
                   WHEN status = 'qc_approved' THEN 'completed'
                   ELSE status
                 END as status, 
                 COUNT(*)::int as count
          FROM "Task"
          WHERE "clientId" IN (${Prisma.join(clientIds)})
            AND status != 'cancelled'
          GROUP BY "clientId", 
                   CASE 
                     WHEN status = 'qc_approved' THEN 'completed'
                     ELSE status
                   END
        `);

    const summaryMap = new Map<
      string,
      {
        total: number;
        pending: number;
        in_progress: number;
        completed: number;
        overdue: number;
      }
    >();

    for (const id of clientIds) {
      summaryMap.set(id, {
        total: 0,
        pending: 0,
        in_progress: 0,
        completed: 0,
        overdue: 0,
      });
    }

    for (const row of taskSummaryRaw) {
      const map = summaryMap.get(row.clientId);
      if (!map) continue;

      const s = row.status.toLowerCase();
      if (
        s === "pending" ||
        s === "in_progress" ||
        s === "completed" ||
        s === "overdue"
      ) {
        (map as any)[s] = row.count;
        (map as any).total += row.count;
      }
    }

    // ---------- PROGRESS CALCULATIONS (FAST RAW SQL) ----------
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const progressRaw =
      clientIds.length === 0
        ? []
        : await prisma.$queryRawUnsafe<
            {
              clientId: string;
              total: number;
              completed: number;
              totalThisMonth: number;
              completedThisMonth: number;
              approvedThisMonth: number;
            }[]
          >(`
          SELECT
            "clientId",
            COUNT(*) FILTER (WHERE status IS NOT NULL) AS total,
            COUNT(*) FILTER (WHERE status IN ('completed','qc_approved')) AS completed,

            COUNT(*) FILTER (
              WHERE ("createdAt" >= '${monthStart.toISOString()}'
              AND "createdAt" < '${nextMonth.toISOString()}')
            ) AS "totalThisMonth",

            COUNT(*) FILTER (
              WHERE (
                "completedAt" >= '${monthStart.toISOString()}'
                AND "completedAt" < '${nextMonth.toISOString()}'
              )
            ) AS "completedThisMonth",

            COUNT(*) FILTER (
              WHERE status = 'qc_approved'
              AND ("updatedAt" >= '${monthStart.toISOString()}'
              AND "updatedAt" < '${nextMonth.toISOString()}')
            ) AS "approvedThisMonth"

          FROM "Task"
          WHERE "clientId" IN (${clientIds.map((x) => `'${x}'`).join(",")})
          GROUP BY "clientId"
        `);

    const progressMap = new Map();

    for (const row of progressRaw) {
      const {
        clientId,
        total,
        completed,
        totalThisMonth,
        completedThisMonth,
        approvedThisMonth,
      } = row;

      // Convert BigInt to Number
      const totalNum = Number(total);
      const completedNum = Number(completed);
      const totalThisMonthNum = Number(totalThisMonth);
      const completedThisMonthNum = Number(completedThisMonth);
      const approvedThisMonthNum = Number(approvedThisMonth);

      const overallProgress =
        totalNum > 0 ? Math.round((completedNum / totalNum) * 100) : 0;

      const monthProgress =
        totalThisMonthNum > 0
          ? Math.round(
              ((completedThisMonthNum + approvedThisMonthNum) /
                totalThisMonthNum) *
                100,
            )
          : 0;

      progressMap.set(clientId, {
        overallProgress,
        monthProgress,
      });
    }

    // ---------- FINAL MERGE ----------
    const result = clients.map((c) => ({
      ...c,
      socialMedias: [], // list view doesn't need full socialMedia payload
      clientUserId: clientIdToUserId.get(c.id) ?? null,
      templateName: templateMap.get(c.id) ?? null,
      taskSummary: summaryMap.get(c.id),
      overallProgress: progressMap.get(c.id)?.overallProgress ?? 0,
      monthProgress: progressMap.get(c.id)?.monthProgress ?? 0,
    }));

    return NextResponse.json(
      {
        clients: result,
        pagination: {
          page,
          pageSize,
          totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40",
        },
      },
    );
  } catch (error: any) {
    console.error("GET /api/clients ERROR:", error);
    return NextResponse.json(
      { error: error.message ?? "Unknown error" },
      { status: 500 },
    );
  }
}

// ============ POST /api/clients ============
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getAuthUser();
    const currentUserRole = String(
      typeof currentUser?.role === "string"
        ? currentUser.role
        : currentUser?.role?.name ?? "",
    )
      .trim()
      .toLowerCase();
    const isAmCreator =
      currentUserRole === "am" || currentUserRole === "am_ceo";

    const body = await req.json();

    const {
      name,
      birthdate,
      company,
      gender,
      designation,
      location,

      email,
      phone,
      password,
      recoveryEmail,
      websites,
      companywebsite,
      companyaddress,
      biography,
      // Allow JSON payload (array/object/string) for Drive links
      imageDrivelink,
      avatar,
      progress,
      status,
      packageId,
      templateId,
      startDate,
      dueDate,
      socialLinks = [],
      otherField = [],
      articleTopics,
      articleCategories,
      amId,
      keywords,
    } = body;

    console.log("POST /api/clients - Received articleTopics:", articleTopics);
    console.log(
      "POST /api/clients - Received articleCategories:",
      articleCategories,
    );

    if (amId) {
      const am = await prisma.user.findUnique({
        where: { id: amId },
        include: { role: true },
      });
      if (!am || am.role?.name !== "am") {
        return NextResponse.json(
          { error: "amId is not an Account Manager" },
          { status: 400 },
        );
      }
    }

    const trimmedName = String(name ?? "").trim();
    if (!trimmedName) {
      return NextResponse.json(
        { error: "Client name is required" },
        { status: 400 },
      );
    }

    if (packageId) {
      const pkg = await prisma.package.findUnique({ where: { id: packageId } });
      if (!pkg) {
        return NextResponse.json(
          { error: "Invalid packageId" },
          { status: 400 },
        );
      }
    }

    const progressNumber =
      progress === undefined || progress === null || progress === ""
        ? undefined
        : Number(progress);
    if (progressNumber !== undefined && Number.isNaN(progressNumber)) {
      return NextResponse.json(
        { error: "progress must be a number" },
        { status: 400 },
      );
    }

    let client;
    try {
      client = await prisma.client.create({
        data: {
          name: trimmedName,
          birthdate: parseDate(birthdate),
          company,
          gender,
          designation,
          location,

          email,
          phone,
          password,
          recoveryEmail,
          websites,
          companywebsite,
          companyaddress,
          biography,
          imageDrivelink: normalizeImageDrivelink(imageDrivelink),
          avatar,
          progress: progressNumber as any,
          status: isAmCreator ? "draft" : status,
          packageId,
          client_field_06:
            isAmCreator && typeof templateId === "string" && templateId.trim()
              ? {
                  pendingTemplateId: templateId.trim(),
                  pendingTemplateSelectedAt: new Date().toISOString(),
                }
              : undefined,
          startDate: parseDate(startDate) as any,
          dueDate: parseDate(dueDate) as any,
          otherField: [
            ...(Array.isArray(otherField)
              ? otherField.filter((f: any) => f?.title !== "name_keywords")
              : []),
            {
              category: "system",
              title: "name_keywords",
              data: Array.isArray(keywords) ? keywords : [],
            },
          ],

          socialMedia: Array.isArray(socialLinks)
            ? socialLinks
                .filter((l: any) => l && (l.platform || l.url))
                .map((l: any) => ({
                  platform: normalizePlatform(l.platform),
                  url: l.url ?? null,
                  username: l.username ?? null,
                  email: l.email ?? null,
                  phone: l.phone ?? null,
                  password: l.password ?? null,
                  notes: l.notes ?? null,
                }))
            : [],

          articleTopics: articleCategories
            ? normalizeArticleCategories(articleCategories)
            : articleTopics &&
                Array.isArray(articleTopics) &&
                articleTopics.length > 0
              ? articleTopics[0] && "category" in articleTopics[0]
                ? normalizeArticleCategories(articleTopics)
                : normalizeArticleTopics(articleTopics)
              : undefined,
          amId: amId || undefined,
        } as any,
        include: {
          accountManager: { select: { id: true, name: true, email: true } },
        },
      });

      console.log("POST /api/clients - Client created with ID:", client.id);
      console.log(
        "POST /api/clients - Saved articleTopics:",
        (client as any).articleTopics,
      );
    } catch (err: any) {
      console.error(
        "POST /api/clients prisma create error:",
        err?.code,
        err?.message,
        err?.meta,
      );
      if (err?.code === "P2003") {
        return NextResponse.json(
          { error: "Foreign key constraint failed" },
          { status: 400 },
        );
      }
      if (err?.code === "P2002") {
        return NextResponse.json(
          { error: "Unique constraint violation" },
          { status: 409 },
        );
      }
      throw err;
    }

    if (client.id && Array.isArray(keywords) && keywords.length > 0) {
      const clientUser = await prisma.user.findFirst({
        where: { clientId: client.id, role: { name: "client" } },
        select: { id: true, user_field_06: true },
      });

      if (clientUser) {
        const existingData = (clientUser.user_field_06 as any) || {};
        await prisma.user.update({
          where: { id: clientUser.id },
          data: {
            user_field_06: {
              ...existingData,
              keywords,
            },
          },
        });
      }
    }

    // Activity log via /api/activity
    try {
      const origin =
        req.headers.get("origin") || (req as any).nextUrl?.origin || "";
      const cookie = req.headers.get("cookie") ?? "";

      const res = await fetch(`${origin}/api/activity`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({
          entityType: "client",
          entityId: String(client.id),
          action: "onboarded",
          details: {
            name: client.name,
            email: (client as any).email ?? null,
            packageId: (client as any).packageId ?? null,
            amId: (client as any).amId ?? null,
            status: (client as any).status ?? null,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Activity POST failed:", res.status, text);

        try {
          await prisma.activityLog.create({
            data: {
              id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              entityType: "client",
              entityId: String(client.id),
              action: "onboarded",
              details: {
                name: client.name,
                email: (client as any).email ?? null,
                packageId: (client as any).packageId ?? null,
                amId: (client as any).amId ?? null,
                status: (client as any).status ?? null,
              } as any,
            },
          });
        } catch (e2) {
          console.error("Activity fallback failed:", e2);
        }
      }
    } catch (e) {
      console.error("Activity POST error:", e);
      try {
        await prisma.activityLog.create({
          data: {
            id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            entityType: "client",
            entityId: String(client.id),
            action: "onboarded",
            details: {
              name: client.name,
              email: (client as any).email ?? null,
              packageId: (client as any).packageId ?? null,
              amId: (client as any).amId ?? null,
              status: (client as any).status ?? null,
            } as any,
          },
        });
      } catch (e2) {
        console.error("Activity fallback failed:", e2);
      }
    }

    const [pkg, assignmentTemplate, assignedAm] = await Promise.all([
      client.packageId
        ? prisma.package.findUnique({
            where: { id: client.packageId },
            select: { name: true },
          })
        : Promise.resolve(null),
      templateId
        ? prisma.template.findUnique({
            where: { id: String(templateId) },
            select: { name: true },
          })
        : Promise.resolve(null),
      client.amId
        ? prisma.user.findUnique({
            where: { id: client.amId },
            select: { name: true, email: true },
          })
        : Promise.resolve(null),
    ]);

    void notifyDraftClientCreated({
      clientId: client.id,
      clientName: client.name,
      clientStatus: client.status ?? null,
      startDate: client.startDate ?? null,
      dueDate: client.dueDate ?? null,
      company: client.company ?? null,
      packageName: pkg?.name ?? null,
      templateName: assignmentTemplate?.name ?? null,
      createdByName: currentUser?.name ?? null,
      createdByRole: currentUserRole,
      amName: assignedAm?.name ?? null,
      amEmail: assignedAm?.email ?? null,
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("POST /api/clients error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// ============ PUT /api/clients?id=CLIENT_ID ============
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing client id" }, { status: 400 });
    }

    const existingClient = await prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      birthdate,
      company,
      designation,
      location,
      email,
      phone,
      password,
      recoveryEmail,
      websites,
      companywebsite,
      companyaddress,
      biography,
      imageDrivelink,
      avatar,
      progress,
      status,
      packageId,
      startDate,
      dueDate,
      socialLinks = [],
      otherField = [],
      amId,
      articleTopics,
      articleCategories,
      keywords,
    } = body;

    const hasImageDrivelink = Object.prototype.hasOwnProperty.call(
      body,
      "imageDrivelink",
    );

    const updated = await prisma.client.update({
      where: { id },
      data: {
        name,
        birthdate: birthdate ? new Date(birthdate) : null,
        company,
        designation,
        location,
        email,
        phone,
        password,
        recoveryEmail,
        websites,
        companywebsite,
        companyaddress,
        biography,
        imageDrivelink: hasImageDrivelink
          ? normalizeImageDrivelink(imageDrivelink)
          : undefined,
        avatar,
        progress,
        status,
        packageId,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        otherField: [
          ...(Array.isArray(otherField)
            ? otherField.filter((f: any) => f?.title !== "name_keywords")
            : []),
          {
            category: "system",
            title: "name_keywords",
            data: Array.isArray(keywords) ? keywords : [],
          },
        ],
        socialMedia: Array.isArray(socialLinks)
          ? socialLinks
              .filter((l: any) => l && (l.platform || l.url))
              .map((l: any) => ({
                platform: normalizePlatform(l.platform),
                url: l.url ?? null,
                username: l.username ?? null,
                email: l.email ?? null,
                phone: l.phone ?? null,
                password: l.password ?? null,
                notes: l.notes ?? null,
              }))
          : [],
        articleTopics:
          articleCategories !== undefined
            ? normalizeArticleCategories(articleCategories)
            : articleTopics !== undefined
              ? Array.isArray(articleTopics) &&
                articleTopics.length > 0 &&
                (articleTopics as any)[0] &&
                "category" in (articleTopics as any)[0]
                ? normalizeArticleCategories(articleTopics)
                : normalizeArticleTopics(articleTopics)
              : undefined,
        // Preserve existing AM when amId is omitted from the payload
        amId: amId === undefined ? undefined : (amId ?? null),
      },
      include: {
        accountManager: { select: { id: true, name: true, email: true } },
      },
    });

    if (updated.id && Array.isArray(keywords)) {
      const clientUser = await prisma.user.findFirst({
        where: { clientId: updated.id, role: { name: "client" } },
        select: { id: true, user_field_06: true },
      });

      if (clientUser) {
        const existingData = (clientUser.user_field_06 as any) || {};
        await prisma.user.update({
          where: { id: clientUser.id },
          data: {
            user_field_06: {
              ...existingData,
              keywords,
            },
          },
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error in PUT /api/clients:", error);

    if (error instanceof Error) {
      if (error.message.includes("Record to update not found")) {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 },
        );
      }
      if (error.message.includes("Unique constraint")) {
        return NextResponse.json(
          { error: "Email already exists" },
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

// ============ DELETE /api/clients?id=CLIENT_ID ============
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id") ?? "";

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id || "";
      } catch {
        /* ignore body parse errors */
      }
    }

    if (!id) {
      return NextResponse.json({ error: "Missing client id" }, { status: 400 });
    }

    const existingClient = await prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingClient) {
      return NextResponse.json(
        { error: "Client not found or already deleted" },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      const assignments = await tx.assignment.findMany({
        where: { clientId: id },
        select: { id: true },
      });
      const assignmentIds = assignments.map((a) => a.id);

      const directTasks = await tx.task.findMany({
        where: { clientId: id },
        select: { id: true },
      });
      const assignmentTasks =
        assignmentIds.length > 0
          ? await tx.task.findMany({
              where: { assignmentId: { in: assignmentIds } },
              select: { id: true },
            })
          : [];

      const allTaskIds = Array.from(
        new Set([...directTasks, ...assignmentTasks].map((t) => t.id)),
      );

      if (allTaskIds.length) {
        await tx.comment.deleteMany({ where: { taskId: { in: allTaskIds } } });
        await tx.report.deleteMany({ where: { taskId: { in: allTaskIds } } });
        await tx.notification.deleteMany({
          where: { taskId: { in: allTaskIds } },
        });
      }

      if (allTaskIds.length) {
        await tx.task.deleteMany({ where: { id: { in: allTaskIds } } });
      }

      if (assignmentIds.length) {
        await tx.assignmentSiteAssetSetting.deleteMany({
          where: { assignmentId: { in: assignmentIds } },
        });
        await tx.assignment.deleteMany({
          where: { id: { in: assignmentIds } },
        });
      }

      await tx.clientTeamMember.deleteMany({ where: { clientId: id } });

      await tx.client.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Error in DELETE /api/clients:", error);

    if (error instanceof Error) {
      if (error.message.includes("Record to delete does not exist")) {
        return NextResponse.json(
          { error: "Client not found or already deleted" },
          { status: 404 },
        );
      }
      if (error.message.includes("Foreign key constraint")) {
        return NextResponse.json(
          { error: "Cannot delete client with existing dependencies" },
          { status: 409 },
        );
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
