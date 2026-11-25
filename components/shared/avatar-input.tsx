// components/shared/avatar-input.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, Link2, Loader2, Trash2, Upload, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toDisplayImageUrl } from "@/lib/image-url";

const MAX_DIMENSION = 512;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Downscale large photos in the browser before upload (keeps GIFs as-is). */
async function shrinkImage(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 400 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/webp", 0.88),
    );
    return blob ?? file;
  } catch {
    return file; // unsupported format in this browser → upload original
  }
}

export async function uploadAvatar(file: File): Promise<string> {
  const blob = await shrinkImage(file);
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error("Image must be 5MB or smaller");
  const body = new FormData();
  body.append("file", blob, file.name);
  const res = await fetch("/api/uploads/avatar", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) throw new Error(data?.error || "Upload failed");
  return data.url as string;
}

interface AvatarInputProps {
  value?: string | null;
  onChange: (url: string) => void;
  /** Called while an upload is running (to disable Save buttons etc.) */
  onUploadingChange?: (uploading: boolean) => void;
  className?: string;
  accent?: "violet" | "rose";
}

export function AvatarInput({
  value,
  onChange,
  onUploadingChange,
  className,
  accent = "violet",
}: AvatarInputProps) {
  const [uploading, setUploading] = useState(false);
  const [broken, setBroken] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const display = toDisplayImageUrl(value);
  useEffect(() => setBroken(false), [display]);

  const setBusy = (v: boolean) => {
    setUploading(v);
    onUploadingChange?.(v);
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setBusy(true);
    try {
      const url = await uploadAvatar(file);
      onChange(url);
      toast.success("Profile picture uploaded");
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const ring =
    accent === "rose"
      ? "ring-rose-200 dark:ring-rose-800"
      : "ring-violet-200 dark:ring-violet-800";
  const dashed =
    accent === "rose"
      ? "border-rose-300 hover:border-rose-500 hover:bg-rose-50 dark:border-rose-700 dark:hover:bg-rose-950/40"
      : "border-violet-300 hover:border-violet-500 hover:bg-violet-50 dark:border-violet-700 dark:hover:bg-violet-950/40";
  const iconColor = accent === "rose" ? "text-rose-500" : "text-violet-500";

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start", className)}>
      {/* Preview */}
      <div
        className={cn(
          "relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-lg ring-2 dark:border-border dark:bg-muted",
          ring,
        )}
      >
        {display && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={display}
            alt="Profile picture"
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-400">
            {display && broken ? (
              <>
                <ImageOff className="h-8 w-8" />
                <span className="px-2 text-center text-[10px] leading-tight">Can&apos;t load</span>
              </>
            ) : (
              <User className="h-10 w-10" />
            )}
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-7 w-7 animate-spin text-white" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "group flex flex-1 items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition-all disabled:opacity-60",
              dashed,
            )}
          >
            <Upload className={cn("h-5 w-5 transition-transform group-hover:scale-110", iconColor)} />
            <span className="text-left">
              <span className="block text-sm font-semibold text-gray-700 dark:text-foreground">
                {uploading ? "Uploading..." : display ? "Change photo" : "Upload photo"}
              </span>
              <span className="block text-xs text-gray-500 dark:text-muted-foreground">
                JPG, PNG, WEBP or GIF · up to 5MB · or drop here
              </span>
            </span>
          </button>
          {value && (
            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => onChange("")}
              className="h-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Remove
            </Button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="…or paste an image URL / Google Drive link"
            className="pl-9"
          />
        </div>
        {display && broken && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This image can&apos;t be loaded. For Google Drive, set sharing to
            &quot;Anyone with the link&quot;, or upload the photo instead.
          </p>
        )}
      </div>
    </div>
  );
}
