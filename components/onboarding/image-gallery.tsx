// components/onboarding/image-gallery.tsx

"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  ExternalLink,
  ImageIcon,
  AlertCircle,
  Download,
  Copy,
  Check,
  Zap,
} from "lucide-react";
import type { StepProps } from "@/types/onboarding";
import { toast } from "sonner";
import { useSession } from "next-auth/react";

// 💡 FIX: Replaced "next/link" with standard <a> tag.
// 💡 FIX: Replaced "next/image" with standard <img> tag for compatibility.

type DriveImage = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnail: string;
  viewUrl: string;
};

export function ImageGallery({
  formData,
  updateFormData,
  onNext,
  onPrevious,
}: StepProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [images, setImages] = useState<DriveImage[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Copy UI state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);

  // 💡 NEW: State for zip download
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  // Manual gallery items (title + link)
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemLink, setNewItemLink] = useState("");

  // -------- helpers --------

  const driveLink = useMemo(() => {
    const val = formData.imageDrivelink as any;
    if (typeof val === "string") return val;
    if (Array.isArray(val)) return "";
    return val?.driveLink ?? "";
  }, [formData.imageDrivelink]);

  const imageItems = useMemo(() => {
    const val = formData.imageDrivelink as any;
    if (Array.isArray(val)) return val.filter((i) => i?.link || i?.title);
    if (val && Array.isArray(val.items))
      return val.items.filter((i: any) => i?.link || i?.title);
    return [] as Array<{ title?: string; link?: string }>;
  }, [formData.imageDrivelink]);

  // ✅ Get Google access token from NextAuth session
  const { data: session } = useSession();
  const accessToken = (session?.user as any)?.googleAccessToken ?? null;

  // 💡 MODIFIED: Points to the unified /api/drive endpoint and includes accessToken
  const mediaUrl = (id: string, filename?: string) => {
    const url = new URL(`/api/drive`, window.location.origin);
    url.searchParams.set("id", id);
    if (filename) url.searchParams.set("filename", filename);
    if (accessToken) url.searchParams.set("accessToken", accessToken);
    return url.pathname + url.search;
  };

  const extractFolderId = (url: string) => {
    try {
      const u = new URL(url);
      const foldIdx = u.pathname.indexOf("/folders/");
      if (foldIdx !== -1) {
        const id = u.pathname.slice(foldIdx + "/folders/".length).split("/")[0];
        if (id) return id;
      }
      const viaQuery = u.searchParams.get("id");
      if (viaQuery) return viaQuery;
      return null;
    } catch {
      return null;
    }
  };

  const folderId = useMemo(
    () => (driveLink ? extractFolderId(driveLink) : null),
    [driveLink],
  );

  // -------- actions --------
  const validateDriveLink = async () => {
    setErrorMsg(null);

    if (!driveLink) {
      toast.error("Please enter a Google Drive folder link");
      return;
    }
    if (!folderId) {
      toast.error("Invalid Google Drive folder link format");
      return;
    }

    if (!accessToken) {
      // Warn the user that private access might fail
      toast.warning("Access Token missing. Only public folders may load.");
    }

    setIsValidating(true);
    try {
      // 💡 MODIFIED: Include accessToken in the query params
      const url = new URL(`/api/drive`, window.location.origin);
      url.searchParams.set("folderId", folderId);
      if (accessToken) url.searchParams.set("accessToken", accessToken);

      const res = await fetch(url.toString(), {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setImages([]);
        setErrorMsg(data?.error || "Failed to validate Drive link");
        toast.error(data?.error || "Failed to validate Drive link");
        return;
      }

      const list = (data.images as DriveImage[]) || [];
      setImages(list);

      updateFormData({
        imageFolderId: data.folder?.id,
        imageCount: data.count ?? list.length,
      });

      toast.success(`Drive link validated! Found ${list.length} image(s).`);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error?.message ?? "Unexpected error");
      toast.error("Failed to validate Drive link");
    } finally {
      setIsValidating(false);
    }
  };

  const handleDownload = (img: DriveImage) => {
    try {
      const a = document.createElement("a");
      // server forces filename + original extension, includes token via mediaUrl
      a.href = mediaUrl(img.id, img.name);
      a.download = img.name || `image-${img.id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      window.open(img.webViewLink, "_blank");
    }
  };

  // 💡 NEW: Download All function
  const handleDownloadAll = () => {
    if (!folderId) return;

    // The API route handles the actual zipping and streaming. We just initiate the download.
    setIsDownloadingAll(true);
    try {
      const url = new URL(`/api/drive`, window.location.origin);
      url.searchParams.set("zipFolderId", folderId);
      if (accessToken) url.searchParams.set("accessToken", accessToken); // Include token for private access

      const a = document.createElement("a");
      a.href = url.toString();
      a.download = `drive-images-${folderId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Zip download started! The server will prepare the file.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to start zip download.");
    } finally {
      // Set to false immediately as the download starts in the browser,
      // even if the server takes time to stream the data.
      setTimeout(() => setIsDownloadingAll(false), 1000);
    }
  };
  // ------------------------------------

  const handleAddItem = () => {
    if (!newItemTitle.trim() && !newItemLink.trim()) return;
    const next = [
      ...imageItems,
      { title: newItemTitle.trim(), link: newItemLink.trim() },
    ].filter((i) => i.link || i.title);
    updateFormData({
      imageDrivelink: {
        driveLink,
        items: next,
      },
    });
    setNewItemTitle("");
    setNewItemLink("");
  };

  const handleRemoveItem = (idx: number) => {
    const next = imageItems.filter((_, i) => i !== idx);
    updateFormData({
      imageDrivelink: {
        driveLink,
        items: next,
      },
    });
  };

  const handleCopy = async (img: DriveImage) => {
    setCopyingId(img.id);
    try {
      const res = await fetch(mediaUrl(img.id), { cache: "no-store" }); // Includes token
      if (!res.ok) throw new Error("Failed to fetch image");
      const blob = await res.blob();

      const mime =
        blob.type && blob.type.startsWith("image/") ? blob.type : "image/png";

      // Try native binary clipboard write
      // @ts-ignore
      if (
        navigator.clipboard &&
        "write" in navigator.clipboard &&
        typeof ClipboardItem !== "undefined"
      ) {
        try {
          // @ts-ignore
          await navigator.clipboard.write([
            new ClipboardItem({ [mime]: blob }),
          ]);
          setCopiedId(img.id);
          toast.success(
            "Image copied! এখন যেকোনো অ্যাপে Paste করুন (Ctrl/⌘+V).",
          );
        } catch {
          // Fallback: PNG convert then copy
          const pngBlob = await toPngBlob(blob);
          // @ts-ignore
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": pngBlob }),
          ]);
          setCopiedId(img.id);
          toast.success("Image copied as PNG! Paste করুন (Ctrl/⌘+V).");
        }
      } else {
        // No binary clipboard → copy link as a last resort
        await navigator.clipboard.writeText(img.webViewLink);
        setCopiedId(img.id);
        toast.success("Binary copy unavailable—link copied.");
      }
    } catch (err) {
      try {
        await navigator.clipboard.writeText(img.webViewLink);
        setCopiedId(img.id);
        toast.success("Binary copy ব্যর্থ—লিংক কপি করা হলো।");
      } catch {
        toast.error("Copy ব্যর্থ হয়েছে। Permission/HTTPS চেক করুন।");
      }
    } finally {
      setCopyingId(null);
      // reset button label after 2s
      setTimeout(
        () => setCopiedId((curr) => (curr === img.id ? null : curr)),
        2000,
      );
    }
  };

  async function toPngBlob(src: Blob): Promise<Blob> {
    try {
      const bmp = await createImageBitmap(src);
      // @ts-ignore
      if (typeof OffscreenCanvas !== "undefined") {
        // @ts-ignore
        const canvas = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bmp, 0, 0);
        // @ts-ignore
        return await canvas.convertToBlob({ type: "image/png" });
      }
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0);
      const pngBlob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/png",
        ),
      );
      return pngBlob;
    } catch {
      return src; // ultimate fallback
    }
  }

  // -------- UI --------
  const CurrentGrid = isValidating ? (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="aspect-square rounded-xl bg-gray-100 animate-pulse"
        />
      ))}
    </div>
  ) : images.length === 0 ? (
    <Card className="border-dashed">
      <CardContent className="py-12 text-center text-gray-500">
        No images yet. Paste a Drive folder link and click <b>Validate</b>.{" "}
        {accessToken && (
          <p className="mt-2 text-sm text-green-600">
            You are authenticated and can access private, shared folders.
          </p>
        )}
        {!accessToken && (
          <p className="mt-2 text-sm text-red-600">
            You are NOT authenticated. Please sign in to access private/shared
            folders.
          </p>
        )}
      </CardContent>
    </Card>
  ) : (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {images.map((img) => {
        const isCopied = copiedId === img.id;
        const isBusy = copyingId === img.id;
        return (
          <Card key={img.id} className="overflow-hidden group">
            <div className="relative aspect-square">
              {/* 💡 FIX: Using standard <img> tag instead of Next.js <Image> */}
              <img
                src={img.viewUrl}
                alt={img.name}
                // Tailwind classes for fill/object-cover replacement
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = img.thumbnail;
                }}
              />

              {/* hover actions */}
              <div className="absolute inset-0 flex items-end justify-center p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-linear-to-t from-black/50 to-transparent">
                <div className="flex gap-2">
                  {isCopied ? (
                    <Button size="sm" variant="secondary" disabled>
                      <Check className="h-4 w-4 mr-1" />
                      Copied
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleCopy(img)}
                      disabled={isBusy}
                    >
                      {isBusy ? (
                        <>Copying…</>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </>
                      )}
                    </Button>
                  )}
                  <Button size="sm" onClick={() => handleDownload(img)}>
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </div>

            <CardContent className="p-3">
              <div className="text-sm font-medium truncate" title={img.name}>
                {img.name}
              </div>
              <div className="mt-2">
                {/* 💡 FIX: Using standard <a> tag instead of Next.js <Link> */}
                <a
                  href={img.webViewLink}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  View in Drive <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-linear-to-br from-green-500 to-emerald-500 shadow-lg mb-4">
          <ImageIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-linear-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
          Image Gallery
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Connect your Google Drive folder to showcase your image collection.
        </p>
      </div>

      {/* Drive Link Card */}
      <div className="bg-linear-to-br from-white to-green-50/30 rounded-2xl shadow-xl border border-green-100 p-8 space-y-6 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
            <ImageIcon className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            Connect Campaign Folder
          </h2>
        </div>

        <div className="space-y-4">
          <Label
            htmlFor="avatar"
            className="text-sm font-semibold text-gray-700"
          >
            Avatar URL (optional)
          </Label>
          <Input
            id="avatar"
            placeholder="https://example.com/avatar.jpg"
            value={formData.avatar || ""}
            onChange={(e) => updateFormData({ avatar: e.target.value })}
            className="h-12 border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-200 rounded-xl"
          />

          <Label
            htmlFor="imageDrivelink"
            className="text-sm font-semibold text-gray-700"
          >
            Google Drive Folder Link
          </Label>
          <div className="flex gap-3">
            <Input
              id="imageDrivelink"
              placeholder="https://drive.google.com/drive/folders/XXXXXXXXXXXX"
              value={driveLink}
              onChange={(e) =>
                updateFormData({
                  imageDrivelink: {
                    driveLink: e.target.value,
                    items: imageItems,
                  },
                })
              }
              className="h-12 border-2 border-gray-200 focus:border-green-500 focus:ring-4 focus:ring-green-100 transition-all duration-200 rounded-xl"
            />
            <Button
              onClick={validateDriveLink}
              disabled={isValidating || !driveLink}
              className="h-12 px-8 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50"
            >
              {isValidating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Validating...
                </>
              ) : (
                "Validate Link"
              )}
            </Button>
          </div>

          {folderId && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-sm text-green-800">
                <span className="font-semibold">Folder ID:</span>{" "}
                <span className="font-mono">{folderId}</span>
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="mt-4 flex items-start gap-3 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 font-medium">{errorMsg}</p>
            </div>
          )}

          {/* Manual items */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-gray-700">
                Add Image Links (Title + URL)
              </Label>
              <span className="text-xs text-gray-500">Optional</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Input
                placeholder="Title"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                className="md:col-span-2 h-11"
              />
              <Input
                placeholder="https://example.com/image"
                value={newItemLink}
                onChange={(e) => setNewItemLink(e.target.value)}
                className="md:col-span-3 h-11"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={handleAddItem}
                className="bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                disabled={!newItemTitle.trim() && !newItemLink.trim()}
              >
                Add Link
              </Button>
            </div>

            {imageItems.length > 0 && (
              <div className="space-y-2">
                {imageItems.map((item, idx) => (
                  <div
                    key={`${item.title}-${idx}`}
                    className="flex items-center justify-between bg-white border border-emerald-100 rounded-lg px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {item.title || "(Untitled)"}
                      </p>
                      {item.link && (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-600 hover:underline break-all"
                        >
                          {item.link}
                        </a>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Grid */}
      <div className="bg-linear-to-br from-white to-emerald-50/30 rounded-2xl shadow-xl border border-emerald-100 p-8 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-linear-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Image Preview
              </h2>
              <p className="text-sm text-gray-600">
                {images.length} images found
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            {images.length > 0 && (
              <Button
                onClick={handleDownloadAll}
                disabled={isDownloadingAll}
                className="bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg"
              >
                {isDownloadingAll ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Preparing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Download All
                  </>
                )}
              </Button>
            )}
            {folderId && (
              <a
                href={`https://drive.google.com/drive/folders/${folderId}`}
                target="_blank"
                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                Open in Drive <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        {CurrentGrid}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="px-8 py-6 text-lg font-semibold border-2 hover:bg-linear-to-r hover:from-green-50 hover:to-emerald-50 hover:text-green-700 hover:border-green-400 transition-all duration-200 rounded-xl"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 17l-5-5m0 0l5-5m-5 5h12"
            />
          </svg>
          Previous
        </Button>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onNext}
            className="px-6 py-6 text-base font-semibold border-2 hover:bg-gray-50 transition-all duration-200 rounded-xl"
          >
            Skip this step
          </Button>
          <Button
            onClick={onNext}
            className="px-8 py-6 text-lg font-semibold bg-linear-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 text-white rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
          >
            {images.length > 0 ? "Save & Continue" : "Continue"}
            <svg
              className="w-5 h-5 ml-2 inline-block"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
