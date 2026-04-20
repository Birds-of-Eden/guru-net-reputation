"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import CustomJobFormModal from "./CustomJobFormModal";
import { CustomJobFormSkeleton } from "./CustomJobFormSkeleton";
import { Button } from "@/components/ui/button";
import { ClientOption, CustomJob } from "./customJobsTypes";
import { useAuth } from "@/context/auth-context";

export default function CustomJobCreatePageClient() {
  const router = useRouter();
  const params = useParams<{ role: string }>();
  const role = typeof params?.role === "string" ? params.role : "";
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const userRole =
    typeof user?.role === "string" ? user.role : (user?.role as any)?.name;
  const userId = user?.id;
  const isAM = userRole === "am";

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch("/api/clients");
        const result = await res.json();
        const list = Array.isArray(result?.clients) ? result.clients : [];
        const scopedList =
          isAM && userId
            ? list.filter((item: any) => item.amId === userId)
            : list;
        setClients(
          scopedList.map((item: any) => ({
            id: item.id,
            name: item.name,
            company: item.company,
          })),
        );
      } catch (error) {
        console.error(error);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [isAM, userId]);

  const listHref = `/${role}/distribution/custom_jobs`;

  return (
    <div className="min-h-screen space-y-6 bg-linear-to-br from-slate-50 via-white to-slate-100">
      {loading ? <CustomJobFormSkeleton /> : (
        <CustomJobFormModal
          clients={clients}
          onCancel={() => router.push(listHref)}
          onSuccess={(_: CustomJob) => {
            router.push(listHref);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
