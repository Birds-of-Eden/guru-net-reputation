// lib/hooks/use-dashboard-stats.ts
// Enhanced hook for dashboard statistics with SWR integration

"use client";

import useSWR from "swr";
import { useMemo } from "react";

// Dashboard stats interface
export interface DashboardStats {
  overview: {
    totalClients: number;
    totalTasks: number;
    totalUsers: number;
    totalTeams: number;
    totalPackages: number;
    totalTemplates: number;
    totalAssignments: number;
    totalNotifications: number;
    totalConversations: number;
    totalMessages: number;
    unreadNotifications: number;
  };
  tasks: {
    total: number;
    completed: number;
    pending: number;
    inProgress: number;
    overdue: number;
    completionRate: number;
    avgCompletionTime: number;
    byPriority: Array<{ priority: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
    performanceRatings: Array<{ rating: string; count: number }>;
  };
  rangeInfo?: {
    range: string;
    start: string | Date;
    end: string | Date;
    label: string;
  };
  clients: {
    total: number;
    growthRate: number;
    addedThisWeek: number;
    addedThisMonth: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  teams: {
    total: number;
    efficiency: number;
    data: Array<{
      id: string;
      name: string;
      totalMembers: number;
      clientMembers: number;
      templateMembers: number;
    }>;
  };
  users: {
    total: number;
    roleDistribution: Array<{ role: string; count: number }>;
  };
  timeMetrics: {
    tasksCompletedThisWeek: number;
    tasksCompletedThisMonth: number;
    clientsAddedThisWeek: number;
    clientsAddedThisMonth: number;
    currentRange?: {
      range: string;
      start: string | Date;
      end: string | Date;
      tasksCompleted: number;
      clientsAdded: number;
    };
  };
  recent: {
    clients: Array<{
      id: string;
      name: string;
      company?: string;
      status?: string;
      progress?: number | null;
      packageName?: string;
      accountManager?: string;
      taskCount: number;
      createdAt: string;
      avatar?: string | null;
    }>;
    tasks: Array<{
      id: string;
      name: string;
      status: string;
      priority: string;
      dueDate?: string | null;
      clientName?: string;
      assignedToName?: string;
      categoryName?: string;
      completedAt?: string | null;
      createdAt: string;
    }>;
    users: Array<{
      id: string;
      name?: string | null;
      email: string;
      roleName?: string | null;
      status: string;
      taskCount: number;
      createdAt: string;
      image?: string | null;
    }>;
    notifications: Array<{
      id: number;
      type: string;
      message: string;
      isRead: boolean;
      userName?: string;
      taskName?: string;
      createdAt: string;
    }>;
    activities: Array<{
      id: string;
      entityType: string;
      action: string;
      userName?: string;
      timestamp: string;
    }>;
  };
}

// Pre-indexed structure for fast lookups
interface DashboardIndex {
  tasksByStatus: Map<string, any[]>;
  tasksByPriority: Map<string, any[]>;
  tasksByCategory: Map<string, any[]>;
  clientsByStatus: Map<string, any[]>;
  usersByRole: Map<string, any[]>;
}

interface UseDashboardStatsReturn {
  stats: DashboardStats | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  // Pre-indexed data
  index: DashboardIndex;
  // Helper getters
  getLatestItems: <T extends Record<string, any>>(
    items: T[] | undefined,
    dateKey: keyof T,
    count?: number
  ) => T[];
}

// Fetcher function for SWR
const fetcher = async (url: string): Promise<DashboardStats> => {
  const response = await fetch(url, {
    cache: "no-store", // Dashboard needs fresh data
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard stats: ${response.status}`);
  }

  return response.json();
};

// Helper to build pre-indexed structure
function buildDashboardIndex(stats: DashboardStats | null): DashboardIndex {
  const tasksByStatus = new Map<string, any[]>();
  const tasksByPriority = new Map<string, any[]>();
  const tasksByCategory = new Map<string, any[]>();
  const clientsByStatus = new Map<string, any[]>();
  const usersByRole = new Map<string, any[]>();

  if (!stats) {
    return {
      tasksByStatus,
      tasksByPriority,
      tasksByCategory,
      clientsByStatus,
      usersByRole,
    };
  }

  // Index tasks by status
  stats.tasks.byStatus?.forEach((item) => {
    tasksByStatus.set(item.status, [item]);
  });

  // Index tasks by priority
  stats.tasks.byPriority?.forEach((item) => {
    tasksByPriority.set(item.priority, [item]);
  });

  // Index recent tasks by category
  stats.recent.tasks?.forEach((task) => {
    if (task.categoryName) {
      if (!tasksByCategory.has(task.categoryName)) {
        tasksByCategory.set(task.categoryName, []);
      }
      tasksByCategory.get(task.categoryName)!.push(task);
    }
  });

  // Index clients by status
  stats.clients.byStatus?.forEach((item) => {
    clientsByStatus.set(item.status, [item]);
  });

  // Index users by role
  stats.users.roleDistribution?.forEach((item) => {
    usersByRole.set(item.role, [item]);
  });

  return {
    tasksByStatus,
    tasksByPriority,
    tasksByCategory,
    clientsByStatus,
    usersByRole,
  };
}

// Helper to sort and get latest N items
function takeLatest<T extends Record<string, any>>(
  arr: T[] | undefined,
  dateKey: keyof T,
  n = 5
): T[] {
  if (!Array.isArray(arr)) return [];
  return [...arr]
    .sort(
      (a, b) =>
        new Date(b[dateKey] as string).getTime() -
        new Date(a[dateKey] as string).getTime()
    )
    .slice(0, n);
}

export function useDashboardStats(
  timeRange: string = "this_month"
): UseDashboardStatsReturn {
  // ✅ SWR integration with auto-revalidation
  const { data, error, mutate, isLoading } = useSWR<DashboardStats>(
    `/api/dashboardStats?range=${encodeURIComponent(timeRange)}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 10000, // 10 seconds deduplication
      refreshInterval: 30000, // Auto-refresh every 30 seconds
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  );

  // ✅ Pre-indexed data structure - memoized
  const index = useMemo(() => {
    return buildDashboardIndex(data || null);
  }, [data]);

  // ✅ Helper function for getting latest items
  const getLatestItems = useMemo(
    () =>
      <T extends Record<string, any>>(
        items: T[] | undefined,
        dateKey: keyof T,
        count: number = 5
      ): T[] => {
        return takeLatest(items, dateKey, count);
      },
    []
  );

  return {
    stats: data || null,
    loading: isLoading,
    error: error || null,
    refetch: async () => {
      await mutate();
    },
    index,
    getLatestItems,
  };
}
