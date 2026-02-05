"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCcw } from "lucide-react";

interface CreateNextTaskProps {
  clientId: string;
  onCreated?: () => void;
  onComplete?: () => void;
  assigneeId?: string;
}

export default function CreateNextTask({
  clientId,
  onCreated,
  onComplete,
  assigneeId,
}: CreateNextTaskProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    try {
      const key = `nextTasksDone:${clientId}`;
      if (clientId && localStorage.getItem(key) === "1") {
        setIsHidden(true);
      }
    } catch {}
  }, [clientId]);

  const createNext = async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/tasks/remain-tasks-create-and-distrubution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, assigneeId }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || json?.error || "Failed to create remaining tasks");
      }

      const createdCount = Number(json?.created ?? 0);
      const assignedToName = json?.assignedTo?.name || "the top agent";

      if (createdCount > 0) {
        toast.success(
          json?.message ||
            `Created ${createdCount} remaining task(s) and assigned to ${assignedToName}`
        );
        // Hide the button after successful creation
        setIsHidden(true);
        // Optional: remember this client so you can hide the button if desired
        try {
          localStorage.setItem(`nextTasksCreated:${clientId}`, "1");
        } catch {}
      } else {
        toast.info(json?.message || "No remaining tasks to create.");
        const msg = String(json?.message || "");
        if (
          /no remaining occurrences/i.test(msg) ||
          /all remaining tasks already exist/i.test(msg) ||
          /no remaining tasks/i.test(msg)
        ) {
          try {
            localStorage.setItem(`nextTasksDone:${clientId}`, "1");
          } catch {}
          setIsHidden(true);
        }
      }

      onCreated?.();
      onComplete?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to create remaining tasks");
    } finally {
      setIsLoading(false);
    }
  };

  if (isHidden) return null;

  return (
    <Button
      onClick={createNext}
      disabled={isLoading}
      className="bg-linear-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white h-11 rounded-xl font-semibold"
      title="Create all remaining tasks (today → due date) and auto-assign to the top agent"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Creating Remaining…
        </>
      ) : (
        <>
          <RefreshCcw className="h-4 w-4 mr-2" />
          Create & Assign Remaining
        </>
      )}
    </Button>
  );
}
