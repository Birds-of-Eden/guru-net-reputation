// components/realtime/RealtimeBridge.tsx
// Mounted once in the root layout. Listens on the signed-in user's personal
// channel and instantly revalidates notification + chat data everywhere
// (bell, /notifications page, sidebar badges, conversation lists).
"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSWRConfig } from "swr";
import { realtimeClient } from "@/lib/realtime/client";

const isNotificationKey = (key: unknown) =>
  typeof key === "string" && key.includes("/notifications");

const isChatListKey = (key: unknown) =>
  typeof key === "string" &&
  (/^\/api\/chat\/conversations(\?|$)/.test(key) || key.startsWith("/api/chat/unread-count"));

// Task lists on screen. The all-clients distribution list is excluded: it is
// very heavy and keeps its own 60s refresh.
const isTaskKey = (key: unknown) =>
  typeof key === "string" &&
  key.startsWith("/api/tasks") &&
  !key.startsWith("/api/tasks/clients?");

// At most one task refresh per tab every 10s (the old polling interval), so
// realtime can never cost more than polling did. Hidden tabs refresh when shown.
const TASK_REFRESH_MIN_GAP_MS = 10_000;

export default function RealtimeBridge() {
  const { status } = useSession();
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (status !== "authenticated") return;

    const channel = realtimeClient.personal();
    const refreshNotifications = () => mutate(isNotificationKey);
    const refreshChat = () => mutate(isChatListKey);
    const refreshAll = () => {
      refreshNotifications();
      refreshChat();
    };

    // ---- task:changed → throttled task-list refresh ----
    let lastTaskRefresh = 0;
    let taskTimer: ReturnType<typeof setTimeout> | null = null;
    let taskPendingWhileHidden = false;
    const runTaskRefresh = () => {
      taskTimer = null;
      if (document.hidden) {
        taskPendingWhileHidden = true;
        return;
      }
      lastTaskRefresh = Date.now();
      void mutate(isTaskKey);
    };
    const onTaskChanged = () => {
      if (taskTimer) return; // a refresh is already scheduled
      const wait = Math.max(0, lastTaskRefresh + TASK_REFRESH_MIN_GAP_MS - Date.now());
      taskTimer = setTimeout(runTaskRefresh, wait);
    };
    const onVisible = () => {
      if (!document.hidden && taskPendingWhileHidden) {
        taskPendingWhileHidden = false;
        onTaskChanged();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    channel.bind("notification:changed", refreshNotifications);
    channel.bind("chat:changed", refreshChat);
    channel.bind("task:changed", onTaskChanged);
    channel.bind("realtime:reconnected", refreshAll);
    channel.bind("realtime:reconnected", onTaskChanged);

    return () => {
      channel.unbind("notification:changed", refreshNotifications);
      channel.unbind("chat:changed", refreshChat);
      channel.unbind("task:changed", onTaskChanged);
      channel.unbind("realtime:reconnected", refreshAll);
      channel.unbind("realtime:reconnected", onTaskChanged);
      document.removeEventListener("visibilitychange", onVisible);
      if (taskTimer) clearTimeout(taskTimer);
      realtimeClient.unsubscribe("__personal");
    };
  }, [status, mutate]);

  return null;
}
