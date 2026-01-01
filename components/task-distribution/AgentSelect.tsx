// app/components/task-distribution/AgentSelect.tsx

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getLoadStats } from "./load-utils";

type AgentBase = {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  image?: string | null;
  // page.tsx / TaskTabs.tsx থেকে আসা extra fields:
  displayLabel?: string;
  activeCount?: number;
  weightedScore?: number;
  byStatus?: Record<string, number>;
};

function displayName(a: AgentBase) {
  return (
    a.name ||
    `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim() ||
    a.email ||
    "Agent"
  );
}
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "A";
}

export function AgentSelect({
  agents,
  value,
  onChange,
  className,
}: {
  agents: AgentBase[];
  value?: string;
  onChange: (agentId: string) => void;
  className?: string;
}) {
  const selected = agents.find((a) => a.id === value);
  const selName = selected ? displayName(selected) : "";
  const selectedStats = selected ? getLoadStats(selected) : null;
  const selText =
    selected?.displayLabel ??
    (selected
      ? `${selName} — ${selectedStats?.active ?? 0} active • W:${
          selectedStats?.weighted ?? 0
        }`
      : "Choose agent…");

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className ?? "h-8 w-[260px] justify-between"}>
        {/* Trigger-এ কাস্টম প্রিভিউ: নাম + workload */}
        <div className="flex items-center gap-2 truncate">
          {selected ? (
            <>
              <Avatar className="h-5 w-5">
                <AvatarImage src={selected.image ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {initials(selName)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm">{selText}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Choose agent…</span>
          )}
        </div>
      </SelectTrigger>

      <SelectContent className="w-[360px]">
        {agents.map((a) => {
          const name = displayName(a);
          const { P, IP, O, R, active, weighted } = getLoadStats(a);

          // Radix Select নির্বাচিত টেক্সট পড়তে child text লাগে; screen-reader-only লাইন দিলাম:
          const plain =
            a.displayLabel ??
            `${name} — ${active} active (P:${P} | IP:${IP} | O:${O} | R:${R}) • W:${weighted}`;

          return (
            <SelectItem key={a.id} value={a.id} className="py-2">
              <span className="sr-only">{plain}</span>
              <div className="flex items-center gap-3">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={a.image ?? undefined} />
                  <AvatarFallback>{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <div className="text-sm font-medium leading-5">{name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="mr-2">{active} active</span>
                    <span className="mr-2">W:{weighted}</span>
                    <span className="inline-flex gap-1 align-middle">
                      <Badge variant="outline">P:{P}</Badge>
                      <Badge variant="outline">IP:{IP}</Badge>
                      <Badge variant="outline">O:{O}</Badge>
                      <Badge variant="outline">R:{R}</Badge>
                    </span>
                  </div>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
