"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import TinyMceEditor from "@/components/TinyMC";
import { Badge } from "@/components/ui/badge";

type AMUpdateStatus = "approved" | "rejected";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (status: AMUpdateStatus, note: string) => Promise<void>;
  taskName?: string;
  initialStatus?: string | null;
  initialNote?: string | null;
  canEdit?: boolean;
};

function getStatusBadgeClass(status?: string | null) {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-500/10 text-emerald-700";
    case "rejected":
      return "border-red-200 bg-red-500/10 text-red-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

export default function AMUpdateModal({
  open,
  onClose,
  onSubmit,
  taskName,
  initialStatus,
  initialNote,
  canEdit = false,
}: Props) {
  const [status, setStatus] = useState<AMUpdateStatus>("approved");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStatus(initialStatus === "rejected" ? "rejected" : "approved");
    setNote(initialNote || "");
  }, [initialNote, initialStatus, open]);

  const handleClose = () => {
    if (!loading) onClose();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      await onSubmit(status, note);
      onClose();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Failed to save AM update");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="max-w-3xl rounded-2xl border-0 p-0 shadow-2xl">
        <div className="overflow-hidden rounded-2xl border bg-white">
          <div className="bg-linear-to-r from-sky-600 via-indigo-600 to-violet-600 px-6 py-5 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">AM Update</DialogTitle>
              <DialogDescription className="text-sm text-blue-50">
                Save approval or rejection with a note for this custom job.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Current Status
              </div>
              <Badge
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                  initialStatus,
                )}`}
              >
                {initialStatus || "pending"}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-slate-800">Decision</Label>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as AMUpdateStatus)}
                disabled={!canEdit || loading}
              >
                <SelectTrigger className="h-11 rounded-xl border-slate-200">
                  <SelectValue placeholder="Select decision" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-slate-800">Note</Label>
              <TinyMceEditor
                initialValue={note}
                onContentChange={(content) => setNote(content)}
                height={240}
                placeholder="Write AM note or feedback"
              />
              {!canEdit && (
                <p className="text-xs text-slate-500">
                  This update is view-only for your role.
                </p>
              )}
            </div>

            <DialogFooter className="flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canEdit || loading}
                className="rounded-xl bg-linear-to-r from-sky-600 to-violet-600 text-white"
              >
                {loading ? "Saving..." : "Save Update"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
