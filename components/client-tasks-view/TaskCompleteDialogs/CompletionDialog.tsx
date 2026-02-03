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
  KeyRound,
  Link as LinkIcon,
  X,
  Clock,
} from "lucide-react";

interface CompletionDialogProps {
  selected: any;
  open: boolean;
  link: string;
  email: string;
  username: string;
  password: string;
  clientEmail?: string;
  lastUsedPassword?: string | null;
  setLink: (val: string) => void;
  setEmail: (val: string) => void;
  setUsername: (val: string) => void;
  setPassword: (val: string) => void;
  notes: string;
  setNotes: (val: string) => void;
  resetModal: () => void;
  submit: (elapsedMinutes?: number) => void;
  isSimpleTask: (task: any) => boolean;
  timerState?: any;
  pausedTimer?: any;
  formatTimerDisplay?: (seconds: number) => string;
}

const CompletionDialog: React.FC<CompletionDialogProps> = ({
  selected,
  open,
  link,
  email,
  username,
  password,
  clientEmail,
  lastUsedPassword,
  setLink,
  setEmail,
  setUsername,
  setPassword,
  notes,
  setNotes,
  resetModal,
  submit,
  isSimpleTask,
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

  // Auto-fill email and username when dialog opens or link changes
  useEffect(() => {
    if (open && clientEmail && !email) {
      setEmail(clientEmail);
    }
    if (open && link && !username) {
      const urlParts = link.split("/");
      const lastPart = urlParts[urlParts.length - 1];
      const cleanUsername = lastPart.split("?")[0].split("#")[0];
      if (cleanUsername) {
        setUsername(cleanUsername);
      }
    }
  }, [open, clientEmail, email, username, link, setEmail, setUsername]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && resetModal()}>
      <DialogContent className="max-w-[50vw] max-h-[90vh] mx-auto rounded-2xl border-0 bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-600 via-green-600 to-teal-600 -m-6 mb-4 px-6 py-6 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-1">
                  Complete Task
                </div>
                <div className="text-white font-black text-lg truncate">
                  {selected?.name}
                </div>
              </div>
            </DialogTitle>
            <DialogDescription className="text-white/90 text-sm pt-2 pl-10 font-medium">
              Provide completion details below. This task will be auto-approved upon submission.
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

          {/* Completion Link */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2 uppercase tracking-wide">
              <div className="bg-emerald-100 p-1.5 rounded-lg">
                <LinkIcon className="h-3 w-3 text-emerald-600" />
              </div>
              Completion Link *
            </label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://example.com/completion"
              className="h-11 border-2 border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm font-medium"
            />
          </div>

          {/* Credentials */}
          {!isSimpleTask(selected) && (
            <div className="bg-linear-to-br from-amber-50 via-orange-50 to-yellow-50 border-2 border-amber-200 rounded-2xl p-4 space-y-4 shadow-inner">
              <div className="flex items-center gap-2 mb-1">
                <div className="bg-amber-500 p-1.5 rounded-lg">
                  <KeyRound className="h-4 w-4 text-white" />
                </div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  Account Credentials
                </h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Email</label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={clientEmail || "email@example.com"}
                    className="h-10 bg-white border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Username</label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                    className="h-10 bg-white border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-medium mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Password</label>
                  <div className="relative mt-1">
                    <Input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        lastUsedPassword
                          ? "Using saved password"
                          : "Enter password"
                      }
                      type="text"
                      className="h-10 bg-white border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-mono pr-16 transition-all font-medium"
                    />
                    {lastUsedPassword && (
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">
                        SAVED
                      </div>
                    )}
                  </div>
                  {lastUsedPassword && (
                    <p className="text-xs text-slate-600 mt-1 font-medium">
                      ✓ Using your last saved password. You can edit it above.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wide">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this completion..."
              className="w-full h-20 px-3 py-2 text-sm border-2 border-amber-200 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-none transition-all font-medium"
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
            className="h-11 rounded-xl bg-linear-to-r from-emerald-500 via-green-600 to-teal-600 hover:from-emerald-600 hover:via-green-700 hover:to-teal-700 font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all px-6"
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

export default CompletionDialog;
