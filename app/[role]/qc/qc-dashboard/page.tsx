import QCDashboard from "@/components/QCDashboard";
import { headers, cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

// ✅ helper
function buildBaseUrl(proto: string, host: string) {
  return `${proto}://${host}`;
}

function todayRangeParams() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    sortBy: "updatedAt",
    sortDir: "desc",
    limit: "400",
    rangeBy: "activity",
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  });

  return params.toString();
}

export default async function Page() {
  noStore(); // avoid caching
  let tasks: any[] = [];

  try {
    // ✅ await dynamic APIs
    const h = await headers();
    const host =
      h.get("x-forwarded-host") ||
      h.get("host") ||
      `localhost:${process.env.PORT || 4175}`; // fallback for dev

    const proto =
      h.get("x-forwarded-proto") ||
      (host.startsWith("localhost") ? "http" : "https");

    // ✅ prefer env for production
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      process.env.NEXTAUTH_URL ||
      buildBaseUrl(proto, host);

    // ✅ cookies() is async now
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // ✅ fetch QC tasks securely (latest activity window, ordered)
    const res = await fetch(`${baseUrl}/api/tasks?${todayRangeParams()}`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });

    if (res.ok) {
      tasks = await res.json();
    } else {
      console.error("❌ Failed to fetch tasks:", res.status, res.statusText);
    }
  } catch (error) {
    console.error("🔥 Failed to load tasks:", error);
  }

  return (
    <div className="min-h-screen">
      <QCDashboard tasks={tasks} />
    </div>
  );
}
