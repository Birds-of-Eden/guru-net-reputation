"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Link as LinkIcon,
  X,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";

interface CustomJobCompletionDialogProps {
  selected: any;
  open: boolean;
  links: string[];
  notes: string;
  setLinks: (links: string[]) => void;
  setNotes: (val: string) => void;
  resetModal: () => void;
  submit: (elapsedMinutes?: number) => void;
  timerState?: any;
  pausedTimer?: any;
  formatTimerDisplay?: (seconds: number) => string;
}

const CustomJobCompletionDialog: React.FC<CustomJobCompletionDialogProps> = ({
  selected,
  open,
  links,
  notes,
  setLinks,
  setNotes,
  resetModal,
  submit,
  timerState,
  pausedTimer,
  formatTimerDisplay,
}) => {
  // Calculate timer information from TaskTimer data
  const calculateTimerInfo = () => {
    if (!selected?.idealDurationMinutes) return null;

    const total = selected.idealDurationMinutes * 60;
    const isActive = timerState?.taskId === selected.id;
    const isPausedHere =
      !isActive &&
      pausedTimer?.taskId === selected.id &&
      !pausedTimer?.isRunning;

    let elapsedSeconds = 0;
    let remainingSeconds = total;
    let displayTime = total;

    if (isActive && timerState) {
      remainingSeconds = timerState.remainingSeconds;
      elapsedSeconds = Math.max(0, total - remainingSeconds);
      displayTime = Math.abs(remainingSeconds);
    } else if (isPausedHere && pausedTimer) {
      remainingSeconds = pausedTimer.remainingSeconds;
      elapsedSeconds = Math.max(0, total - remainingSeconds);
      displayTime = Math.abs(remainingSeconds);
    }

    return {
      elapsedSeconds,
      remainingSeconds,
      totalSeconds: total,
      formatElapsedTime: formatTimerDisplay
        ? formatTimerDisplay(elapsedSeconds)
        : `${Math.floor(elapsedSeconds / 60)}:${(elapsedSeconds % 60)
            .toString()
            .padStart(2, "0")}`,
      formatDisplayTime: formatTimerDisplay
        ? formatTimerDisplay(displayTime)
        : `${Math.floor(displayTime / 60)}:${(displayTime % 60)
            .toString()
            .padStart(2, "0")}`,
    };
  };

  const timerInfo = calculateTimerInfo();

  // Convert array of links to a single string for the textarea
  const linksValue = links.join("\n");

  // Handle bulk links input
  const handleBulkLinksChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    // Split by newline or comma, then trim and filter out empty strings
    const newLinks = value
      .split(/[\n,]+/)
      .map((link) => link.trim())
      .filter((link) => link !== "");
    setLinks(newLinks);
  };

  // Initialize with empty array if needed
  useEffect(() => {
    if (open && links.length === 0) {
      setLinks([]);
    }
  }, [open, setLinks]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetModal()}>
      <DialogContent className="max-w-[50vw] max-h-[90vh] mx-auto rounded-2xl border-0 bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-linear-to-r from-purple-600 via-indigo-600 to-blue-600 -m-6 mb-4 px-6 py-6 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-1">
                  Complete Custom Job
                </div>
              </div>
            </DialogTitle>
            <DialogDescription className="text-white/90 text-sm pt-2 pl-10 font-medium">
              Provide completion links below. Links will be stored as comma-separated values.
            </DialogDescription>
            {timerInfo && (
              <div className="flex items-center gap-2 text-white/80 text-xs pt-2 pl-10">
                <Clock className="h-3 w-3" />
                Time: {timerInfo.formatElapsedTime} ({Math.ceil(timerInfo.elapsedSeconds / 60)} min)
              </div>
            )}
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-5 flex-1 overflow-y-auto">
          {/* Timer Display */}
          <div className="bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-blue-500 p-1.5 rounded-lg">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                    Time Tracking
                  </h3>
                  <p className="text-xs text-blue-600 font-medium">
                    Time spent on this completion
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-mono font-black text-blue-700">
                  {timerInfo?.formatElapsedTime || "00:00"}
                </div>
                <div className="text-xs text-blue-600 font-medium">
                  {timerInfo ? Math.ceil(timerInfo.elapsedSeconds / 60) : 0} minutes
                </div>
              </div>
            </div>
          </div>

          {/* Completion Links */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
                <div className="bg-purple-100 p-1.5 rounded-lg">
                  <LinkIcon className="h-3 w-3 text-purple-600" />
                </div>
                Completion Links (Bulk) *
              </label>
            </div>
            
            <div className="space-y-2">
              <textarea
                value={linksValue}
                onChange={handleBulkLinksChange}
                placeholder="Paste links here (one per line or separated by commas)..."
                className="w-full h-32 px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none transition-all font-medium"
              />
            </div>
            
            <p className="text-xs text-slate-600 font-medium">
              You can paste multiple links. They will be automatically separated and stored.
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this custom job completion..."
              className="w-full h-20 px-3 py-2 text-sm border-2 border-purple-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none transition-all font-medium"
            />
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 pb-6 pt-4 border-t-2 border-slate-100 gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={resetModal}
            className="h-11 rounded-xl bg-linear-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white hover:text-white font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105 border-0 px-6"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            className="h-11 rounded-xl bg-linear-to-r from-purple-500 via-indigo-600 to-blue-600 hover:from-purple-600 hover:via-indigo-700 hover:to-blue-700 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all px-6"
            onClick={() => {
              const elapsedMinutes = timerInfo
                ? Math.ceil(timerInfo.elapsedSeconds / 60)
                : 0;
              submit(elapsedMinutes);
            }}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Submit Completion ({timerInfo?.formatDisplayTime || "00:00"})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomJobCompletionDialog;
