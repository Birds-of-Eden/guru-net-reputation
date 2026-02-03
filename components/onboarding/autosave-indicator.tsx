"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutoSaveStatus } from "@/hooks/use-onboarding-autosave";
import { cn } from "@/lib/utils";

interface AutosaveIndicatorProps {
  status: AutoSaveStatus;
  hasDraft: boolean;
  lastSavedAt: Date | null;
  onClearDraft?: () => void;
  className?: string;
}

export function AutosaveIndicator({
  status,
  hasDraft,
  lastSavedAt,
  onClearDraft,
  className,
}: AutosaveIndicatorProps) {
  const [timeAgo, setTimeAgo] = useState<string>("");

  useEffect(() => {
    if (!lastSavedAt) return;

    const updateTimeAgo = () => {
      const now = new Date();
      const diffMs = now.getTime() - lastSavedAt.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);

      if (diffSec < 5) {
        setTimeAgo("just now");
      } else if (diffSec < 60) {
        setTimeAgo(`${diffSec} seconds ago`);
      } else if (diffMin < 60) {
        setTimeAgo(`${diffMin} minute${diffMin > 1 ? "s" : ""} ago`);
      } else {
        setTimeAgo(lastSavedAt.toLocaleTimeString());
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 5000);

    return () => clearInterval(interval);
  }, [lastSavedAt]);

  const getStatusConfig = () => {
    switch (status) {
      case "saving":
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          text: "Saving draft...",
          color: "text-blue-600",
          bgColor: "bg-blue-50",
          borderColor: "border-blue-200",
        };
      case "saved":
        return {
          icon: <CheckCircle2 className="w-4 h-4" />,
          text: timeAgo ? `Saved ${timeAgo}` : "All changes saved",
          color: "text-green-600",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
        };
      case "error":
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: "Failed to save",
          color: "text-red-600",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
        };
      default:
        if (hasDraft && lastSavedAt) {
          return {
            icon: <CheckCircle2 className="w-4 h-4" />,
            text: timeAgo ? `Saved ${timeAgo}` : "Draft available",
            color: "text-gray-600",
            bgColor: "bg-gray-50",
            borderColor: "border-gray-200",
          };
        }
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <div
      className={cn(
        "fixed top-20 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm transition-all duration-300",
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <div className={cn("flex items-center gap-2", config.color)}>
        {config.icon}
        <span className="text-sm font-medium">{config.text}</span>
      </div>

      {hasDraft && onClearDraft && status !== "saving" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearDraft}
          className={cn(
            "h-7 px-2 text-xs hover:bg-white/50",
            config.color
          )}
          title="Clear draft and start fresh"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

// Optional: Draft restoration banner component
interface DraftRestorationBannerProps {
  onRestore: () => void;
  onDiscard: () => void;
  lastSavedAt: Date | null;
}

export function DraftRestorationBanner({
  onRestore,
  onDiscard,
  lastSavedAt,
}: DraftRestorationBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const timeText = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString()
    : "earlier";

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl mx-auto px-4">
      <div className="bg-linear-to-r from-violet-500 to-purple-500 text-white rounded-xl shadow-2xl p-4 border border-white/20 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <div className="shrink-0 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">Draft Found!</h3>
            <p className="text-sm text-white/90">
              We found an unsaved draft from {timeText}. Would you like to
              continue where you left off?
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                onRestore();
                setIsVisible(false);
              }}
              className="bg-white text-violet-600 hover:bg-white/90"
              size="sm"
            >
              Restore
            </Button>
            <Button
              onClick={() => {
                onDiscard();
                setIsVisible(false);
              }}
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10"
              size="sm"
            >
              Discard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
