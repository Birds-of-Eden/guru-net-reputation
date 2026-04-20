"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import CustomJobFormModal from "./CustomJobFormModal";
import { CustomJobFormSkeleton } from "./CustomJobFormSkeleton";
import { Button } from "@/components/ui/button";
import { ClientOption, CustomJob } from "./customJobsTypes";
import { useAuth } from "@/context/auth-context";

export default function CustomJobEditPageClient() {
  const router = useRouter();
  const params = useParams<{ role: string; jobId: string }>();
  const role = typeof params?.role === "string" ? params.role : "";
  const jobId = typeof params?.jobId === "string" ? params.jobId : "";
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [job, setJob] = useState<CustomJob | null>(null);
  const [loading, setLoading] = useState(true);
  const userRole =
    typeof user?.role === "string" ? user.role : (user?.role as any)?.name;
  const userId = user?.id;
  const isAM = userRole === "am";

  const listHref = useMemo(
    () => `/${role}/distribution/custom_jobs`,
    [role],
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientsRes, jobRes] = await Promise.all([
          fetch("/api/clients"),
          fetch(`/api/custom-jobs/${jobId}`),
        ]);

        const clientsResult = await clientsRes.json();
        const jobResult = await jobRes.json();

        const clientList = Array.isArray(clientsResult?.clients)
          ? clientsResult.clients
          : [];
        const scopedList =
          isAM && userId
            ? clientList.filter((item: any) => item.amId === userId)
            : clientList;

        setClients(
          scopedList.map((item: any) => ({
            id: item.id,
            name: item.name,
            company: item.company,
          })),
        );
        setJob(jobResult?.success ? (jobResult.data as CustomJob) : null);
      } catch (error) {
        console.error(error);
        setClients([]);
        setJob(null);
      } finally {
        setLoading(false);
      }
    };

    if (jobId) {
      fetchData();
      return;
    }

    setLoading(false);
  }, [isAM, jobId, userId]);

  return (
    <div className="min-h-screen space-y-6 bg-linear-to-br from-slate-50 via-white to-slate-100">
      {loading ? (
        <CustomJobFormSkeleton />
      ) : job ? (
        <CustomJobFormModal
          editingJob={job}
          clients={clients}
          onCancel={() => router.push(listHref)}
          onSuccess={() => {
            router.push(listHref);
            router.refresh();
          }}
        />
      ) : (
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between rounded-3xl border border-red-200 bg-white p-8 text-sm text-red-600 shadow-sm">
          <span>Custom job not found.</span>
          <Button type="button" variant="outline" onClick={() => router.push(listHref)}>
            Back to list
          </Button>
        </div>
      )}
    </div>
  );
}
