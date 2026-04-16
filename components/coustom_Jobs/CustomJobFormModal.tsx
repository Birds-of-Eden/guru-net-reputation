// ================================
// FILE: components/custom-jobs/CustomJobFormModal.tsx
// ================================
"use client";

import { useEffect, useState } from "react";
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

const priorities = ["low", "medium", "high", "urgent"];

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingJob?: CustomJob | null;
  clients: ClientOption[];
};

export default function CustomJobFormModal({
  open,
  onClose,
  onSuccess,
  editingJob,
  clients,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: "",
    clientId: "",
    name: "",
    priority: "medium",
    notes: "",
  });

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
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingJob ? "Edit Custom Job" : "Create Custom Job"}
          </DialogTitle>
          <DialogDescription>
            {editingJob
              ? "Update the custom job details below"
              : "Fill in the details to create a new custom job"}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          <div className="grid col-span-2 grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Client</Label>
              <Select
                value={form.clientId}
                onValueChange={(v) => setForm((p) => ({ ...p, clientId: v }))}
              >
                <SelectTrigger id="client">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}{" "}
                      {client.company ? `(${client.company})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((p) => ({ ...p, priority: v }))}
              >
                <SelectTrigger id="priority">
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

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="task">Task</Label>
            <Textarea
              id="task"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Write custom task details"
              className="min-h-[90px]"
              required
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
              }
              className="min-h-[80px]"
            />
          </div>

          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : editingJob ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
