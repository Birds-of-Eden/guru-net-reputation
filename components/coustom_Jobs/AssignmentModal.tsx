// ================================
// FILE: components/custom-jobs/AssignmentModal.tsx
// ================================
"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCheck, Clock } from "lucide-react";

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
  taskName?: string;
  taskPriority?: string;
};

export default function AssignmentModal({
  open,
  onClose,
  onAssign,
  agents,
  taskName,
  taskPriority,
}: Props) {
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [idealDurationMinutes, setIdealDurationMinutes] = useState(30);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const getPriorityBadgeClass = (priority?: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-500 text-white hover:bg-red-500";
      case "high":
        return "bg-orange-500 text-white hover:bg-orange-500";
      case "medium":
        return "bg-amber-500 text-white hover:bg-amber-500";
      default:
        return "bg-emerald-500 text-white hover:bg-emerald-500";
    }
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Assign Task to Agent
          </DialogTitle>
          <DialogDescription>
            Select an agent to assign this custom job
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Task Summary */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="font-semibold mb-3">Task Details</h4>
            <div className="rounded-md border bg-background p-3">
              <p className="text-sm font-medium">{taskName || "Custom Job"}</p>
              {taskPriority && (
                <Badge
                  className={`mt-2 rounded-full text-xs ${getPriorityBadgeClass(taskPriority)}`}
                >
                  {taskPriority}
                </Badge>
              )}
            </div>
          </div>

          {/* Agent Selection */}
          <div className="space-y-2">
            <Label>Select Agent</Label>
            <Select
              value={selectedAgentId}
              onValueChange={(v) => setSelectedAgentId(v)}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Choose an agent to assign task to..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={agent.image || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(agent.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{agent.name}</span>
                      {agent.category && (
                        <span className="text-muted-foreground">
                          ({agent.category})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

            {/* Selected Agent Details */}
            {selectedAgent && (
              <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedAgent.image || undefined} />
                  <AvatarFallback>
                    {getInitials(selectedAgent.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{selectedAgent.name}</p>
                  {selectedAgent.category && (
                    <p className="text-xs text-muted-foreground">
                      {selectedAgent.category}
                    </p>
                  )}
                  {selectedAgent.email && (
                    <p className="text-xs text-muted-foreground">
                      {selectedAgent.email}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Ideal Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration" className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Ideal Duration (minutes)
              </Label>
              <Input
                id="duration"
                type="number"
                value={idealDurationMinutes}
                onChange={(e) =>
                  setIdealDurationMinutes(Number(e.target.value))
                }
                min="1"
                required
              />
            </div>
          </div>


        <DialogFooter>
          <Button
            type="button"
           className="bg-red-600 hover:bg-red-700"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedAgentId || loading} className="bg-green-600 hover:bg-green-700">
            {loading ? "Assigning..." : "Assign Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
