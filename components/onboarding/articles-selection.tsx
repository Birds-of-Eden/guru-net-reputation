// app/components/onboarding/articles-selection.tsx

"use client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { StepProps, ArticleCategory } from "@/types/onboarding";
import { useEffect, useMemo, useState } from "react";
import { FileText, Plus, Trash2, BookOpen, Link as LinkIcon, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Helper function to get status from used count
const getStatusFromCount = (count: number): string => {
  if (count === 0) return "Not yet Used";
  if (count >= 11) return "More then 10";
  return `Used ${count}`;
};

export function ArticlesSelection({
  formData,
  updateFormData,
  onNext,
  onPrevious,
}: StepProps) {
  // Locally managed categories
  const [categories, setCategories] = useState<ArticleCategory[]>(() =>
    Array.isArray(formData.articleCategories) ? [...formData.articleCategories] : []
  );

  // Sync local categories if parent formData changes while mounted
  useEffect(() => {
    setCategories(
      Array.isArray(formData.articleCategories) ? [...formData.articleCategories] : []
    );
  }, [formData.articleCategories]);

  const handleUpdateCategory = (index: number, value: string) => {
    setCategories((prev) =>
      prev.map((cat, i) => (i === index ? { ...cat, category: value } : cat))
    );
  };

  const handleAddCategory = () => {
    setCategories((prev) => [
      ...prev,
      {
        category: "",
        titles: [],
      },
    ]);
  };

  const handleRemoveCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddTitle = (categoryIndex: number) => {
    setCategories((prev) =>
      prev.map((cat, i) =>
        i === categoryIndex
          ? {
              ...cat,
              titles: [
                ...cat.titles,
                { 
                  title: "", 
                  draftLink: "", 
                  draftStatus: "Pending" as const,
                  status: "Not yet Used",
                  usedCount: 0,
                  usedDate: null,
                },
              ],
            }
          : cat
      )
    );
  };

  const handleRemoveTitle = (categoryIndex: number, titleIndex: number) => {
    setCategories((prev) =>
      prev.map((cat, i) =>
        i === categoryIndex
          ? {
              ...cat,
              titles: cat.titles.filter((_, ti) => ti !== titleIndex),
            }
          : cat
      )
    );
  };

  const handleUpdateTitle = (
    categoryIndex: number,
    titleIndex: number,
    field: "title" | "draftLink" | "draftStatus" | "status" | "usedCount" | "usedDate",
    value: string
  ) => {
    setCategories((prev) =>
      prev.map((cat, i) =>
        i === categoryIndex
          ? {
              ...cat,
              titles: cat.titles.map((title, ti) => {
                if (ti === titleIndex) {
                  const updated = { ...title, [field]: field === "usedCount" ? (value === "" ? 0 : Number(value)) : value };
                  if (field === "usedCount") {
                    const count = Number(updated.usedCount) || 0;
                    updated.status = getStatusFromCount(count);
                  }
                  return updated;
                }
                return title;
              }),
            }
          : cat
      )
    );
  };

  const handleNext = () => {
    // Normalize categories: trim and filter empty entries
    const normalizedCategories = categories
      .map((cat) => ({
        category: (cat.category || "").trim(),
        titles: cat.titles
          .map((t) => ({
            title: (t.title || "").trim(),
            draftLink: (t.draftLink || "").trim(),
            draftStatus: t.draftStatus,
            status: t.status,
            usedCount: t.usedCount,
            usedDate: t.usedDate,
          }))
          .filter((t) => t.title.length > 0),
      }))
      .filter((cat) => cat.category.length > 0 && cat.titles.length > 0);

    updateFormData({
      articleCategories: normalizedCategories,
    });
    onNext();
  };

  const hasCategories = useMemo(() => (categories?.length ?? 0) > 0, [categories]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 shadow-lg mb-4">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-rose-600 bg-clip-text text-transparent">
          Article Topics from CQ
        </h1>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Manage your article categories with titles, draft links, and status tracking.
        </p>
      </div>

      {/* Categories Card */}
      <div className="bg-gradient-to-br from-white to-orange-50/30 rounded-2xl shadow-xl border border-orange-100 p-8 space-y-6 hover:shadow-2xl transition-shadow duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Article Categories</h2>
            <p className="text-sm text-gray-600">
              Add categories with titles and draft information
            </p>
          </div>
        </div>

        {!hasCategories && (
          <div className="text-center py-12 border-2 border-dashed border-orange-200 rounded-xl bg-orange-50/50">
            <BookOpen className="w-12 h-12 text-orange-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">
              No categories yet. Add a topic from CQ to get started.
            </p>
          </div>
        )}

        {hasCategories && (
          <div className="space-y-6">
            {categories.map((category, catIdx) => (
              <div
                key={`category-${catIdx}`}
                className="bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-orange-300 hover:shadow-lg transition-all duration-200"
              >
                {/* Category Header */}
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-1">
                    <Label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-orange-500" />
                      Category Name
                    </Label>
                    <Input
                      className="w-full border-2 border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 rounded-xl px-4 py-3"
                      value={category.category}
                      onChange={(e) =>
                        handleUpdateCategory(catIdx, e.target.value)
                      }
                      placeholder="e.g. Technology, Business, Health..."
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveCategory(catIdx)}
                    className="h-10 w-10 text-red-500 hover:text-white hover:bg-red-500 border-2 border-red-300 hover:border-red-500 rounded-xl transition-all duration-200 flex-shrink-0 mt-7"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>

                {/* Titles under this category */}
                <div className="space-y-3 ml-4 pl-4 border-l-2 border-orange-200">
                  {category.titles.length === 0 && (
                    <p className="text-sm text-gray-500 italic py-2">
                      No titles yet. Add titles to this category.
                    </p>
                  )}
                  
                  {category.titles.map((title, titleIdx) => (
                    <div
                      key={`title-${catIdx}-${titleIdx}`}
                      className="bg-orange-50/50 rounded-lg p-4 space-y-3 border border-orange-100"
                    >
                      <div className="grid md:grid-cols-2 gap-3 items-end">
                        <div className="flex-1 space-y-3">
                          {/* Title */}
                          <div>
                            <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                              Title
                            </Label>
                            <Input
                              className="w-full border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 rounded-lg px-3 py-2 text-sm"
                              value={title.title}
                              onChange={(e) =>
                                handleUpdateTitle(
                                  catIdx,
                                  titleIdx,
                                  "title",
                                  e.target.value
                                )
                              }
                              placeholder="Article title..."
                            />
                          </div>

                          {/* Draft Link */}
                          <div>
                            <Label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                              <LinkIcon className="w-3 h-3" />
                              Draft Link
                            </Label>
                            <Input
                              className="w-full border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 rounded-lg px-3 py-2 text-sm"
                              value={title.draftLink}
                              onChange={(e) =>
                                handleUpdateTitle(
                                  catIdx,
                                  titleIdx,
                                  "draftLink",
                                  e.target.value
                                )
                              }
                              placeholder="https://..."
                            />
                          </div>

                          {/* Draft Status */}
                          <div>
                            <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                              Draft Status
                            </Label>
                            <Select
                              value={title.draftStatus}
                              onValueChange={(value) =>
                                handleUpdateTitle(
                                  catIdx,
                                  titleIdx,
                                  "draftStatus",
                                  value
                                )
                              }
                            >
                              <SelectTrigger className="w-full border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 rounded-lg text-sm">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Approved">Approved</SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Revision">Revision</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Status */}
                          <div>
                            <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                              Status
                            </Label>
                            <Input
                              className="w-full border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 rounded-lg px-3 py-2 text-sm"
                              value={title.status || "Not yet Used"}
                              onChange={(e) =>
                                handleUpdateTitle(
                                  catIdx,
                                  titleIdx,
                                  "status",
                                  e.target.value
                                )
                              }
                              placeholder="Status"
                            />
                          </div>

                          {/* Used Count */}
                          <div>
                            <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                              Used Count
                            </Label>
                            <Input
                              type="number"
                              className="w-full border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 rounded-lg px-3 py-2 text-sm"
                              value={title.usedCount ?? 0}
                              onChange={(e) =>
                                handleUpdateTitle(
                                  catIdx,
                                  titleIdx,
                                  "usedCount",
                                  e.target.value
                                )
                              }
                              placeholder="0"
                            />
                          </div>

                          {/* Used Date */}
                          <div>
                            <Label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Used Date
                            </Label>
                            <Input
                              type="date"
                              className="w-full border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 rounded-lg px-3 py-2 text-sm"
                              value={
                                title.usedDate
                                  ? new Date(title.usedDate).toISOString().split("T")[0]
                                  : ""
                              }
                              onChange={(e) =>
                                handleUpdateTitle(
                                  catIdx,
                                  titleIdx,
                                  "usedDate",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleRemoveTitle(catIdx, titleIdx)}
                          className="h-8 w-8 text-red-500 hover:text-white hover:bg-red-500 border border-red-300 hover:border-red-500 rounded-lg transition-all duration-200 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Add Title Button */}
                  <Button
                    onClick={() => handleAddTitle(catIdx)}
                    variant="outline"
                    className="w-full mt-2 border-2 border-dashed border-orange-300 hover:border-orange-500 hover:bg-orange-50 text-orange-600 rounded-lg"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Title
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Category Button */}
        <div className="mt-6">
          <Button
            onClick={handleAddCategory}
            className="w-full h-14 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Topic From CQ
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button
          variant="outline"
          onClick={onPrevious}
          className="px-8 py-6 text-lg font-semibold border-2 hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 hover:text-orange-700 hover:border-orange-400 transition-all duration-200 rounded-xl"
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
        <Button
          onClick={handleNext}
          className="px-8 py-6 text-lg font-semibold bg-gradient-to-r from-orange-600 via-red-600 to-rose-600 hover:from-orange-700 hover:via-red-700 hover:to-rose-700 text-white rounded-xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
        >
          Continue to Next Step
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
  );
}
