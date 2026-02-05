// components/clients/client-edit-modal.tsx
//lint error fixed
"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useUserSession } from "@/lib/hooks/use-user-session";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import TinymceEditor from "@/components/TinyMC";
import {
  User,
  Mail,
  Globe,
  Building,
  MapPin,
  BookOpen,
  Image,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { Client } from "@/types/client";

type ClientWithSocial = Client & {
  email?: string | null;
  phone?: string | null;
  password?: string | null;
  recoveryEmail?: string | null;
  amId?: string | null;
};

export type FormValues = {
  name: string;
  birthdate?: string;
  renewalDate?: string;
  company?: string;
  designation?: string;
  location?: string;
  gender?: string;

  // contact/credentials
  email?: string | null;
  phone?: string | null;
  password?: string | null;
  recoveryEmail?: string | null;

  // websites & media
  websites?: string[];
  companywebsite?: string;
  companyaddress?: string;
  biography?: string;
  imageDrivelink?:
    | string
    | {
        driveLink?: string;
        items?: Array<{ title?: string; link?: string }>;
      }
    | Array<{ title?: string; link?: string }>;
  avatar?: string;
  socialMedia?: string;
  articleTopics?: string;

  progress?: number;
  status?: string;
  startDate?: string;
  dueDate?: string;

  // AM
  amId?: string | null;
  // Arbitrary JSON pairs to save in Client.otherField
  // Arbitrary JSON (category + title + multiple items) -> Client.otherField (Json)
  otherField?: Array<{ category: string; title: string; data: string[] }>;
};

type AMUser = { id: string; name: string | null; email: string | null };
type DriveItem = { title?: string; link?: string };

const normalizeImageDrive = (raw: any): { driveLink: string; items: DriveItem[] } => {
  if (typeof raw === "string") {
    return { driveLink: raw, items: [] };
  }
  if (Array.isArray(raw)) {
    return {
      driveLink: "",
      items: raw.filter((i) => i?.link || i?.title),
    };
  }
  if (raw && typeof raw === "object") {
    return {
      driveLink: typeof raw.driveLink === "string" ? raw.driveLink : "",
      items: Array.isArray(raw.items) ? raw.items.filter((i: any) => i?.link || i?.title) : [],
    };
  }
  return { driveLink: "", items: [] };
};

const buildImageDrivePayload = (driveLink: string, items: DriveItem[]) => {
  const cleanDriveLink = String(driveLink || "").trim();
  const cleanItems = (items || [])
    .map((i) => ({
      title: String(i?.title ?? "").trim() || undefined,
      link: String(i?.link ?? "").trim() || undefined,
    }))
    .filter((i) => i.title || i.link);
  if (!cleanDriveLink && cleanItems.length === 0) return null;
  return { driveLink: cleanDriveLink, items: cleanItems };
};

export interface ClientEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientData: ClientWithSocial;
  currentUserRole?: string;
  /** Called after a successful save */
  onSaved?: () => void;
}

