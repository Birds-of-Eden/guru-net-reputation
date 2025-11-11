// app/[role]/track-development/page.tsx
import { getAuthUser } from "@/lib/getAuthUser";
import { redirect } from "next/navigation";
import TrackDevelopment from "@/components/track-development/track-development-client";

export const dynamic = "force-dynamic";

export default async function TrackDevelopmentPage() {
  const user = await getAuthUser();
  if (!user) redirect("/auth/sign-in");

  return <TrackDevelopment />;
}
