// components/clients/clientsID/template-customization/customization-history.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { History } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CustomizationHistoryProps {
  assignmentId: string;
  clientName: string;
}

const ACTIONS: Record<string, { label: string; dot: string }> = {
  customize_template: { label: "Customized", dot: "bg-purple-500" },
  sync_template: { label: "Switched", dot: "bg-blue-500" },
  create_assignment: { label: "Created", dot: "bg-emerald-500" },
};

export function CustomizationHistory({ assignmentId }: CustomizationHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/activity-logs?entityType=Assignment&entityId=${assignmentId}&limit=10`
        );
        if (!response.ok) throw new Error(`Failed to fetch history (${response.status})`);
        const data = await response.json();
        const relevant = Array.isArray(data)
          ? data.filter((a: any) => a.action in ACTIONS)
          : [];
        if (!cancelled) setActivities(relevant);
      } catch (error) {
        console.error("Error fetching history:", error);
        if (!cancelled) setActivities([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, [assignmentId]);

  if (!loading && activities.length === 0) return null;

  return (
    <Card>
      <CardHeader className="border-b px-5 py-4 [.border-b]:pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-muted-foreground" />
          Recent changes
        </CardTitle>
      </CardHeader>
      <CardContent className="px-5 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <ol className="relative space-y-4 border-l pl-5">
            {activities.map((activity) => {
              const meta = ACTIONS[activity.action] ?? { label: activity.action, dot: "bg-slate-400" };
              return (
                <li key={activity.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background",
                      meta.dot
                    )}
                  />
                  <p className="text-sm">
                    <span className="font-medium">{meta.label}</span>
                    {activity.details?.description && (
                      <span className="text-muted-foreground"> · {activity.details.description}</span>
                    )}
                  </p>
                  {activity.details?.summary && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{activity.details.summary}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {format(new Date(activity.timestamp), "MMM d, yyyy · h:mm a")}
                    {activity.user && ` · ${activity.user.name || "System"}`}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
