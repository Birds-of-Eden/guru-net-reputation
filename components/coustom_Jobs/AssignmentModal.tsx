"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  UserCheck,
  Clock,
  Sparkles,
  Mail,
  ShieldCheck,
  TimerReset,
  Check,
  History,
} from "lucide-react";

type UserOption = {
  id: string;
  name: string;
  email?: string;
  category?: string;
  image?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onAssign: (agentId: string, idealDurationMinutes?: number) => void;
  agents: UserOption[];
  preferredAgentId?: string | null;
  taskName?: string;
  taskPriority?: string;
};

export default function AssignmentModal({
  open,
  onClose,
  onAssign,
  agents,
  preferredAgentId,
  taskName,
  taskPriority,
}: Props) {
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [idealDurationMinutes, setIdealDurationMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId),
    [agents, selectedAgentId]
  );

  const visibleAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    const withScore = agents.map((a) => {
      const isPreferred = !!preferredAgentId && a.id === preferredAgentId;
      if (!q) {
        return {
          agent: a,
          score: isPreferred ? 1000 : 0,
          isPreferred,
        };
      }

      const hay = `${a.name ?? ""} ${a.email ?? ""} ${a.category ?? ""}`
        .trim()
        .toLowerCase();
      if (!hay.includes(q)) return { agent: a, score: -1, isPreferred };

      let score = 0;
      // Exact match on name
      if (a.name?.toLowerCase() === q) score = 100;
      // Starts with name
      else if (a.name?.toLowerCase().startsWith(q)) score = 80;
      // Starts with email
      else if (a.email?.toLowerCase().startsWith(q)) score = 75;
      // Contains in name
      else if (a.name?.toLowerCase().includes(q)) score = 60;
      // Contains in email
      else if (a.email?.toLowerCase().includes(q)) score = 50;
      // Contains in category
      else if (a.category?.toLowerCase().includes(q)) score = 40;
      // General contains
      else score = 20;

      if (isPreferred) score += 500;

      return { agent: a, score, isPreferred };
    });

    const filtered = withScore.filter((item) => item.score >= 0);
    filtered.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.agent.name.localeCompare(b.agent.name);
    });

    return filtered.map((item) => item.agent);
  }, [agentSearch, agents, preferredAgentId]);

  if (!open) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedAgentId) return;

    setLoading(true);
    try {
      await onAssign(selectedAgentId, idealDurationMinutes);
      onClose();
      setSelectedAgentId("");
      setIdealDurationMinutes(30);
    } catch (error) {
      console.error(error);
      alert("Failed to assign task");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
      setSelectedAgentId("");
      setIdealDurationMinutes(30);
      setAgentSearch("");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getPriorityStyles = (priority?: string) => {
    switch (priority) {
      case "urgent":
        return "border-red-200 bg-red-500/10 text-red-700 dark:border-red-800 dark:bg-red-500/20 dark:text-red-300";
      case "high":
        return "border-orange-200 bg-orange-500/10 text-orange-700 dark:border-orange-800 dark:bg-orange-500/20 dark:text-orange-300";
      case "medium":
        return "border-yellow-200 bg-yellow-500/10 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300";
      default:
        return "border-emerald-200 bg-emerald-500/10 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl overflow-hidden border-0 bg-transparent p-0 shadow-none">
        <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl dark:bg-slate-950">
          <div className="absolute inset-0 bg-[radial-linear(circle_at_top_left,rgba(59,130,246,0.18),transparent_30%),radial-linear(circle_at_top_right,rgba(236,72,153,0.18),transparent_30%),radial-linear(circle_at_bottom,rgba(34,197,94,0.18),transparent_35%)]" />
          <div className="absolute -left-20 top-10 h-40 w-40 rounded-full bg-pink-500/20 blur-3xl" />
          <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-emerald-500/20 blur-3xl" />

          <div className="relative z-10 max-h-[85vh] overflow-y-auto p-6 md:p-8">
            <DialogHeader className="mb-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700 dark:border-violet-800 dark:bg-violet-500/20 dark:text-violet-300">
                    <Sparkles className="h-3.5 w-3.5" />
                    Smart Assignment Panel
                  </div>

                  <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-white">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 via-fuchsia-500 to-pink-500 text-white shadow-lg">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    Assign Task to Agent
                  </DialogTitle>

                  <DialogDescription className="text-sm text-slate-600 dark:text-slate-300">
                    Choose the best agent and set an ideal completion duration for
                    this task.
                  </DialogDescription>
                </div>

                {taskPriority && (
                  <div
                    className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getPriorityStyles(
                      taskPriority
                    )}`}
                  >
                    {taskPriority} priority
                  </div>
                )}
              </div>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-sky-500 to-cyan-500 text-white">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <Label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Select Agent
                  </Label>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950">
                  <Command shouldFilter={false} className="bg-transparent">
                    <CommandInput
                      value={agentSearch}
                      onValueChange={setAgentSearch}
                      placeholder="Search agent by name, email, or role..."
                      className="h-14"
                    />
                    <CommandList className="max-h-72">
                      <CommandEmpty>No agent found.</CommandEmpty>
                      <CommandGroup>
                        {visibleAgents.map((agent) => {
                          const isSelected = selectedAgentId === agent.id;
                          const isPreferred = preferredAgentId === agent.id;

                          return (
                            <CommandItem
                              key={agent.id}
                              value={`${agent.name} ${agent.email ?? ""} ${agent.category ?? ""}`}
                              onSelect={() => setSelectedAgentId(agent.id)}
                              className="mx-2 my-1 rounded-xl px-3 py-3"
                            >
                              <div className="flex w-full items-center gap-3">
                                <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                  <AvatarImage src={agent.image || undefined} />
                                  <AvatarFallback className="bg-linear-to-br from-violet-500 to-pink-500 text-xs font-bold text-white">
                                    {getInitials(agent.name)}
                                  </AvatarFallback>
                                </Avatar>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                                      {agent.name}
                                    </span>
                                    {isPreferred && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                                        <History className="h-3 w-3" />
                                        Last assigned
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    {agent.email ? (
                                      <span className="truncate">{agent.email}</span>
                                    ) : null}
                                    {agent.category ? (
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                                        {agent.category}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>

                                {isSelected && (
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500 text-white">
                                    <Check className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              </div>

              {selectedAgent && (
                <div className="relative overflow-hidden rounded-2xl border border-violet-200 bg-linear-to-r from-violet-500/10 via-fuchsia-500/10 to-sky-500/10 p-5 shadow-sm dark:border-violet-900">
                  <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-violet-500/10 blur-2xl" />
                  <div className="relative flex items-start gap-4">
                    <Avatar className="h-14 w-14 border-4 border-white shadow-md dark:border-slate-900">
                      <AvatarImage src={selectedAgent.image || undefined} />
                      <AvatarFallback className="bg-linear-to-br from-violet-500 via-fuchsia-500 to-pink-500 font-bold text-white">
                        {getInitials(selectedAgent.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {selectedAgent.name}
                      </h3>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedAgent.category && (
                          <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-900/70 dark:text-slate-200">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                            {selectedAgent.category}
                          </div>
                        )}

                        {selectedAgent.email && (
                          <div className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm dark:bg-slate-900/70 dark:text-slate-200">
                            <Mail className="h-3.5 w-3.5 text-sky-500" />
                            {selectedAgent.email}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-500 text-white">
                    <Clock className="h-4 w-4" />
                  </div>
                  <Label
                    htmlFor="duration"
                    className="text-sm font-semibold text-slate-800 dark:text-slate-100"
                  >
                    Ideal Duration (minutes)
                  </Label>
                </div>

                <Input
                  id="duration"
                  type="number"
                  value={idealDurationMinutes}
                  onChange={(e) =>
                    setIdealDurationMinutes(Number(e.target.value))
                  }
                  min="1"
                  required
                  className="h-14 rounded-2xl border-slate-200 bg-white text-base shadow-sm focus:ring-2 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-950"
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  {[15, 30, 45, 60, 90].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setIdealDurationMinutes(time)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                        idealDurationMinutes === time
                          ? "bg-linear-to-r from-amber-500 to-orange-500 text-white shadow-md"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      }`}
                    >
                      {time} min
                    </button>
                  ))}
                </div>
              </div>

              <DialogFooter className="mt-2 flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                  className="h-12 rounded-2xl border-slate-300 bg-white px-6 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <TimerReset className="mr-2 h-4 w-4" />
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={!selectedAgentId || loading}
                  className="h-12 rounded-2xl bg-linear-to-r from-violet-600 via-fuchsia-600 to-pink-600 px-6 font-semibold text-white shadow-lg transition hover:from-violet-700 hover:via-fuchsia-700 hover:to-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Assigning..." : "Assign Task"}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
