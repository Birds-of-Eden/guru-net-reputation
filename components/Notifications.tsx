// components/Notifications.tsx

"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import useSWR, { mutate } from "swr";
import {
  markOneRead,
  markAllRead,
} from "@/lib/hooks/use-notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, Search, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserSession } from "@/lib/hooks/use-user-session";

function formatDateHeader(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - that.getTime()) / 86400000;
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString();
}

function htmlToText(input: unknown): string {
  const html = String(input ?? "");
  if (!html) return "";
  if (typeof window === "undefined") {
    return html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(" ")}…`;
}

// ⚡ OPTIMIZED: Debounce hook
function useDebounced<T>(val: T, delay = 400) {
  const [v, setV] = useState(val);
  useEffect(() => {
    const t = setTimeout(() => setV(val), delay);
    return () => clearTimeout(t);
  }, [val, delay]);
  return v;
}

// ⚡ OPTIMIZED: SWR fetcher
const jsonFetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error || "Failed to fetch");
  }
  return data;
};

type NotificationsProps = {
  apiBase?: string; // defaults to "/api/notifications"
};

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

type PaginationInfo = {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  limit: number;
};

export default function Notifications({
  apiBase,
}: NotificationsProps) {
  // Get user session to determine role-aware API base
  const { user } = useUserSession();
  
  // Role-aware API base detection (same logic as app-sidebar.tsx)
  const roleAwareApiBase = useMemo(() => {
    if (apiBase) return apiBase; // If explicitly provided, use it
    
    // Auto-detect based on user role (same as NotificationBell in sidebar)
    const userRole = user?.role;
    return userRole === "am" ? "/api/am/notifications" : "/api/notifications";
  }, [apiBase, user?.role]);

  // filters state
  const [type, setType] = useState<string>("all");
  const [readState, setReadState] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const qDeb = useDebounced(q, 400);

  // ⚡ OPTIMIZED: Memoize API URL for SWR
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("limit", "20");
    params.set("sort", sort);
    if (type !== "all") params.set("type", type);
    if (readState === "unread") params.set("isRead", "false");
    if (readState === "read") params.set("isRead", "true");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (qDeb) params.set("q", qDeb);
    return `${roleAwareApiBase}?${params.toString()}`;
  }, [roleAwareApiBase, currentPage, type, readState, from, to, qDeb, sort]);

  // ⚡ OPTIMIZED: Use SWR for automatic caching and revalidation
  const { data, error, isLoading } = useSWR(apiUrl, jsonFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  const notifications = data?.notifications || [];
  const pagination = data?.pagination || null;

  // ⚡ OPTIMIZED: Refresh using SWR mutate
  const refresh = useCallback(() => mutate(apiUrl), [apiUrl]);

  // group by day label
  const grouped = useMemo(() => {
    const map: Record<string, typeof notifications> = {};
    const sorted = notifications
      .slice()
      .sort((a: NotificationItem, b: NotificationItem) =>
        sort === "desc"
          ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    sorted.forEach((n: NotificationItem) => {
      const key = formatDateHeader(n.createdAt);
      (map[key] ||= []).push(n);
    });
    return map;
  }, [notifications, sort]);

  // ⚡ OPTIMIZED: Memoize page change handler
  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= (pagination?.totalPages || 1)) {
      setCurrentPage(page);
    }
  }, [pagination?.totalPages]);

  // ⚡ OPTIMIZED: Memoize page numbers calculation
  const getPageNumbers = useCallback(() => {
    if (!pagination) return [];

    const { currentPage, totalPages } = pagination;
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  }, [pagination]);

  // ⚡ OPTIMIZED: Memoize page numbers array
  const pageNumbers = useMemo(() => getPageNumbers(), [getPageNumbers]);

  // ⚡ OPTIMIZED: Memoize reset filters handler
  const resetFilters = useCallback(() => {
    setType("all");
    setReadState("all");
    setFrom("");
    setTo("");
    setQ("");
    setSort("desc");
  }, []);

  // ⚡ OPTIMIZED: Memoize active filters check
  const hasActiveFilters = useMemo(() =>
    type !== "all" ||
    readState !== "all" ||
    from !== "" ||
    to !== "" ||
    q !== "" ||
    sort !== "desc",
    [type, readState, from, to, q, sort]
  );

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Notifications</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={
                  showFilters || hasActiveFilters ? "default" : "outline"
                }
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
                size="sm"
              >
                {showFilters ? <X size={16} /> : <Filter size={16} />}
                {showFilters ? "Hide" : "Filter"}
                {hasActiveFilters && !showFilters && (
                  <span className="h-2 w-2 rounded-full bg-primary"></span>
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await markAllRead(roleAwareApiBase);
                  refresh();
                }}
                size="sm"
              >
                Mark all read
              </Button>
            </div>
          </div>

          {/* Search bar - always visible */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search notifications..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>

          {pagination && !isLoading && (
            <div className="text-sm text-gray-600">
              Showing {(pagination.currentPage - 1) * pagination.limit + 1} to{" "}
              {Math.min(
                pagination.currentPage * pagination.limit,
                pagination.totalCount
              )}{" "}
              of {pagination.totalCount} notifications
            </div>
          )}

          {/* Filters - conditionally rendered */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3 pt-2">
              {/* Type */}
              <div className="md:col-span-1">
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="frequency_missed">
                      Frequency missed
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Read state */}
              <div className="md:col-span-1">
                <Select value={readState} onValueChange={setReadState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Read state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unread">Unread only</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* From */}
              <div className="md:col-span-1">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="From date"
                />
              </div>

              {/* To */}
              <div className="md:col-span-1">
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="To date"
                />
              </div>

              {/* Sort */}
              <div className="md:col-span-1">
                <Select
                  value={sort}
                  onValueChange={(v: "asc" | "desc") => setSort(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Newest first</SelectItem>
                    <SelectItem value="asc">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reset button */}
              <div className="md:col-span-1">
                <Button
                  variant="outline"
                  onClick={resetFilters}
                  className="w-full"
                  disabled={!hasActiveFilters}
                  size="sm"
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="text-red-600">Failed to load notifications.</div>
        )}
        
        {isLoading && (
          // Skeleton loader for notifications
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, dateIndex) => (
              <div key={`skeleton-date-${dateIndex}`} className="mb-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <div className="divide-y rounded-lg border">
                  {Array.from({ length: 3 }).map((_, itemIndex) => (
                    <div key={`skeleton-item-${itemIndex}`} className="p-3 flex items-start justify-between">
                      <div className="pr-3 flex-1 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-32" />
                        <div className="flex gap-2 mt-1">
                          <Skeleton className="h-5 w-20 rounded-full" />
                          <Skeleton className="h-5 w-24 rounded-full" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Skeleton className="h-8 w-20 rounded" />
                        <Skeleton className="h-8 w-16 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && !error && notifications.length === 0 && (
          <div className="text-gray-500">No notifications found.</div>
        )}

        {!isLoading &&
          !error &&
          Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel} className="mb-6">
              <div className="text-xs font-semibold text-gray-500 mb-2">
                {dateLabel}
              </div>
              <div className="divide-y rounded-lg border">
                {items.map((n: NotificationItem) => (
                  <div
                    key={n.id}
                    className={`p-3 flex items-start justify-between ${
                      n.isRead ? "" : "bg-blue-50/60"
                    }`}
                  >
                    <div className="pr-3">
                      <div className="text-sm">{truncateWords(htmlToText(n.message), 20)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                      <div className="mt-1">
                        <Badge variant="outline">{n.type}</Badge>
                        {n.taskId && (
                          <Badge className="ml-2" variant="secondary">
                            task: {String(n.taskId).slice(0, 6)}…
                          </Badge>
                        )}
                      </div>
                      
                    </div>
                    <div className="flex gap-2">
                      {!n.isRead && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await markOneRead(n.id, roleAwareApiBase);
                            refresh();
                          }}
                        >
                          Mark read
                        </Button>
                      )}
                      {(n as any).targetPath && (
                        <Button
                          size="sm"
                          onClick={() =>
                            (window.location.href = (n as any).targetPath!)
                          }
                        >
                          Open
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

        {pagination && pagination.totalPages > 1 && !isLoading && (
          <div className="flex items-center justify-between pt-4 mt-6 border-t">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={!pagination.hasPrevPage}
                variant="outline"
                size="sm"
              >
                Previous
              </Button>

              <div className="flex items-center gap-1">
                {pageNumbers.map((page, index) => (
                  <Button
                    key={index}
                    onClick={() =>
                      typeof page === "number"
                        ? handlePageChange(page)
                        : undefined
                    }
                    disabled={page === "..."}
                    variant={page === currentPage ? "default" : "outline"}
                    size="sm"
                    className={`${
                      page === "..."
                        ? "cursor-default hover:bg-transparent"
                        : ""
                    }`}
                  >
                    {page}
                  </Button>
                ))}
              </div>

              <Button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!pagination.hasNextPage}
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            </div>

            <div className="text-sm text-gray-600">
              Page {pagination.currentPage} of {pagination.totalPages}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
