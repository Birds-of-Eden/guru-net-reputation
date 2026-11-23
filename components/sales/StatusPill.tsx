import { cn } from "@/lib/utils";

export function StatusPill({
  status,
}: {
  status: "active" | "expired" | "upcoming" | "unknown";
}) {
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    expired: "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    upcoming: "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    unknown: "bg-slate-50 text-slate-700 border border-slate-200 dark:bg-muted/40 dark:text-foreground dark:border-border",
  };

  return (
    <span
      className={cn(
        "text-[11px] font-medium px-2.5 py-1.5 rounded-full capitalize tracking-wide",
        styles[status]
      )}
    >
      {status}
    </span>
  );
}
