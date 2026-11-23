// lib/posting-schedule.ts
// Server-side posting cycle helpers. Pure logic lives in ./posting-cycle (client-safe).
import prisma from "@/lib/prisma";
import {
  EVERY_MONTH,
  POSTING_INTERVAL_FIELD,
  POSTING_OFFSET_FIELD,
  SETTING_INTERVAL_FIELD,
  SETTING_OFFSET_FIELD,
  resolvePostingCycle,
  type PostingCycle,
} from "./posting-cycle";

export * from "./posting-cycle";

/**
 * Loads cycles for many template assets in one query (+ optional per-assignment
 * overrides). Missing ids resolve to EVERY_MONTH.
 */
export async function loadPostingCycles(
  templateSiteAssetIds: Array<number | null | undefined>,
  assignmentId?: string | null
): Promise<Map<number, PostingCycle>> {
  const ids = Array.from(
    new Set(templateSiteAssetIds.filter((id): id is number => typeof id === "number"))
  );
  const map = new Map<number, PostingCycle>();
  if (!ids.length) return map;

  const [assets, settings] = await Promise.all([
    prisma.templateSiteAsset.findMany({
      where: { id: { in: ids } },
      select: { id: true, [POSTING_INTERVAL_FIELD]: true, [POSTING_OFFSET_FIELD]: true } as any,
    }),
    assignmentId
      ? prisma.assignmentSiteAssetSetting.findMany({
          where: { assignmentId, templateSiteAssetId: { in: ids } },
          select: {
            templateSiteAssetId: true,
            [SETTING_INTERVAL_FIELD]: true,
            [SETTING_OFFSET_FIELD]: true,
          } as any,
        })
      : Promise.resolve([] as any[]),
  ]);

  const settingById = new Map<number, any>(
    (settings as any[]).map((s) => [s.templateSiteAssetId, s])
  );
  for (const a of assets as any[]) {
    map.set(a.id, resolvePostingCycle(a, settingById.get(a.id)));
  }
  return map;
}

export function cycleFor(
  map: Map<number, PostingCycle>,
  assetId: number | null | undefined
): PostingCycle {
  return (typeof assetId === "number" && map.get(assetId)) || EVERY_MONTH;
}
