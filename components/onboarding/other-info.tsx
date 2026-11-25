// components/onboarding/other-info.tsx

"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table as TableIcon } from "lucide-react";
import type { StepProps } from "@/types/onboarding";
import {
  SpreadsheetEditor,
  splitOtherField,
  type SheetData,
} from "@/components/shared/spreadsheet-editor";

export function OtherInfo({
  formData,
  updateFormData,
  onNext,
  onPrevious,
}: StepProps) {
  // Parse once on mount; non-sheet items (e.g. system entries) are preserved
  const initialRef = useRef<ReturnType<typeof splitOtherField> | null>(null);
  if (!initialRef.current) initialRef.current = splitOtherField(formData.otherField);
  const extras = initialRef.current.extras;

  const [sheets, setSheets] = useState<SheetData[]>(initialRef.current.sheets);
  const sheetsRef = useRef(sheets);

  // Every edit is synced to formData immediately so autosave picks it up and
  // nothing is lost when going back with "Previous".
  const handleChange = (next: SheetData[]) => {
    sheetsRef.current = next;
    setSheets(next);
    updateFormData({ otherField: [...next, ...extras] as any });
  };

  const handleNext = () => {
    // Ensure the (possibly untouched) default sheet is stored too
    updateFormData({ otherField: [...sheetsRef.current, ...extras] as any });
    onNext();
  };

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 shadow-lg ring-1 ring-black/5">
          <TableIcon className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-foreground">
          Campaign Resources
        </h1>
        <p className="mx-auto max-w-2xl text-balance text-sm text-gray-600 dark:text-muted-foreground">
          Works like Google Sheets: click a cell and type, drag to select, paste
          straight from Excel or Google Sheets (Ctrl+V), right-click for row &amp;
          column options, and add sheets at the bottom.
        </p>
      </div>

      <SpreadsheetEditor value={sheets} onChange={handleChange} maxHeight="60vh" />

      {/* Footer Navigation */}
      <div className="flex flex-col gap-3 pt-2 md:flex-row md:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onPrevious}
          className="h-12 rounded-xl border-2 transition-all hover:bg-linear-to-r hover:from-emerald-50 hover:to-teal-50 hover:text-emerald-700 hover:shadow-sm dark:hover:from-emerald-950/40 dark:hover:to-teal-950/40 dark:hover:text-emerald-300"
        >
          <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Previous
        </Button>

        <Button
          type="button"
          onClick={handleNext}
          className="h-12 rounded-xl bg-linear-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg ring-1 ring-black/5 transition-all duration-200 hover:from-emerald-600 hover:to-teal-700 hover:shadow-xl hover:-translate-y-px"
        >
          Continue to Next Step
          <svg className="ml-2 inline-block h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
