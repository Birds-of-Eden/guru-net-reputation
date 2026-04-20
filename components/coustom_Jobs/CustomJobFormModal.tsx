"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CustomJob, ClientOption } from "./customJobsTypes";
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
import TinyMceEditor from "@/components/TinyMC";

const priorities = ["low", "medium", "high", "urgent"] as const;

type Props = {
  editingJob?: CustomJob | null;
  clients: ClientOption[];
  onCancel: () => void;
  onSuccess: (job: CustomJob) => void;
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
  editingJob,
  clients,
  onCancel,
  onSuccess,
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
      return;
    }

    setForm({
      date: "",
      clientId: "",
      name: "",
      priority: "medium",
      notes: "",
    });
  }, [editingJob]);

  const selectedClient = clients.find((c) => c.id === form.clientId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!form.name || !form.name.trim()) {
        throw new Error("Task is required");
      }

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

      onSuccess(result.data as CustomJob);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full border border-purple-200 bg-linear-to-br from-slate-50 via-sky-50 to-fuchsia-50 shadow-2xl md:p-8">
      <div className="space-y-2">
        <h1 className="bg-linear-to-r from-indigo-600 via-fuchsia-600 to-sky-600 bg-clip-text text-2xl font-bold text-transparent md:text-3xl">
          {editingJob ? "Edit Custom Job" : "Create Custom Job"}
        </h1>
        <p className="text-slate-600">
          {editingJob
            ? "Update the custom job details below."
            : "Fill in the details to create a new custom job."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="date" className="font-semibold text-indigo-700">
              Date
            </Label>
            <Input
              id="date"
              type="date"
              value={form.date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, date: e.target.value }))
              }
              className="border-indigo-200 bg-white/80 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client" className="font-semibold text-sky-700">
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
                  className="w-full justify-between border-sky-200 bg-white/80 hover:border-sky-400 hover:bg-sky-50"
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
            <Label htmlFor="priority" className="font-semibold text-fuchsia-700">
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
                className="border-fuchsia-200 bg-white/80 focus:border-fuchsia-500 focus:ring-fuchsia-500"
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
          <Label htmlFor="task" className="font-semibold text-emerald-700">
            Task
          </Label>
          <TinyMceEditor
            initialValue={form.name || ""}
            onContentChange={(content: string) =>
              setForm((prev) => ({ ...prev, name: content }))
            }
            height={440}
            placeholder="Write custom task details"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes" className="font-semibold text-orange-700">
            Notes
          </Label>
          <Textarea
            id="notes"
            value={form.notes}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, notes: e.target.value }))
            }
            className="min-h-[120px] resize-y border-orange-200 bg-white/80 focus:border-orange-500 focus:ring-orange-500"
          />
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-red-200 bg-white/70 text-red-600 shadow-sm transition-all duration-200 hover:border-red-400 hover:bg-red-50 hover:text-red-700 hover:shadow-md"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-linear-to-r from-indigo-500 to-purple-600 font-semibold text-white shadow-md transition-all duration-200 hover:from-indigo-600 hover:to-purple-700 hover:shadow-xl"
          >
            {loading ? "Saving..." : editingJob ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}
