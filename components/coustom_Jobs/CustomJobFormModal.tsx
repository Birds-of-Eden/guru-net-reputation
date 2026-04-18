// ================================
// FILE: components/custom-jobs/CustomJobFormModal.tsx
// ================================
"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CustomJob, ClientOption } from "./customJobsTypes";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CheckIcon, ChevronsUpDown } from "lucide-react";

const priorities = ["low", "medium", "high", "urgent"] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingJob?: CustomJob | null;
  clients: ClientOption[];
  isAM?: boolean;
};

function normalizeText(value: string | undefined | null) {
  return (value || "").trim().toLowerCase();
}

function getClientSearchRank(client: ClientOption, search: string) {
  const q = normalizeText(search);
  const name = normalizeText(client.name);
  const company = normalizeText(client.company);

  if (!q) {
    return {
      matched: true,
      bucket: 999,
      index: 999,
      text: name,
    };
  }

  if (name.startsWith(q)) {
    return {
      matched: true,
      bucket: 0,
      index: name.indexOf(q),
      text: name,
    };
  }

  if (company.startsWith(q)) {
    return {
      matched: true,
      bucket: 1,
      index: company.indexOf(q),
      text: company,
    };
  }

  const nameIndex = name.indexOf(q);
  if (nameIndex !== -1) {
    return {
      matched: true,
      bucket: 2,
      index: nameIndex,
      text: name,
    };
  }

  const companyIndex = company.indexOf(q);
  if (companyIndex !== -1) {
    return {
      matched: true,
      bucket: 3,
      index: companyIndex,
      text: company,
    };
  }

  return {
    matched: false,
    bucket: 9999,
    index: 9999,
    text: name,
  };
}

export default function CustomJobFormModal({
  open,
  onClose,
  onSuccess,
  editingJob,
  clients,
  isAM,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const [form, setForm] = useState({
    date: "",
    clientId: "",
    name: "",
    priority: "medium",
    notes: "",
  });

  const filteredClients = useMemo(() => {
    const ranked = clients
      .map((client) => {
        const rank = getClientSearchRank(client, clientSearch);
        return { client, rank };
      })
      .filter((item) => item.rank.matched);

    ranked.sort((a, b) => {
      if (a.rank.bucket !== b.rank.bucket) {
        return a.rank.bucket - b.rank.bucket;
      }

      if (a.rank.index !== b.rank.index) {
        return a.rank.index - b.rank.index;
      }

      return normalizeText(a.client.name).localeCompare(
        normalizeText(b.client.name),
        undefined,
        { sensitivity: "base" },
      );
    });

    return ranked.map((item) => item.client);
  }, [clients, clientSearch]);

  useEffect(() => {
    if (editingJob) {
      setForm({
        date: editingJob.date
          ? new Date(editingJob.date).toISOString().slice(0, 10)
          : "",
        clientId: editingJob.clientId || "",
        name: editingJob.name || "",
        priority: editingJob.priority || "medium",
        notes: editingJob.notes || "",
      });
    } else {
      setForm({
        date: "",
        clientId: "",
        name: "",
        priority: "medium",
        notes: "",
      });
    }
  }, [editingJob, open]);

  if (!open) return null;

  const selectedClient = clients.find((c) => c.id === form.clientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingJob
        ? `/api/custom-jobs/${editingJob.id}`
        : "/api/custom-jobs";
      const method = editingJob ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Something went wrong");
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setClientSearch("");
          setPopoverOpen(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[95vh] max-w-6xl overflow-y-auto bg-linear-to-br from-slate-50 via-sky-50 to-fuchsia-50 border border-purple-200 shadow-2xl">
        <DialogHeader className="space-y-2">
          <DialogTitle className="bg-linear-to-r from-indigo-600 via-fuchsia-600 to-sky-600 bg-clip-text text-transparent text-2xl font-bold">
            {editingJob ? "Edit Custom Job" : "Create Custom Job"}
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            {editingJob
              ? "Update the custom job details below"
              : "Fill in the details to create a new custom job"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date" className="text-indigo-700 font-semibold">
                Date
              </Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, date: e.target.value }))
                }
                className="border-indigo-200 bg-white/70 focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client" className="text-sky-700 font-semibold">
                Client
              </Label>
              <Popover
                open={popoverOpen}
                onOpenChange={(nextOpen) => {
                  setPopoverOpen(nextOpen);
                  if (!nextOpen) {
                    setClientSearch("");
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    id="client"
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between border-sky-200 bg-white/70 hover:bg-sky-50 hover:border-sky-400"
                  >
                    <span className="truncate">
                      {selectedClient?.name || "Select client"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent align="start" className="w-[320px] p-0">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search client..."
                      value={clientSearch}
                      onValueChange={setClientSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No client found.</CommandEmpty>
                      <CommandGroup>
                        {filteredClients.map((client) => {
                          const itemValue = `${client.name} ${client.company || ""}`;

                          return (
                            <CommandItem
                              key={client.id}
                              value={itemValue}
                              onSelect={() => {
                                setForm((prev) => ({
                                  ...prev,
                                  clientId: client.id,
                                }));
                                setPopoverOpen(false);
                                setClientSearch("");
                              }}
                            >
                              <CheckIcon
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  form.clientId === client.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              <span className="truncate">
                                {client.name}
                                {client.company ? ` (${client.company})` : ""}
                              </span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="priority"
                className="text-fuchsia-700 font-semibold"
              >
                Priority
              </Label>
              <Select
                value={form.priority}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger
                  id="priority"
                  className="border-fuchsia-200 bg-white/70 focus:border-fuchsia-500 focus:ring-fuchsia-500"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item.charAt(0).toUpperCase() + item.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task" className="text-emerald-700 font-semibold">
              Task
            </Label>
            <Textarea
              id="task"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Write custom task details"
              className="min-h-[140px] resize-y overflow-auto [field-sizing:fixed] border-emerald-200 bg-white/70 focus:border-emerald-500 focus:ring-emerald-500"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-orange-700 font-semibold">
              Notes
            </Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, notes: e.target.value }))
              }
              className="min-h-[100px] resize-y overflow-auto [field-sizing:fixed] border-orange-200 bg-white/70 focus:border-orange-500 focus:ring-orange-500"
            />
          </div>

          <DialogFooter className="gap-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              className="border border-red-200 bg-white/70 backdrop-blur-md text-red-600 hover:bg-red-50 hover:border-red-400 hover:text-red-700 shadow-sm hover:shadow-md transition-all duration-200 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-linear-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold shadow-md hover:shadow-xl transition-all duration-200 rounded-xl"
            >
              {loading ? "Saving..." : editingJob ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
