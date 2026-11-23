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

    channel.bind("notification:changed", refreshNotifications);
    channel.bind("chat:changed", refreshChat);
    channel.bind("realtime:reconnected", refreshAll);

    return () => {
      channel.unbind("notification:changed", refreshNotifications);
      channel.unbind("chat:changed", refreshChat);
      channel.unbind("realtime:reconnected", refreshAll);
      realtimeClient.unsubscribe("__personal");
    };
  }, [status, mutate]);

  return null;
}
