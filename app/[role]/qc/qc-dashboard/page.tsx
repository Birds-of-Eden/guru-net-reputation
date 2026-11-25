import QCDashboard from "@/components/QCDashboard";
import { headers, cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { getAuthUser } from "@/lib/getAuthUser";
import { getRequestOrigin } from "@/lib/request-origin";

export const dynamic = "force-dynamic";


function todayRangeParams(qcSupervisorId?: string) {
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

  // ⭐ Add QC supervisor filter to show only supervised agents' tasks
  if (qcSupervisorId) {
    params.append("qcSupervisorId", qcSupervisorId);
  }

  return params.toString();
}

export default async function Page() {
  noStore(); // avoid caching
  let tasks: any[] = [];

  try {
    // ✅ Get current user (QC supervisor)
    const user = await getAuthUser();
    if (!user?.id) {
      console.error("❌ No authenticated user found");
      return (
        <div className="min-h-screen">
          <QCDashboard tasks={[]} />
        </div>
      );
    }

    // ✅ await dynamic APIs
    const h = await headers();
    // Use the host this request came in on (localhost / Cloudflare tunnel / prod)
    const baseUrl = getRequestOrigin(h);

    // ✅ cookies() is async now
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // ✅ fetch QC tasks for supervised agents only (today's range, ordered by activity)
    const res = await fetch(
      `${baseUrl}/api/tasks?${todayRangeParams(user.id)}`,
      {
        cache: "no-store",
        headers: cookieHeader ? { cookie: cookieHeader } : {},
      }
    );

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
