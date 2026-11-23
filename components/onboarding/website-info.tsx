"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import type { StepProps } from "@/types/onboarding"
import { Globe, Link as LinkIcon, Plus, Trash2 } from "lucide-react"

export function WebsiteInfo({ formData, updateFormData, onNext, onPrevious }: StepProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-linear-to-br from-blue-500 to-cyan-500 shadow-lg mb-4">
          <Globe className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-linear-to-r from-blue-600 via-cyan-600 to-teal-600 bg-clip-text text-transparent dark:from-blue-400 dark:via-cyan-400 dark:to-teal-400">
          Website Information
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto dark:text-muted-foreground">
          Please provide your website URLs to help us understand your online presence.
        </p>
      </div>

      {/* Websites Card */}
      <div className="bg-linear-to-br from-white to-blue-50/30 rounded-2xl shadow-xl border border-blue-100 p-8 space-y-6 hover:shadow-2xl transition-shadow duration-300 dark:from-card dark:to-blue-950/40 dark:border-blue-800">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-linear-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
            <LinkIcon className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-foreground">Your Websites</h2>
        </div>

        <div className="space-y-6">
          {(formData.websites && formData.websites.length > 0
            ? formData.websites
            : [""]
          ).map((value, idx) => (
            <div key={idx} className="group">
              <Label htmlFor={`website-${idx}`} className="text-sm font-semibold text-gray-700 flex items-center gap-2 dark:text-foreground">
                <Globe className="w-4 h-4 text-blue-500" />
                {idx === 0 ? "Primary Website" : `Website ${idx + 1}`}
              </Label>
              <div className="mt-2 flex gap-2">
                <Input
                  id={`website-${idx}`}
                  value={value || ""}
                  onChange={(e) => {
                    const current = [...(formData.websites ?? [])];
                    // Ensure array has at least idx+1 length
                    const next = current.length ? current : [""];
                    next[idx] = e.target.value;
                    updateFormData({ websites: next });
                  }}
                  placeholder="https://example.com"
                  className="h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 rounded-xl flex-1 dark:border-border"
                  inputMode="url"
                />
                {idx > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 px-4 border-2 bg-linear-to-br from-red-500 to-red-500 hover:from-red-600 hover:to-red-600 text-white hover:text-white"
                    onClick={() => {
                      const current = [...(formData.websites ?? [])];
                      const next = current.filter((_, i) => i !== idx);
                      updateFormData({ websites: next.length ? next : [""] });
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            className="border-2 bg-linear-to-br from-[#0594F8] to-[#6dbcf5] hover:from-[#57aeec] hover:to-[#0594F8] text-white hover:text-white"
            onClick={() => {
              const current = formData.websites ?? [""];
              updateFormData({ websites: [...current, ""] });
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add another website
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="px-8 py-6 text-lg font-semibold border-2 hover:bg-linear-to-r hover:from-blue-50 hover:to-cyan-50 hover:text-blue-700 hover:border-blue-400 transition-all duration-200 rounded-xl dark:hover:from-blue-950/40 dark:hover:to-cyan-950/40 dark:hover:text-blue-300"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          Previous
        </Button>
        <Button
          onClick={onNext}
          className="px-8 py-6 text-lg font-semibold bg-linear-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-700 hover:via-cyan-700 hover:to-teal-700 text-white rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
        >
          Continue to Next Step
          <svg className="w-5 h-5 ml-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
