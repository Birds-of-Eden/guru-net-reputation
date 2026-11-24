// @ts-nocheck
// components/clients/clientsID/template-management.tsx
"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Layers,
  RefreshCw,
  Pencil,
  ArrowLeftRight,
  Lock,
  AlertCircle,
  PackageOpen,
} from "lucide-react";
import { Client } from "@/types/client";
import { CustomizeTemplateDialog } from "./template-customization/customize-dialog";
import { SwitchTemplateDialog } from "./template-customization/switch-template-dialog";
import {
  AssetRow,
  AssetRowHeader,
  resolveAssetValues,
} from "./template-customization/asset-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CustomizationHistory } from "./template-customization/customization-history";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { useTemplateManagement } from "@/lib/hooks/use-template-management";
import { formatAssetTypeLabel } from "@/lib/asset-types";
import { toast } from "sonner";

interface TemplateManagementProps {
  clientData: Client;
  onUpdate?: () => void;
}

function TemplateManagementSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </Card>
      <Card className="p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </Card>
    </div>
  );
}

function StateCard({
  tone,
  title,
  text,
}: {
  tone: "error" | "warning";
  title: string;
  text: string;
}) {
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-5 ${styles}`}>
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm opacity-90">{text}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function TemplateManagement({ clientData, onUpdate }: TemplateManagementProps) {
  const { user } = useUserSession();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  // null = every group open (default); otherwise the groups the user has open
  const [openGroups, setOpenGroups] = useState<string[] | null>(null);

  const { assignment, templateData, stats, isLoading, error, refresh } =
    useTemplateManagement({
      clientId: clientData.id,
      enableCache: true,
    });

  const roleName = (user as any)?.role?.name ?? (user as any)?.role ?? "";
  const isClient = String(roleName).toLowerCase() === "client";
  const isAgent = String(roleName).toLowerCase() === "agent";
  const canManage = !isClient && !isAgent; // AM, Manager, Admin can manage

  const handleRefresh = () => {
    refresh();
    onUpdate?.();
  };

  const handleCustomizeSuccess = () => {
    toast.success("Template customized successfully!");
    handleRefresh();
    setCustomizeOpen(false);
  };

  const handleSwitchSuccess = () => {
    toast.success("Template switched successfully!");
    handleRefresh();
    setSwitchOpen(false);
  };

  if (isLoading) return <TemplateManagementSkeleton />;

  if (error) {
    return <StateCard tone="error" title="Couldn't load template" text={error} />;
  }

  if (!assignment || !templateData) {
    return (
      <StateCard
        tone="warning"
        title="No template assigned"
        text="This client doesn't have an assignment or template configured yet."
      />
    );
  }

  const isCustomTemplate =
    templateData.name?.includes("Custom") ||
    templateData.description?.includes("cloned");

  const { totalAssets, customOverrides, teamMembers, assetsByType } = stats;
  const assets: any[] = templateData.sitesAssets ?? [];

  const settingFor = (assetId: number) =>
    assignment.siteAssetSettings?.find((s: any) => s.templateSiteAssetId === assetId);

  // One accordion group per asset type, with a small summary for its header
  const groups = Object.keys(assetsByType).map((type) => {
    const items = assets.filter((a: any) => (a.type || "other") === type);
    let postsPerMonth = 0;
    let overrides = 0;
    let required = 0;
    for (const a of items) {
      const v = resolveAssetValues(a, settingFor(a.id));
      postsPerMonth += v.frequency;
      if (v.hasOverride) overrides++;
      if (a.isRequired) required++;
    }
    return { type, items, postsPerMonth, overrides, required };
  });
  const allGroupIds = groups.map((g) => g.type);
  const expanded = openGroups ?? allGroupIds;
  const allExpanded = expanded.length === allGroupIds.length;

  return (
    <div className="space-y-4">
      {/* Overview */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              Current template
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{templateData.name}</h2>
              <Badge
                variant="outline"
                className={
                  isCustomTemplate
                    ? "border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                    : "text-muted-foreground"
                }
              >
                {isCustomTemplate ? "Custom for this client" : "Shared template"}
              </Badge>
            </div>
            {templateData.description && (
              <p className="text-sm text-muted-foreground">{templateData.description}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {canManage && (
              <>
                <Button variant="outline" size="sm" onClick={() => setSwitchOpen(true)} className="gap-2">
                  <ArrowLeftRight className="h-4 w-4" />
                  Switch
                </Button>
                <Button size="sm" onClick={() => setCustomizeOpen(true)} className="gap-2">
                  <Pencil className="h-4 w-4" />
                  Customize
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              aria-label="Refresh"
              title="Refresh"
              className="h-8 w-8"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Assets" value={totalAssets} />
          <Stat label="Client overrides" value={customOverrides} />
          <Stat label="Team members" value={teamMembers} />
          <Stat
            label="Last modified"
            value={
              <span className="text-sm">
                {templateData.updatedAt
                  ? new Date(templateData.updatedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            }
          />
        </div>

        {!canManage ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            {isClient ? "Clients" : "Agents"} can view this template but can't change it.
          </p>
        ) : (
          !isCustomTemplate && (
            <p className="mt-4 text-sm text-muted-foreground">
              This template is shared with other clients. Use{" "}
              <span className="font-medium text-foreground">Customize</span> to make changes just
              for {clientData.name}.
            </p>
          )
        )}
      </Card>

      {/* Assets */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
          <div>
            <h3 className="font-semibold">
              Assets <span className="font-normal text-muted-foreground">({totalAssets})</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              {groups.length} {groups.length === 1 ? "type" : "types"}
              {customOverrides > 0 && (
                <span className="text-amber-700 dark:text-amber-400">
                  {" "}· amber values are client overrides
                </span>
              )}
            </p>
          </div>
          {groups.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpenGroups(allExpanded ? [] : allGroupIds)}
              className="h-8 text-xs text-muted-foreground"
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </Button>
          )}
        </div>

        {assets.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">
              <PackageOpen className="h-5 w-5" />
            </div>
            <p className="font-medium">No assets in this template</p>
            {canManage && (
              <p className="mt-1 text-sm text-muted-foreground">
                Use Customize to add assets for this client.
              </p>
            )}
          </div>
        ) : (
          <Accordion
            type="multiple"
            value={expanded}
            onValueChange={setOpenGroups}
            className="space-y-3 p-4"
          >
            {groups.map((g) => (
              <AccordionItem
                key={g.type}
                value={g.type}
                className="overflow-hidden rounded-lg border last:border-b"
              >
                <AccordionTrigger className="items-center rounded-none bg-muted/40 px-4 py-3 hover:bg-muted/70 hover:no-underline data-[state=open]:border-b">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold">{formatAssetTypeLabel(g.type)}</span>
                    <Badge variant="secondary" className="h-5 px-1.5 tabular-nums">
                      {g.items.length}
                    </Badge>
                    <span className="text-xs font-normal text-muted-foreground">
                      {g.postsPerMonth} posts/mo
                      {g.required > 0 && ` · ${g.required} required`}
                    </span>
                    {g.overrides > 0 && (
                      <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
                        {g.overrides} override{g.overrides === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-0">
                  <AssetRowHeader />
                  <div className="divide-y">
                    {g.items.map((asset: any, i: number) => (
                      <AssetRow
                        key={asset.id}
                        asset={asset}
                        setting={settingFor(asset.id)}
                        index={i}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </Card>

      <CustomizationHistory assignmentId={assignment.id} clientName={clientData.name} />

      <CustomizeTemplateDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        assignment={assignment}
        currentTemplate={templateData}
        clientName={clientData.name}
        onSuccess={handleCustomizeSuccess}
      />

      <SwitchTemplateDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        assignment={assignment}
        currentTemplate={templateData}
        clientName={clientData.name}
        onSuccess={handleSwitchSuccess}
      />
    </div>
  );
}
