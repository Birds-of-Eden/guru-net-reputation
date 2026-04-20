import { Skeleton } from "@/components/ui/skeleton";

export function CustomJobFormSkeleton() {
  return (
    <div className="mx-auto w-full rounded-3xl border border-purple-200 bg-linear-to-br from-slate-50 via-sky-50 to-fuchsia-50 p-6 shadow-2xl md:p-8">
      {/* Title Section Skeleton */}
      <div className="space-y-2 mb-6">
        <Skeleton className="h-8 w-64 bg-slate-200" />
        <Skeleton className="h-4 w-96 bg-slate-200" />
      </div>

      {/* Form Skeleton */}
      <div className="space-y-6">
        {/* Grid of 3 fields (Date, Client, Priority) */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16 bg-slate-200" />
            <Skeleton className="h-10 w-full rounded-md bg-slate-200" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16 bg-slate-200" />
            <Skeleton className="h-10 w-full rounded-md bg-slate-200" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16 bg-slate-200" />
            <Skeleton className="h-10 w-full rounded-md bg-slate-200" />
          </div>
        </div>

        {/* Task field (TinyMCE - tall) */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16 bg-slate-200" />
          <Skeleton className="h-[440px] w-full rounded-md bg-slate-200" />
        </div>

        {/* Notes field (textarea) */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16 bg-slate-200" />
          <Skeleton className="h-[120px] w-full rounded-md bg-slate-200" />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Skeleton className="h-10 w-24 rounded-md bg-slate-200" />
          <Skeleton className="h-10 w-24 rounded-md bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
