// app/[role]/notifications/[id]/page.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { markOneRead } from "@/lib/hooks/use-notifications";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type NotificationItem = {
  id: number;
  userId: string;
  taskId?: string | null;
  type: "frequency_missed" | "performance" | "general";
  message: string;
  createdAt: string;
  isRead: boolean;
  targetPath?: string | null;
};

const roleBasePath = (role?: string | null) => {
  switch (role) {
    case "admin":
      return "/admin";
    case "manager":
      return "/manager";
    case "agent":
      return "/agent";
    case "qc":
      return "/qc";
    case "am":
      return "/am";
    case "am_ceo":
      return "/am_ceo";
    case "data_entry":
      return "/data_entry";
    case "client":
      return "/client";
    case "user":
    default:
      return "/client";
  }
};

export default function NotificationDetailsPage() {
  const params = useParams<{ role: string; id: string }>();
  const { user } = useUserSession();
  const rawRole = Array.isArray(params?.role) ? params.role[0] : params?.role;
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const effectiveRole = user?.role ?? rawRole ?? "user";
  const apiBase =
    effectiveRole === "am" ? "/api/am/notifications" : "/api/notifications";
  const basePath = roleBasePath(effectiveRole);

  const [notification, setNotification] = useState<NotificationItem | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formattedDate = useMemo(() => {
    if (!notification?.createdAt) return "";
    return new Date(notification.createdAt).toLocaleString();
  }, [notification?.createdAt]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!rawId) return;
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${apiBase}/${rawId}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.success === false) {
          throw new Error(data?.message || "Failed to load notification");
        }
        if (!cancelled) {
          setNotification(data.notification ?? null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load notification");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [apiBase, rawId]);

  useEffect(() => {
    const markRead = async () => {
      if (!notification || notification.isRead) return;
      await markOneRead(notification.id, apiBase);
      setNotification((prev) =>
        prev ? { ...prev, isRead: true } : prev
      );
    };
    markRead();
  }, [apiBase, notification]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button asChild variant="outline" size="sm">
          <Link href={`${basePath}/notifications`}>Back to notifications</Link>
        </Button>
      </div>

      {loading && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-40" />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-6 text-sm text-red-600">
            {error}
          </CardContent>
        </Card>
      )}

      {!loading && !error && notification && (
        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Notification</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={notification.isRead ? "secondary" : "default"}>
                  {notification.isRead ? "Read" : "Unread"}
                </Badge>
                <Badge variant="outline">{notification.type}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-gray-800">{notification.message}</div>
            <div className="text-xs text-gray-500">{formattedDate}</div>
            {notification.taskId && (
              <div className="text-xs text-gray-500">
                Task ID: {notification.taskId}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