function toDateInput(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ClientEditModal({
  open,
  onOpenChange,
  clientData,
  currentUserRole,
  onSaved,
}: ClientEditModalProps) {
  const router = useRouter();
  const { user } = useUserSession();

  const roleName = (
    currentUserRole ??
    (user as any)?.role?.name ??
    (user as any)?.role ??
    ""
  )
    .toString()
    .toLowerCase();
  const isAgent = roleName === "agent";
  const isAdmin = roleName.includes("admin");

  const [ams, setAms] = useState<AMUser[]>([]);
  const [amsLoading, setAmsLoading] = useState(false);
  const [amsError, setAmsError] = useState<string | null>(null);
  const [biographyContent, setBiographyContent] = useState<string>("");
  const [isClient, setIsClient] = useState(false);
  const [driveLink, setDriveLink] = useState("");
  const [driveItems, setDriveItems] = useState<DriveItem[]>([]);
  const [newDriveTitle, setNewDriveTitle] = useState("");
  const [newDriveLink, setNewDriveLink] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const currentAmId = clientData.amId ?? null;

  const { register, handleSubmit, reset, setValue, watch } =
    useForm<FormValues>({
      defaultValues: {
        name: clientData.name ?? "",
        birthdate: toDateInput(clientData.birthdate as any),
        company: clientData.company ?? "",
        designation: clientData.designation ?? "",
        location: clientData.location ?? "",
        gender: (clientData as any).gender ?? "",
        renewalDate: toDateInput((clientData as any).renewalDate as any),
        email: clientData.email ?? "",
        phone: clientData.phone ?? "",
        password: clientData.password ?? "",
        recoveryEmail: clientData.recoveryEmail ?? "",
        websites: Array.isArray((clientData as any).websites)
          ? ((clientData as any).websites as string[]).filter(
              (w) => typeof w === "string" && w.trim() !== ""
            )
          : [],
        companywebsite: clientData.companywebsite ?? "",
        companyaddress: clientData.companyaddress ?? "",
        biography: (clientData as any).biography ?? "",
        imageDrivelink: (clientData as any).imageDrivelink ?? "",
        avatar: (clientData as any).avatar ?? "",
        progress: clientData.progress ?? 0,
        status: (clientData.status as string) ?? "inactive",
        startDate: toDateInput(clientData.startDate as any),
        dueDate: toDateInput(clientData.dueDate as any),
        amId: currentAmId,
      },
    });

  // Watch form values
  const statusValue = watch("status");
  const genderValue = watch("gender");

  // Client-side only initialization
  useEffect(() => {
    setIsClient(true);
    setBiographyContent((clientData as any).biography ?? "");
    const initialDrive = normalizeImageDrive((clientData as any).imageDrivelink);
    setDriveLink(initialDrive.driveLink);
    setDriveItems(initialDrive.items);
  }, []);

  // rehydrate form whenever the modal is opened (so stale edits don't linger)
  useEffect(() => {
    if (!open) return;
    const biographyValue = (clientData as any).biography ?? "";
    setBiographyContent(biographyValue);
    const nextDrive = normalizeImageDrive((clientData as any).imageDrivelink);
    setDriveLink(nextDrive.driveLink);
    setDriveItems(nextDrive.items);
    reset({
      name: clientData.name ?? "",
      birthdate: toDateInput(clientData.birthdate as any),
      company: clientData.company ?? "",
      designation: clientData.designation ?? "",
      location: clientData.location ?? "",
      gender: (clientData as any).gender ?? "",
      renewalDate: toDateInput((clientData as any).renewalDate as any),
      email: clientData.email ?? "",
      phone: clientData.phone ?? "",
      password: clientData.password ?? "",
      recoveryEmail: clientData.recoveryEmail ?? "",
      websites: Array.isArray((clientData as any).websites)
        ? ((clientData as any).websites as string[]).filter(
            (w) => typeof w === "string" && w.trim() !== ""
          )
        : [],
      companywebsite: clientData.companywebsite ?? "",
      companyaddress: clientData.companyaddress ?? "",
      biography: biographyValue,
      imageDrivelink: (clientData as any).imageDrivelink ?? "",
      avatar: (clientData as any).avatar ?? "",
      progress: clientData.progress ?? 0,
      status: (clientData.status as string) ?? "inactive",
      amId: currentAmId,
    });
  }, [open, currentAmId]);

  // ---- otherField (arbitrary JSON key/value pairs) ----
  // ---- otherField (category + title + data[]) ----
  type KV = { category: string; title: string; data: string[] };

  const normalizeOtherField = (raw: any): KV[] => {
    if (!raw) return [];
    // New shape: [{ category, title, data: [] }]
    if (
      Array.isArray(raw) &&
      raw.some((x) => typeof x?.category === "string")
    ) {
      return raw
        .filter((item) => !(item.title === "name_keywords" && item.category === "system"))
        .map((it) => ({
          category: String(it?.category ?? "").trim(),
          title: String(it?.title ?? "").trim(),
          data: Array.isArray(it?.data)
            ? it.data.map((d: any) => String(d ?? "").trim()).filter(Boolean)
            : [String(it?.data ?? "").trim()].filter(Boolean),
        }))
        .filter((r) => r.title || r.data.length);
    }
    // Legacy array: [{ title, data }]
    if (Array.isArray(raw)) {
      return raw
        .map((it) => ({
          category: "General",
          title: String((it && (it.title ?? it.key ?? it.name)) ?? "").trim(),
          data: Array.isArray(it?.data)
            ? it.data.map((d: any) => String(d ?? "").trim()).filter(Boolean)
            : [
                String(
                  (it && (it.data ?? it.value ?? it.content)) ?? ""
                ).trim(),
              ].filter(Boolean),
        }))
        .filter((r) => r.title || r.data.length);
    }
    // Object map fallback: { key: value }
    if (typeof raw === "object") {
      return Object.entries(raw).map(([k, v]) => ({
        category: "General",
        title: String(k).trim(),
        data: Array.isArray(v)
          ? (v as any[]).map((d) => String(d ?? "").trim()).filter(Boolean)
          : [String(v ?? "").trim()].filter(Boolean),
      }));
    }
    return [];
  };

  const [otherPairs, setOtherPairs] = useState<KV[]>(
    normalizeOtherField((clientData as any).otherField)
  );

  // Extract and manage keywords separately
  const [keywords, setKeywords] = useState<string[]>(() => {
    const otherField = (clientData as any).otherField;
    if (!Array.isArray(otherField)) return [];
    
    const nameKeywordsField = otherField.find(
      (field: any) => field.title === "name_keywords" && field.category === "system"
    );
    
    if (!nameKeywordsField || !Array.isArray(nameKeywordsField.data)) return [];
    
    return nameKeywordsField.data.filter((keyword: any) => keyword && typeof keyword === 'string');
  });

  useEffect(() => {
    if (open) {
      setOtherPairs(normalizeOtherField((clientData as any).otherField));
      
      // Extract keywords
      const otherField = (clientData as any).otherField;
      if (Array.isArray(otherField)) {
        const nameKeywordsField = otherField.find(
          (field: any) => field.title === "name_keywords" && field.category === "system"
        );
        if (nameKeywordsField && Array.isArray(nameKeywordsField.data)) {
          setKeywords(nameKeywordsField.data.filter((keyword: any) => keyword && typeof keyword === 'string'));
        } else {
          setKeywords([]);
        }
      }
    }
  }, [open]);

  // helpers for array item ops
  const addRow = () =>
    setOtherPairs((prev) => [...prev, { category: "", title: "", data: [""] }]);

  const removeRow = (idx: number) =>
    setOtherPairs((prev) => prev.filter((_, i) => i !== idx));

  const updateRowField = (idx: number, key: keyof KV, value: string) =>
    setOtherPairs((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );

  const addDataItem = (idx: number) =>
    setOtherPairs((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, data: [...r.data, ""] } : r))
    );

  const updateDataItem = (rowIdx: number, dataIdx: number, value: string) =>
    setOtherPairs((prev) =>
      prev.map((r, i) =>
        i === rowIdx
          ? { ...r, data: r.data.map((d, di) => (di === dataIdx ? value : d)) }
          : r
      )
    );

  const removeDataItem = (rowIdx: number, dataIdx: number) =>
    setOtherPairs((prev) =>
      prev.map((r, i) =>
        i === rowIdx
          ? { ...r, data: r.data.filter((_, di) => di !== dataIdx) }
          : r
      )
    );

  // Keyword management functions
  const addKeyword = () => setKeywords(prev => [...prev, ""]);
  const updateKeyword = (idx: number, value: string) => 
    setKeywords(prev => prev.map((k, i) => i === idx ? value : k));
  const removeKeyword = (idx: number) => 
    setKeywords(prev => prev.filter((_, i) => i !== idx));

  const addDriveItem = () => {
    if (!newDriveTitle.trim() && !newDriveLink.trim()) return;
    setDriveItems((prev) => [
      ...prev,
      { title: newDriveTitle.trim(), link: newDriveLink.trim() },
    ]);
    setNewDriveTitle("");
    setNewDriveLink("");
  };

  const removeDriveItem = (idx: number) =>
    setDriveItems((prev) => prev.filter((_, i) => i !== idx));

  const fetchAMs = async (): Promise<AMUser[]> => {
    try {
      setAmsLoading(true);
      setAmsError(null);
      const res = await fetch("/api/users?role=am&limit=100", {
        cache: "no-store",
      });
      const json = await res.json();
      const raw = (json?.users ?? json?.data ?? []) as any[];
      const list = raw
        .filter((u) => u?.role?.name === "am")
        .map((u) => ({
          id: String(u.id),
          name: u.name ?? null,
          email: u.email ?? null,
        }));
      setAms(list);
      return list;
    } catch (e) {
      console.error(e);
      setAms([]);
      setAmsError("Failed to load AMs");
      return [];
    } finally {
      setAmsLoading(false);
    }
  };

  // Load AM list when modal opens for admins, and ensure current AM is preserved
  useEffect(() => {
    if (!open || !isAdmin) return;
    fetchAMs().then((list) => {
      if (currentAmId && !list.some((a) => a.id === currentAmId)) {
        setAms((prev) => [
          ...prev,
          { id: currentAmId, name: "Current AM", email: null },
        ]);
      }
      // ensure select shows current value
      setValue("amId", currentAmId);
    });
  }, [open, isAdmin, currentAmId]);

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSaving(true);

      // Update biography form value with current editor content
      setValue("biography", biographyContent);
      const imagePayload = buildImageDrivePayload(driveLink, driveItems);

      let payload: Partial<FormValues>;

      if (isAgent) {
        const allowed: (keyof FormValues)[] = [
          "email",
          "phone",
          "password",
          "recoveryEmail",
          "imageDrivelink",
        ];
        payload = allowed.reduce((acc, key) => {
          const val = (values as any)[key];
          if (val !== undefined) (acc as any)[key] = val;
          return acc;
        }, {} as Partial<FormValues>);
        (payload as any).imageDrivelink = imagePayload;
      } else {
        const {
          email,
          phone,
          password,
          recoveryEmail,
          socialMedia,
          articleTopics,
          ...rest
        } = values;
        const cleanedPairs = otherPairs
          .filter((p) => !(p.title === "name_keywords" && p.category === "system"))
          .map((p) => ({
            category: p.category.trim(),
            title: p.title.trim(),
            data: p.data.map((d) => d.trim()).filter(Boolean),
          }))
          .filter((p) => p.title || p.data.length);

        // Add keywords to otherField if they exist
        const finalOtherField = [...cleanedPairs];
        if (keywords.some(k => k.trim())) {
          finalOtherField.push({
            category: "system",
            title: "name_keywords",
            data: keywords.filter(k => k.trim()).map(k => k.trim())
          });
        }

        const webArray = (rest as any).websites as string[] | undefined;
        const cleanedWebsites = (webArray ?? [])
          .map((w) => (w || "").trim())
          .filter((w) => w !== "");

        // Parse articleTopics (JSON or comma-separated)
        let parsedArticleTopics: any = undefined;
        if (articleTopics && articleTopics.trim()) {
          try {
            parsedArticleTopics = JSON.parse(articleTopics);
          } catch {
            parsedArticleTopics = articleTopics
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
          }
        }

        // Parse socialMedia JSON (array/object)
        let parsedSocialMedia: any = undefined;
        if (socialMedia && socialMedia.trim()) {
          try {
            parsedSocialMedia = JSON.parse(socialMedia);
          } catch (e) {
            toast.error("Social media must be valid JSON");
            throw e;
          }
        }

        payload = {
          ...rest,
          email: values.email || undefined,
          phone: values.phone || undefined,
          password: values.password || undefined,
          recoveryEmail: values.recoveryEmail || undefined,
          imageDrivelink: imagePayload,
          websites: cleanedWebsites,
          progress:
            values.progress === undefined || values.progress === null
              ? undefined
              : Number(values.progress),
          birthdate: values.birthdate || undefined,
          amId: values.amId && values.amId.trim() !== "" ? values.amId : null,
          biography: biographyContent,
          // attach arbitrary JSON
          otherField: finalOtherField,
          articleTopics: parsedArticleTopics,
          socialMedia: parsedSocialMedia,
        };
      }

      const res = await fetch(`/api/clients/${clientData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || `Failed with ${res.status}`);
      }

      toast.success("Client updated");
      onOpenChange(false);
      if (onSaved) {
        await Promise.resolve(onSaved());
      }
      router.refresh();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to update client");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "in_progress":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "pending":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "paused":
        return "bg-violet-100 text-violet-700 border-violet-200";
      case "inactive":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto bg-linear-to-br from-slate-50 to-blue-50 rounded-2xl border-0 shadow-xl">
        <DialogHeader className="bg-linear-to-r from-blue-50/70 to-indigo-50/70 py-4 px-6 rounded-t-2xl border-b border-slate-200/70">
          <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            Edit Client Profile
          </DialogTitle>
        </DialogHeader>

        <form
          id="edit-client-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6 p-6"
        >
          {/* Contact & Credentials - Available to all users */}
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-blue-50/60">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                Contact & Credentials
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="email"
                    className="text-sm font-medium text-slate-700 mb-2 block"
                  >
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    className="border-slate-300 focus:border-blue-500"
                    {...register("email")}
                  />
                </div>
                <div>
                  <Label
                    htmlFor="phone"
                    className="text-sm font-medium text-slate-700 mb-2 block"
                  >
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    className="border-slate-300 focus:border-blue-500"
                    {...register("phone")}
                  />
                </div>
                <div>
                  <Label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-700 mb-2 block"
                  >
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="text"
                    className="border-slate-300 focus:border-blue-500"
                    {...register("password")}
                  />
                </div>
                <div>
                  <Label
                    htmlFor="recoveryEmail"
                    className="text-sm font-medium text-slate-700 mb-2 block"
                  >
                    Recovery Email
                  </Label>
                  <Input
                    id="recoveryEmail"
                    type="email"
                    className="border-slate-300 focus:border-blue-500"
                    {...register("recoveryEmail")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AGENT-ONLY: Media (Image Drive Link only) */}
          {isAgent && (
            <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-purple-50/60">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Image className="h-5 w-5 text-purple-600" aria-label="media" />
                  Media
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label
                      htmlFor="imageDrivelink"
                      className="text-sm font-medium text-slate-700 mb-2 block"
                    >
                      Image Drive Link
                    </Label>
                    <Input
                      id="imageDrivelink"
                      className="border-slate-300 focus:border-purple-500"
                      value={driveLink}
                      onChange={(e) => setDriveLink(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/XXXXXXXXXXXX"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium text-slate-700">
                        Add Image Links (Title + URL)
                      </Label>
                      <span className="text-xs text-slate-500">Optional</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <Input
                        placeholder="Title"
                        value={newDriveTitle}
                        onChange={(e) => setNewDriveTitle(e.target.value)}
                        className="md:col-span-2 border-slate-300 focus:border-purple-500"
                      />
                      <Input
                        placeholder="https://example.com/image"
                        value={newDriveLink}
                        onChange={(e) => setNewDriveLink(e.target.value)}
                        className="md:col-span-3 border-slate-300 focus:border-purple-500"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-slate-300 bg-white text-purple-700 hover:bg-purple-50"
                        onClick={addDriveItem}
                        disabled={!newDriveTitle.trim() && !newDriveLink.trim()}
                      >
                        Add Link
                      </Button>
                    </div>

                    {driveItems.length > 0 && (
                      <div className="space-y-2">
                        {driveItems.map((item, idx) => (
                          <div
                            key={`${item?.link || item?.title || idx}`}
                            className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {item?.title || "(Untitled)"}
                              </p>
                              {item?.link && (
                                <a
                                  href={item.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-purple-600 hover:underline break-all"
                                >
                                  {item.link}
                                </a>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeDriveItem(idx)}
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
              </CardContent>
            </Card>
          )}

          {!isAgent && (
            <>
              {/* FULL FORM for non-agents — Basic */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-blue-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label
                        htmlFor="name"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        className="border-slate-300 focus:border-blue-500"
                        {...register("name", { required: true })}
                      />
                    </div>
                    
                    {/* Keywords Section */}
                    <div className="md:col-span-3">
                      <Label className="text-sm font-medium text-slate-700 mb-2 block">
                        Keywords
                      </Label>
                      <div className="space-y-2">
                        {keywords.map((keyword, idx) => (
                          <div key={idx} className="flex gap-2">
                            <Input
                              value={keyword}
                              onChange={(e) => updateKeyword(idx, e.target.value)}
                              className="border-slate-300 focus:border-blue-500"
                              placeholder={`Keyword-${idx + 1}`}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="border-slate-300 bg-red-500 text-white hover:bg-red-600 hover:text-white hover:border-red-600"
                              onClick={() => removeKeyword(idx)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          className="border-slate-300 bg-linear-to-br from-[#3FB28C] to-[#3FB28C]/60 text-white hover:bg-[#3FB28C] hover:text-white hover:border-[#3FB28C]"
                          onClick={addKeyword}
                        >
                          + Add Keyword
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div>
                        <Label
                          htmlFor="status"
                          className="text-sm font-medium text-slate-700 mb-2 block"
                        >
                          Status
                        </Label>
                        <Select
                          value={statusValue}
                          onValueChange={(value) => setValue("status", value)}
                        >
                          <SelectTrigger className="border-slate-300 focus:border-blue-500">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="in_progress">
                              In Progress
                            </SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paused">Paused</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="mt-6">
                        {statusValue && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "mt-2 font-medium",
                              getStatusColor(statusValue)
                            )}
                          >
                            {statusValue.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label
                        htmlFor="birthdate"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Birth Date
                      </Label>
                      <Input
                        id="birthdate"
                        type="date"
                        className="border-slate-300 focus:border-blue-500"
                        {...register("birthdate")}
                      />
                    </div>

                    <div>
                      <Label
                        htmlFor="gender"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Gender
                      </Label>
                      <Select
                        value={genderValue}
                        onValueChange={(value) => setValue("gender", value)}
                      >
                        <SelectTrigger className="border-slate-300 focus:border-blue-500">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label
                        htmlFor="location"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Location
                      </Label>
                      <Input
                        id="location"
                        className="border-slate-300 focus:border-blue-500"
                        {...register("location")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Professional */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-emerald-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Building className="h-5 w-5 text-emerald-600" />
                    Professional Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="company"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Company
                      </Label>
                      <Input
                        id="company"
                        className="border-slate-300 focus:border-emerald-500"
                        {...register("company")}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="designation"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Designation
                      </Label>
                      <Input
                        id="designation"
                        className="border-slate-300 focus:border-emerald-500"
                        {...register("designation")}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label
                        htmlFor="companyaddress"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Company Address
                      </Label>
                      <Input
                        id="companyaddress"
                        className="border-slate-300 focus:border-emerald-500"
                        {...register("companyaddress")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Account Manager */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-amber-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-amber-600" />
                    Account Manager
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      {isAdmin ? (
                        <>
                          <Label
                            htmlFor="amId"
                            className="text-sm font-medium text-slate-700 mb-2 block"
                          >
                            Assign AM
                          </Label>
                          <Select
                            disabled={amsLoading}
                            onValueChange={(value) =>
                              setValue("amId", value === "none" ? null : value)
                            }
                            value={(watch("amId") ?? currentAmId ?? "none") as any}
                          >
                            <SelectTrigger className="border-slate-300 focus-border-amber-500">
                              <SelectValue
                                placeholder={
                                  amsLoading ? "Loading AMs..." : "— None —"
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="none">No AM (Unassigned)</SelectItem>
                              {ams.map((u) => (
                                <SelectItem key={u.id} value={u.id}>
                                  {u.name || u.email || u.id}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {amsError && (
                            <p className="text-sm text-red-600 mt-1">{amsError}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-slate-500 mt-1">
                          Only administrators can view or modify the Account Manager
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Websites */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-violet-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Globe className="h-5 w-5 text-violet-600" />
                    Websites
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 space-y-3">
                      <Label className="text-sm font-medium text-slate-700 mb-1 block">
                        Websites
                      </Label>
                      {(watch("websites") ?? []).map((_, idx) => (
                        <div key={idx} className="flex gap-2">
                          <Input
                            className="border-slate-300 focus:border-violet-500"
                            {...register(`websites.${idx}` as const)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="border-slate-300 bg-red-500 text-white hover:bg-red-600 hover:text-white hover:border-red-600"
                            onClick={() => {
                              const current = (watch("websites") ??
                                []) as string[];
                              const next = current.filter((_, i) => i !== idx);
                              setValue("websites", next, { shouldDirty: true });
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="border-slate-300 bg-linear-to-br from-[#3FB28C] to-[#3FB28C]/60 text-white hover:bg-[#3FB28C] hover:text-white hover:border-[#3FB28C]"
                        onClick={() => {
                          const current = (watch("websites") ?? []) as string[];
                          setValue("websites", [...current, ""], {
                            shouldDirty: true,
                          });
                        }}
                      >
                        + Add Website
                      </Button>
                    </div>
                    <div>
                      <Label
                        htmlFor="companywebsite"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Company Website
                      </Label>
                      <Input
                        id="companywebsite"
                        className="border-slate-300 focus:border-violet-500"
                        {...register("companywebsite")}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Media / Bio */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-rose-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-rose-600" />
                    Media & Bio
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="avatar"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Avatar URL
                      </Label>
                      <Input
                        id="avatar"
                        className="border-slate-300 focus:border-rose-500"
                        {...register("avatar")}
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="imageDrivelink"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Drive Link
                      </Label>
                      <Input
                        id="imageDrivelink"
                        className="border-slate-300 focus:border-rose-500"
                        value={driveLink}
                        onChange={(e) => setDriveLink(e.target.value)}
                        placeholder="https://drive.google.com/drive/folders/XXXXXXXXXXXX"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-slate-700">
                          Add Image Links (Title + URL)
                        </Label>
                        <span className="text-xs text-slate-500">Optional</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <Input
                          placeholder="Title"
                          value={newDriveTitle}
                          onChange={(e) => setNewDriveTitle(e.target.value)}
                          className="md:col-span-2 border-slate-300 focus:border-rose-500"
                        />
                        <Input
                          placeholder="https://example.com/image"
                          value={newDriveLink}
                          onChange={(e) => setNewDriveLink(e.target.value)}
                          className="md:col-span-3 border-slate-300 focus:border-rose-500"
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          className="border-slate-300 bg-white text-rose-700 hover:bg-rose-50"
                          onClick={addDriveItem}
                          disabled={!newDriveTitle.trim() && !newDriveLink.trim()}
                        >
                          Add Link
                        </Button>
                      </div>

                      {driveItems.length > 0 && (
                        <div className="space-y-2">
                          {driveItems.map((item, idx) => (
                            <div
                              key={`${item?.link || item?.title || "link"}-${idx}`}
                              className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-800 truncate">
                                  {item?.title || "(Untitled)"}
                                </p>
                                {item?.link && (
                                  <a
                                    href={item.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-rose-600 hover:underline break-all"
                                  >
                                    {item.link}
                                  </a>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDriveItem(idx)}
                                className="text-red-600 hover:text-red-700"
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <Label
                        htmlFor="biography"
                        className="text-sm font-medium text-slate-700 mb-2 block"
                      >
                        Biography
                      </Label>
                      {isClient ? (
                        <TinymceEditor
                          initialValue={biographyContent}
                          onContentChange={setBiographyContent}
                          height="200px"
                          placeholder="Enter client biography..."
                        />
                      ) : (
                        <Textarea
                          id="biography"
                          rows={4}
                          className="border-slate-300 focus:border-rose-500"
                          value={biographyContent}
                          onChange={(e) => setBiographyContent(e.target.value)}
                          placeholder="Enter client biography..."
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>


              {/* Other (Category + Title + Data[]) */}
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-linear-to-br from-white to-slate-50/60">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-slate-600" />
                    Other Information
                  </h3>

                  <div className="space-y-4">
                    {otherPairs.map((row, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 p-4 bg-white"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          {/* Category */}
                          <div className="md:col-span-3">
                            <Label className="text-sm font-medium text-slate-700 mb-1 block">
                              Category
                            </Label>
                            <Textarea
                              value={row.category}
                              onChange={(e) =>
                                updateRowField(idx, "category", e.target.value)
                              }
                              rows={1}
                              className="border-slate-300"
                              placeholder="e.g., Publications"
                            />
                          </div>

                          {/* Title */}
                          <div className="md:col-span-3">
                            <Label className="text-sm font-medium text-slate-700 mb-1 block">
                              Title
                            </Label>
                            <Textarea
                              value={row.title}
                              onChange={(e) =>
                                updateRowField(idx, "title", e.target.value)
                              }
                              rows={1}
                              className="border-slate-300"
                              placeholder="e.g., Additional Resources"
                            />
                          </div>

                          {/* Data items */}
                          <div className="md:col-span-5">
                            <Label className="text-sm font-medium text-slate-700 mb-1 block">
                              Data Items
                            </Label>
                            <div className="space-y-2">
                              {row.data.map((d, di) => (
                                <div key={di} className="flex gap-2">
                                  <Textarea
                                    value={d}
                                    onChange={(e) =>
                                      updateDataItem(idx, di, e.target.value)
                                    }
                                    rows={1}
                                    className="border-slate-300 flex-1"
                                    placeholder="Enter link or text"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="border-slate-300 bg-red-500 text-white hover:bg-red-600 hover:text-white hover:border-red-600"
                                    onClick={() => removeDataItem(idx, di)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Remove
                                  </Button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                className="border-slate-300 bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
                                onClick={() => addDataItem(idx)}
                              >
                                + Add Data Item
                              </Button>
                            </div>
                          </div>

                          {/* Remove row */}
                          <div className="md:col-span-1 flex items-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="border-slate-300 bg-red-500 text-white hover:bg-red-600 hover:text-white hover:border-red-600 w-full"
                              onClick={() => removeRow(idx)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-300 bg-linear-to-br from-[#3FB28C] to-[#3FB28C]/60 text-white hover:bg-[#3FB28C] hover:text-white hover:border-[#3FB28C]"
                      onClick={addRow}
                    >
                      + Add Row
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </form>

        <DialogFooter className="px-6 py-4 bg-linear-to-r from-slate-50/70 to-blue-50/70 border-t border-slate-200/70 rounded-b-2xl">
          <Button
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-100"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            form="edit-client-form"
            type="submit"
            className="bg-linear-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
