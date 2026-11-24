// components/clients/clientsID/template-customization/asset-card.tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Link as LinkIcon, Zap } from "lucide-react";
import { postingCycleLabel, resolvePostingCycle } from "@/lib/posting-cycle";
import { cn } from "@/lib/utils";

/** Shared column layout so the header row and asset rows line up. */
export const ASSET_ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,1fr)_88px_180px_80px] sm:items-center";

/** Effective per-client values for an asset (client override wins over template default). */
export function resolveAssetValues(asset: any, setting?: any) {
  const frequency = setting?.requiredFrequency ?? asset.defaultPostingFrequency ?? 0;
  const hasOverride =
    setting?.requiredFrequency != null &&
    setting.requiredFrequency !== asset.defaultPostingFrequency;
  return {
    frequency,
    hasOverride,
    cycle: resolvePostingCycle(asset as any, setting as any),
    duration: setting?.idealDurationMinutes ?? asset.defaultIdealDurationMinutes ?? 0,
  };
}

/** Column headings shown above a group's rows (desktop only). */
export function AssetRowHeader() {
  return (
    <div
      className={cn(
        ASSET_ROW_GRID,
        "hidden border-b bg-muted/30 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid"
      )}
    >
      <span>Asset</span>
      <span className="text-right">Posts / mo</span>
      <span>Cycle</span>
      <span className="text-right">Time</span>
    </div>
  );
}

interface AssetRowProps {
  asset: any;
  setting?: any;
  index: number;
}

/** One row in a template asset group. */
export function AssetRow({ asset, setting, index }: AssetRowProps) {
  const { frequency, hasOverride, cycle, duration } = resolveAssetValues(asset, setting);

  return (
    <div className={cn(ASSET_ROW_GRID, "px-4 py-3 transition-colors hover:bg-muted/40")}>
      {/* Name + meta */}
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[11px] font-medium tabular-nums text-muted-foreground">
          {index + 1}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{asset.name}</span>
            {asset.isRequired && (
              <Badge variant="outline" className="h-5 px-1.5 text-[11px] font-normal text-muted-foreground">
                Required
              </Badge>
            )}
          </div>
          {(asset.description || asset.url) && (
            <div className="mt-0.5 flex min-w-0 flex-col gap-0.5 text-xs text-muted-foreground">
              {asset.url && (
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                >
                  <LinkIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{asset.url.replace(/^https?:\/\//, "")}</span>
                </a>
              )}
              {asset.description && <span className="line-clamp-1">{asset.description}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Posts per month */}
      <span
        className={cn(
          "inline-flex items-center justify-end gap-1 text-sm tabular-nums",
          hasOverride && "text-amber-700 dark:text-amber-400"
        )}
        title={
          hasOverride
            ? `Client override (template default: ${asset.defaultPostingFrequency}/month)`
            : "Template default"
        }
      >
        {hasOverride && <Zap className="h-3.5 w-3.5" />}
        <span className="font-semibold">{frequency > 0 ? frequency : "—"}</span>
        <span className="text-muted-foreground sm:hidden">/mo</span>
      </span>

      {/* Cycle + time: own columns on desktop, one meta line on mobile */}
      <span className="col-span-2 text-xs text-muted-foreground sm:col-span-1 sm:text-sm">
        {frequency > 0 ? postingCycleLabel(cycle) : "—"}
        <span className="sm:hidden"> · {duration > 0 ? `${duration} min` : "—"}</span>
      </span>
      <span className="hidden text-right text-sm tabular-nums text-muted-foreground sm:block">
        {duration > 0 ? `${duration} min` : "—"}
      </span>
    </div>
  );
}
