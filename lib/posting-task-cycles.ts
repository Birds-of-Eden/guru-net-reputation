import type { Task } from "@/components/task-distribution/distribution-types";

type CycleGroup = {
  cycle: number;
  label: string;
  baseName: string;
  tasks: Task[];
  isManual?: boolean;
};

const extractCycleInfo = (taskName: string) => {
  // Check if this is a Manual task first
  const isManualTask = taskName.toLowerCase().startsWith('manual');
  
  // Handle various patterns: "Task -1", "manual task -1", "SlideShare Task -55", etc.
  const match = taskName.match(/^(.+?)\s*-\s*(\d+)$/);
  if (match) {
    return {
      baseName: match[1].trim(),
      cycle: parseInt(match[2], 10),
      cycleLabel: `-${match[2]}`,
      isManual: isManualTask,
    };
  }
  return { 
    baseName: taskName, 
    cycle: 0, 
    cycleLabel: "",
    isManual: isManualTask,
  };
};

/** Local calendar day of a due date ("YYYY-MM-DD"), or null. */
const dueDayKey = (dueDate: unknown): string | null => {
  if (!dueDate) return null;
  const d = new Date(dueDate as string);
  if (!Number.isFinite(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

/**
 * Groups numbered tasks ("Medium Task -5") into cycles BY DUE DATE, not by the
 * "-N" in the name.
 *
 * Why: with Posting Cycles (alternate months etc.) sites skip periods, so their
 * numbers drift apart - "Medium Task -5" (4 Jan) and "Tumblr Task -5" (2 Feb)
 * are different periods. Grouping by "-N" mixed them into one cycle. Tasks due
 * on the same day form one cycle instead, numbered 1, 2, 3... in date order.
 *
 * Tasks without a due date fall back to grouping by "-N". Manual tasks keep
 * their own groups.
 */
export const groupTasksByCycle = (tasks: Task[]): CycleGroup[] => {
  type Entry = { task: Task; info: ReturnType<typeof extractCycleInfo>; day: string | null };
  const entries: Entry[] = tasks.map((task) => ({
    task,
    info: extractCycleInfo(task.name),
    day: dueDayKey((task as any).dueDate),
  }));

  const manualGroups: Record<string, CycleGroup> = {};
  const fallbackGroups: Record<string, CycleGroup> = {}; // numbered, no due date / unnumbered
  // One display cycle per due day, including repeated tasks from the same site.
  const daySlots = new Map<string, { tasks: Task[] }[]>();

  const dated = entries
    .filter((e) => !e.info.isManual && e.info.cycle > 0 && e.day)
    .sort((a, b) => (a.day! < b.day! ? -1 : a.day! > b.day! ? 1 : a.info.cycle - b.info.cycle));

  for (const e of dated) {
    const slots = daySlots.get(e.day!) ?? [];
    if (!daySlots.has(e.day!)) daySlots.set(e.day!, slots);
    let slot = slots[0];
    if (!slot) {
      slot = { tasks: [] };
      slots.push(slot);
    }
    slot.tasks.push(e.task);
  }

  for (const e of entries) {
    if (e.info.isManual) {
      const key = `manual_${e.info.cycleLabel || "nocycle"}`;
      manualGroups[key] ??= {
        cycle: e.info.cycle,
        label: e.info.cycleLabel,
        baseName: e.info.baseName,
        tasks: [],
        isManual: true,
      };
      manualGroups[key].tasks.push(e.task);
    } else if (!(e.info.cycle > 0 && e.day)) {
      const key = e.info.cycleLabel || "_nocycle";
      fallbackGroups[key] ??= {
        cycle: e.info.cycle,
        label: e.info.cycleLabel,
        baseName: e.info.baseName,
        tasks: [],
      };
      fallbackGroups[key].tasks.push(e.task);
    }
  }

  // Dated cycles, numbered by date
  const datedGroups: CycleGroup[] = [];
  const days = Array.from(daySlots.keys()).sort();
  for (const day of days) {
    for (const slot of daySlots.get(day)!) {
      const n = datedGroups.length + 1;
      datedGroups.push({
        cycle: n,
        label: `-${n}`,
        baseName: extractCycleInfo(slot.tasks[0].name).baseName,
        tasks: slot.tasks.sort((a, b) => a.name.localeCompare(b.name)),
      });
    }
  }

  // Undated numbered tasks continue the numbering after the dated cycles
  const undated = Object.values(fallbackGroups)
    .filter((g) => g.cycle > 0)
    .sort((a, b) => a.cycle - b.cycle)
    .map((g, i) => {
      const n = datedGroups.length + i + 1;
      return { ...g, cycle: n, label: `-${n}` };
    });
  const unnumbered = Object.values(fallbackGroups).filter((g) => !(g.cycle > 0));

  const manual = Object.values(manualGroups).sort((a, b) => {
    if (a.cycle === 0) return 1;
    if (b.cycle === 0) return -1;
    return a.cycle - b.cycle;
  });

  // Manual first, then cycles in date order, then anything without a number
  return [...manual, ...datedGroups, ...undated, ...unnumbered];
};

