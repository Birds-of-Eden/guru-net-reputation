// app/[role]/user/user-table.tsx
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Search,
  Plus,
  UserCheck,
  UserX,
  Mail,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  User,
  Phone,
  MapPin,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@radix-ui/react-avatar";
import { useUserSession } from "@/lib/hooks/use-user-session";
import ImpersonateButton from "@/components/users/ImpersonateButton";

import UserFormDialog from "./UserFormDialog";
import type { UserInterface, Role, UserStatus } from "@/types/user";
import { hasPermissionClient } from "@/lib/permissions-client";

export default function UsersPage() {
  const { user: currentUser, loading: sessionLoading } = useUserSession();

  const [actionLoading, setActionLoading] = useState(false);

  // Pagination
  const [pageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState(""); // ✅ query uses this
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // ✅ Debounce: user টাইপ করা থামলেই search apply হবে
  useEffect(() => {
    const value = searchTerm.trim();

    // empty হলে সাথে সাথে clear করে দাও
    if (!value) {
      setAppliedSearch("");
      setPageIndex(0);
      return;
    }

    // ✅ Optional: 1 char এ search না হোক
    const MIN_CHARS = 2; // চাইলে 3 করো
    if (value.length < MIN_CHARS) return;

    const timer = setTimeout(() => {
      setAppliedSearch(value);
      setPageIndex(0);
    }, 900); // ✅ debounce time (ms) — চাইলে 1200 করো

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Dialogs
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);

  // New modular Dialogs
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);

  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserInterface | null>(null);
  const [editUser, setEditUser] = useState<UserInterface | null>(null);

  // Permissions
  const canViewUser =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "user_view");
  const canEditUser =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "user_edit");
  const canDeleteUser =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "user_delete");
  const canImpersonate =
    !sessionLoading &&
    hasPermissionClient(currentUser?.permissions, "user_impersonate");
  const showActions =
    canViewUser || canEditUser || canDeleteUser || canImpersonate;

  // ⚡ OPTIMIZED: SWR fetcher
  const jsonFetcher = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch");
    return res.json();
  };

  // ⚡ OPTIMIZED: Build query params as SWR key
  const usersKey = useMemo(() => {
    const params = new URLSearchParams({
      limit: pageSize.toString(),
      offset: (pageIndex * pageSize).toString(),
    });

    if (appliedSearch) params.append("q", appliedSearch); // ✅ debounced value

    if (statusFilter && statusFilter !== "all")
      params.append("status", statusFilter);
    if (categoryFilter && categoryFilter !== "all")
      params.append("category", categoryFilter);
    if (roleFilter && roleFilter !== "all") params.append("role", roleFilter);

    return `/api/users?${params.toString()}`;
  }, [pageIndex, pageSize, appliedSearch, statusFilter, categoryFilter, roleFilter]);

  // ⚡ OPTIMIZED: Fetch users with SWR
  const {
    data: usersData,
    isLoading: loading,
    mutate: mutateUsers,
    error: usersError,
  } = useSWR(usersKey, jsonFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  const users = usersData?.users || [];
  const totalUsers = usersData?.total || 0;

  // ⚡ OPTIMIZED: Fetch stats with SWR (parallel)
  const { data: statsData, isLoading: statsLoading, mutate: mutateStats } =
    useSWR("/api/users/stats", jsonFetcher, {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
      refreshInterval: 60000,
    });

  const stats = useMemo(() => {
    if (statsData?.success && statsData?.data?.overview) {
      return statsData.data.overview;
    }
    // Fallback calculation from current users
    return {
      totalUsers: users.length,
      activeUsers: users.filter((u: UserInterface) => (u.status || "active") === "active").length,
      inactiveUsers: users.filter((u: UserInterface) => (u.status || "active") === "inactive").length,
      suspendedUsers: users.filter((u: UserInterface) => (u.status || "active") === "suspended").length,
      verifiedUsers: users.filter((u: UserInterface) => u.emailVerified).length,
      unverifiedUsers: users.filter((u: UserInterface) => !u.emailVerified).length,
      recentUsers: 0,
    };
  }, [statsData, users]);

  // ⚡ OPTIMIZED: Fetch roles with SWR (parallel)
  const { data: rolesData } = useSWR("/api/roles", jsonFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const roles = useMemo(() => {
    if (rolesData?.success && rolesData?.data) {
      return Array.isArray(rolesData.data) ? rolesData.data : [];
    }
    return [];
  }, [rolesData]);

  // ⚡ OPTIMIZED: Fetch categories with SWR (parallel)
  const { data: categoriesData } = useSWR("/api/users?limit=1000", jsonFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const allCategories = useMemo(() => {
    if (categoriesData?.users) {
      return Array.from(
        new Set(categoriesData.users.map((u: any) => u.category).filter(Boolean))
      ) as string[];
    }
    return Array.from(new Set(users.map((u: UserInterface) => u.category).filter(Boolean))) as string[];
  }, [categoriesData, users]);

  // Show error toast if fetch fails
  useEffect(() => {
    if (usersError) {
      toast.error("Failed to fetch users", {
        description: "An error occurred while fetching users",
      });
    }
  }, [usersError]);

  const getStatusBadge = useCallback((status: UserStatus | undefined) => {
    const safeStatus = status || "active";
    const colors: Record<UserStatus, string> = {
      active: "bg-green-100 text-green-800 hover:bg-green-100",
      inactive: "bg-gray-100 text-gray-800 hover:bg-gray-100",
      suspended: "bg-red-100 text-red-800 hover:bg-red-100",
    };
    return (
      <Badge variant="outline" className={colors[safeStatus]}>
        {safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1)}
      </Badge>
    );
  }, []);

  const formatDate = useCallback(
    (dateString: string) =>
      new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    []
  );

  const nextPage = useCallback(() => {
    if ((pageIndex + 1) * pageSize < totalUsers) {
      setPageIndex(pageIndex + 1);
    }
  }, [pageIndex, pageSize, totalUsers]);

  const prevPage = useCallback(() => {
    if (pageIndex > 0) setPageIndex(pageIndex - 1);
  }, [pageIndex]);

  // ⚡ OPTIMIZED: Use SWR mutate for refresh
  const handleRefresh = useCallback(() => {
    toast.promise(Promise.all([mutateUsers(), mutateStats()]), {
      loading: "Refreshing data...",
      success: "Data refreshed successfully",
      error: "Failed to refresh data",
    });
  }, [mutateUsers, mutateStats]);

  // No client-side filtering needed - backend handles it all!
  const displayUsers = useMemo(() => {
    return Array.isArray(users) ? users : [];
  }, [users]);

  const openDeleteConfirmation = useCallback(
    (userId: string) => {
      if (!canDeleteUser) {
        toast.error("You don't have permission to delete users.");
        return;
      }
      setUserToDelete(userId);
      setOpenDeleteDialog(true);
    },
    [canDeleteUser]
  );

  const handleDeleteUser = useCallback(async () => {
    if (!userToDelete) return;
    if (!canDeleteUser) {
      toast.error("You don't have permission to delete users.");
      setOpenDeleteDialog(false);
      setUserToDelete(null);
      return;
    }
    try {
      setActionLoading(true);
      const response = await fetch(
        `/api/users?id=${userToDelete}&actorId=${currentUser?.id}`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to delete user");

      toast.success("User deleted successfully");
      setOpenDeleteDialog(false);
      setUserToDelete(null);
      await mutateUsers();
      await mutateStats();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete user");
    } finally {
      setActionLoading(false);
    }
  }, [userToDelete, canDeleteUser, currentUser?.id, mutateUsers, mutateStats]);

  return (
    <div className="p-6 space-y-6 ">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage and monitor all users in your system
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={loading}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          {/* Create User (modular) */}
          <Button
            onClick={() => {
              setEditUser(null);
              setOpenCreateDialog(true);
            }}
            className="bg-sky-600 hover:bg-sky-400"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create User
          </Button>

          {/* Create Dialog */}
          <UserFormDialog
            open={openCreateDialog}
            onOpenChange={setOpenCreateDialog}
            mode="create"
            onSuccess={async () => {
              await mutateUsers();
              await mutateStats();
            }}
          />

          {/* Edit Dialog */}
          <UserFormDialog
            open={openEditDialog}
            onOpenChange={setOpenEditDialog}
            mode="edit"
            initialUser={editUser || undefined}
            onSuccess={async () => {
              await mutateUsers();
              await mutateStats();
            }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-linear-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-100">
              Total Users
            </CardTitle>
            <div className="p-2 bg-blue-400/20 rounded-full">
              <UserCheck className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16 bg-blue-400/30" />
            ) : (
              <div className="text-3xl font-bold text-white">
                {stats?.totalUsers || 0}
              </div>
            )}
            <p className="text-xs text-blue-100 mt-1">All registered users</p>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-green-500 to-emerald-600 text-white border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-100">
              Active Users
            </CardTitle>
            <div className="p-2 bg-green-400/20 rounded-full">
              <UserCheck className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16 bg-green-400/30" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.activeUsers || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-amber-500 to-amber-600 text-white border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Inactive Users
            </CardTitle>
            <UserX className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16 bg-amber-400/30" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.inactiveUsers || 0}
              </div>
            )}
            <p className="text-xs text-amber-100 mt-1">Currently not active</p>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-purple-500 to-indigo-600 text-white border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Verified Users
            </CardTitle>
            <Mail className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16 bg-purple-400/30" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.verifiedUsers || 0}
              </div>
            )}
            <p className="text-xs text-purple-100 mt-1">Email verified</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                {/* optional: hint when search text is too short */}
                {searchTerm.trim().length > 0 && searchTerm.trim().length < 2 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    Type at least 2 characters to search
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setPageIndex(0);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={categoryFilter}
                onValueChange={(val) => {
                  setCategoryFilter(val);
                  setPageIndex(0);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {allCategories && allCategories.length > 0 ? (
                    allCategories.map((category) => (
                      <SelectItem key={category} value={category!}>
                        {category}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="none">
                      No Teams
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              <Select
                value={roleFilter}
                onValueChange={(val) => {
                  setRoleFilter(val);
                  setPageIndex(0);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles && roles.length > 0 ? (
                    roles.map((role: Role) => (
                      <SelectItem key={role.id} value={role.name}>
                        {role.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem disabled value="none">
                      No Roles
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Users Table */}
      <div className="bg-white py-6 rounded-xl border shadow">
        <Table>
          <TableHeader className="border-b-2 border-slate-300 bg-slate-100">
            <TableRow>
              <TableHead className="p-3 text-lg font-medium">Name</TableHead>
              <TableHead className="p-3 text-lg font-medium">Email</TableHead>
              <TableHead className="p-3 text-lg font-medium">Role</TableHead>
              <TableHead className="p-3 text-lg font-medium">Status</TableHead>
              <TableHead className="p-3 text-lg font-medium">Joined</TableHead>
              <TableHead
                className={`p-3 text-lg font-medium ${
                  !showActions ? "hidden" : ""
                }`}
              >
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: pageSize }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell className="p-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </TableCell>
                  <TableCell className="p-3">
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell className="p-3">
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </TableCell>
                  <TableCell className="p-3">
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="p-3">
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell className={`p-3 ${!showActions ? "hidden" : ""}`}>
                    <div className="flex gap-2">
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : displayUsers.length > 0 ? (
              displayUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="p-3 text-left truncate max-w-[250px] text-base">
                    {user.name || "N/A"}
                  </TableCell>
                  <TableCell className="p-3 text-left truncate max-w-[250px] text-base">
                    {user.email}
                  </TableCell>
                  <TableCell className="p-3 text-left truncate max-w-[250px] text-base">
                    {user.role?.name || "N/A"}
                  </TableCell>
                  <TableCell className="p-3 text-left truncate max-w-[250px] text-base">
                    {getStatusBadge(user.status)}
                  </TableCell>
                  <TableCell className="p-3 text-left truncate max-w-[250px] text-base">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className={`${!showActions ? "hidden" : ""}`}>
                    <div className="flex gap-2">
                      {canEditUser && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditUser(user);
                            setOpenEditDialog(true);
                          }}
                        >
                          Edit
                        </Button>
                      )}

                      {canViewUser && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setOpenViewDialog(true);
                          }}
                        >
                          View
                        </Button>
                      )}

                      {canDeleteUser && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => openDeleteConfirmation(user.id)}
                        >
                          Delete
                        </Button>
                      )}

                      {canImpersonate && (
                        <ImpersonateButton
                          targetUserId={user.id}
                          targetName={user.name || user.email}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between space-x-2 px-3 border-t pt-5">
          {loading ? (
            <>
              <Skeleton className="h-4 w-48" />
              <div className="flex items-center space-x-2">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-20" />
              </div>
            </>
          ) : (
            <>
              <div className="flex-1 text-sm text-muted-foreground">
                {totalUsers > 0 && (
                  <>
                    Showing {pageIndex * pageSize + 1} to{" "}
                    {Math.min((pageIndex + 1) * pageSize, totalUsers)} of{" "}
                    {totalUsers} users
                  </>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={pageIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={(pageIndex + 1) * pageSize >= totalUsers}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={openDeleteDialog} onOpenChange={setOpenDeleteDialog}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">
              Confirm Deletion
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="p-4 text-center">
            <p className="mb-4">
              Are you sure you want to delete this user? This action cannot be
              undone.
            </p>
            <div className="flex justify-center space-x-4">
              <AlertDialogCancel disabled={actionLoading}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                disabled={actionLoading || sessionLoading || !canDeleteUser}
              >
                {actionLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete
              </AlertDialogAction>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Dialog */}
      <Dialog
        open={openViewDialog && canViewUser}
        onOpenChange={setOpenViewDialog}
      >
        <DialogContent className="max-w-2xl rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
              <User className="h-6 w-6 text-primary" />
              User Details
            </DialogTitle>
          </DialogHeader>

          {selectedUser ? (
            <div className="grid gap-6 py-4">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 border-2 border-primary">
                  <AvatarImage src={selectedUser.image || "image"} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {selectedUser.name?.charAt(0) ||
                      selectedUser.email.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h3 className="text-xl font-medium">
                    {selectedUser.name ||
                      `${selectedUser.firstName || ""} ${
                        selectedUser.lastName || ""
                      }`.trim() ||
                      "Unnamed User"}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {selectedUser.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        selectedUser.status === "active"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {(selectedUser.status || "active").charAt(0).toUpperCase() +
                        (selectedUser.status || "active").slice(1)}
                    </Badge>
                    <Badge
                      variant={
                        selectedUser.emailVerified ? "default" : "outline"
                      }
                    >
                      {selectedUser.emailVerified ? "Verified" : "Unverified"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Contact
                    </Label>
                    <div className="mt-1 space-y-2">
                      {selectedUser.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>{selectedUser.phone}</span>
                        </div>
                      )}
                      {selectedUser.address && (
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <span className="text-sm">{selectedUser.address}</span>
                        </div>
                      )}
                      {selectedUser.role?.name !== "Client" &&
                        selectedUser.category && (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{selectedUser.category}</Badge>
                          </div>
                        )}
                    </div>

                    <div className="mt-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <span>Joined {formatDate(selectedUser.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                        <span>Last updated {formatDate(selectedUser.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {selectedUser.biography && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    About
                  </Label>
                  <div className="mt-2 p-4 bg-muted/50 rounded-lg">
                    <p className="whitespace-pre-wrap text-sm">
                      {selectedUser.biography}
                    </p>
                  </div>
                </div>
              )}

              {canImpersonate && (
                <div className="flex justify-end">
                  <ImpersonateButton
                    targetUserId={selectedUser.id}
                    targetName={selectedUser.name || selectedUser.email}
                    className="bg-sky-600 hover:bg-sky-700 text-white"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
