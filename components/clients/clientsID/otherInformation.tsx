// components/clients/clientsID/otherInformation.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  SpreadsheetEditor,
  splitOtherField,
  type SheetData,
} from "@/components/shared/spreadsheet-editor";

interface OtherInformationProps {
  clientData: {
    id: string;
    otherField?: any;
  };
  onRefreshClient?: () => Promise<any> | void;
  onRegisterCheck?: (
    checkFn: () => boolean,
    handleNavFn: (callback: () => void) => void,
  ) => void;
}

export function OtherInformation({
  clientData,
  onRefreshClient,
  onRegisterCheck,
}: OtherInformationProps) {
  // Sheets are edited; non-sheet items (e.g. system "name_keywords") are kept as-is
  const [parsed, setParsed] = useState(() => splitOtherField(clientData.otherField));
  const [sheets, setSheets] = useState<SheetData[]>(parsed.sheets);
  const sheetsRef = useRef(sheets);

  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const unsavedRef = useRef(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);

  const markUnsaved = (v: boolean) => {
    unsavedRef.current = v;
    setHasUnsavedChanges(v);
  };

  // Reload only when the client or its *saved content* changes. A refetch that
  // returns a new object with identical data must not wipe unsaved edits.
  const loadedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${clientData.id}:${JSON.stringify(clientData.otherField ?? null)}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    const next = splitOtherField(clientData.otherField);
    setParsed(next);
    sheetsRef.current = next.sheets;
    setSheets(next.sheets);
    markUnsaved(false);
  }, [clientData.id, clientData.otherField]);

  const handleChange = (next: SheetData[]) => {
    sheetsRef.current = next;
    setSheets(next);
    markUnsaved(true);
  };

  const handleSave = async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/clients/${clientData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          otherField: [...sheetsRef.current, ...parsed.extras],
        }),
      });

      if (!response.ok) {
        toast.error("Failed to save other information");
        return false;
      }
      toast.success("Other information saved successfully");
      markUnsaved(false);
      if (onRefreshClient) await onRefreshClient();
      return true;
    } catch (error) {
      console.error("Error saving other information:", error);
      toast.error("Failed to save other information");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // ---- unsaved-changes guard (used by the dashboard when switching tabs) ----
  const handleBeforeNavigation = (callback: () => void) => {
    if (unsavedRef.current) {
      pendingNavigationRef.current = callback;
      setShowUnsavedWarning(true);
    } else {
      callback();
    }
  };

  const runPendingNavigation = () => {
    const nav = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    nav?.();
  };

  const handleSaveAndContinue = async () => {
    const ok = await handleSave();
    if (ok) {
      setShowUnsavedWarning(false);
      runPendingNavigation();
    }
  };

  const handleDiscardChanges = () => {
    setShowUnsavedWarning(false);
    const original = splitOtherField(clientData.otherField);
    setParsed(original);
    sheetsRef.current = original.sheets;
    setSheets(original.sheets);
    markUnsaved(false);
    runPendingNavigation();
  };

  const handleCancelNavigation = () => {
    setShowUnsavedWarning(false);
    pendingNavigationRef.current = null;
  };

  // Register once; functions read refs so they never go stale
  const navRef = useRef(handleBeforeNavigation);
  navRef.current = handleBeforeNavigation;
  useEffect(() => {
    onRegisterCheck?.(
      () => unsavedRef.current,
      (cb) => navRef.current(cb),
    );
  }, [onRegisterCheck]);

  // Warn on browser refresh / close with unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  return (
    <Card className="shadow-lg border-0 bg-white dark:bg-slate-800">
      <CardHeader className="bg-linear-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20">
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span>Other Information</span>
            {hasUnsavedChanges && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                Unsaved changes
              </span>
            )}
          </div>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 md:p-6">
        <SpreadsheetEditor value={sheets} onChange={handleChange} maxHeight="65vh" />
      </CardContent>

      {/* Unsaved Changes Warning Dialog */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-white dark:bg-card">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground">
                    Unsaved Changes
                  </h3>
                  <p className="text-sm text-gray-600 mt-1 dark:text-muted-foreground">
                    You have unsaved changes in Other Information. If you navigate
                    away without saving, all your changes will be lost.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button type="button" variant="outline" onClick={handleCancelNavigation}>
                  Stay Here
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDiscardChanges}
                  className="border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/40"
                >
                  Discard Changes
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveAndContinue}
                  disabled={isSaving}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {isSaving ? "Saving..." : "Save & Continue"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}
