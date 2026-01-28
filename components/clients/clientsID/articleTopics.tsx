//lint error fixed
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  List as ListIcon,
  FileText,
  Pencil,
  Save,
  X,
  Trash2,
  Plus,
  Link as LinkIcon,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hasPermissionClient } from "@/lib/permissions-client";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

interface ArticleTopic {
  status: string;
  usedDate: string | null;
  topicname: string;
  usedCount: number;
}

interface ArticleCategory {
  category: string;
  titles: Array<{
    title: string;
    draftLink: string;
    draftStatus: "Approved" | "Pending" | "Revision";
  }>;
}

interface ArticleTopicsProps {
  clientData: {
    id: string;
    articleTopics?: ArticleTopic[] | ArticleCategory[];
  };
  onRefreshClient?: () => void | Promise<void>;
}

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case "Used":
      return "bg-green-200 text-green-800 dark:bg-green-800/50 dark:text-green-200";
    case "Not yet Used":
      return "bg-yellow-200 text-yellow-800 dark:bg-yellow-800/50 dark:text-yellow-200";
    default:
      return "bg-gray-200 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200";
  }
};

// Helper function to get status from used count
const getStatusFromCount = (count: number): string => {
  if (count === 0) return "Not yet Used";
  if (count >= 11) return "More then 10";
  return `Used ${count}`;
};
const isNewStructure = (data: any): data is ArticleCategory[] => {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    "category" in data[0] &&
    "titles" in data[0]
  );
};

export const ArticleTopics = ({
  clientData,
  onRefreshClient,
}: ArticleTopicsProps) => {
  // Detect which structure is being used and initialize states accordingly
  const dataIsNewStructure = isNewStructure(clientData.articleTopics);

  // State for old structure (backward compatibility)
  const [topics, setTopics] = useState<ArticleTopic[]>(
    !dataIsNewStructure && Array.isArray(clientData.articleTopics)
      ? (clientData.articleTopics as ArticleTopic[])
      : [],
  );

  // State for new structure
  const [categories, setCategories] = useState<ArticleCategory[]>(
    dataIsNewStructure ? (clientData.articleTopics as ArticleCategory[]) : [],
  );

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedTopic, setEditedTopic] = useState<ArticleTopic | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newTopic, setNewTopic] = useState<ArticleTopic>({
    topicname: "",
    status: "Not yet Used",
    usedCount: 0,
    usedDate: null,
  });

  const [newTopicCategory, setNewTopicCategory] = useState<ArticleCategory>({
    category: "",
    titles: [],
  });

  const [editingCategoryIdx, setEditingCategoryIdx] = useState<number | null>(
    null,
  );
  const [editingTitleIdx, setEditingTitleIdx] = useState<number | null>(null);

  const { user } = useAuth();
  const router = useRouter();

  const triggerRefresh = async () => {
    if (onRefreshClient) {
      await Promise.resolve(onRefreshClient());
    } else {
      router.refresh();
    }
  };

  // Check if using new structure
  const hasNewStructure = categories.length > 0;

  // Function to handle enabling inline editing
  const handleEditClick = (topic: ArticleTopic, index: number) => {
    setEditingIndex(index);
    setEditedTopic(topic);
    setIsAdding(false);
  };

  // Function to handle changes in the form inputs for inline editing
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setEditedTopic((prevTopic) => {
      if (!prevTopic) return null;
      const updated = {
        ...prevTopic,
        [name]:
          name === "usedCount" ? (value === "" ? 0 : Number(value)) : value,
      };
      if (name === "usedCount") {
        updated.status = getStatusFromCount(updated.usedCount);
      }
      return updated;
    });
  };

  // Function to handle saving the edited topic
  const handleSave = () => {
    if (editedTopic && editingIndex !== null) {
      const updatedTopics = topics.map((topic, index) => {
        if (index === editingIndex) {
          return {
            ...editedTopic,
            usedCount: parseInt(String(editedTopic.usedCount), 10) || 0,
          };
        }
        return topic;
      });
      setTopics(updatedTopics);

      // In a real-world app, you'd make an API call to persist the data here

      setEditingIndex(null);
      setEditedTopic(null);
    }
  };

  // Function to handle canceling the edit
  const handleCancel = () => {
    setEditingIndex(null);
    setEditedTopic(null);
  };

  // Function to handle deleting a topic
  const handleDelete = (indexToDelete: number) => {
    const updatedTopics = topics.filter((_, index) => index !== indexToDelete);
    setTopics(updatedTopics);
  };

  // Function to handle adding a new topic
  const handleAddTopic = async () => {
    // sanitize values
    const sanitized: ArticleTopic = {
      topicname: (newTopic.topicname || "").trim(),
      status: newTopic.status || "Not yet Used",
      usedCount: Number.isFinite(Number(newTopic.usedCount))
        ? Number(newTopic.usedCount)
        : 0,
      usedDate: newTopic.usedDate || null,
    };

    const updatedTopics = [...topics, sanitized];

    // Optimistically update UI
    setTopics(updatedTopics);

    try {
      const res = await fetch(`/api/clients/${clientData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleTopics: updatedTopics }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save: ${res.status}`);
      }

      // Optionally, sync with server response
      const data = await res.json();
      if (Array.isArray(data.articleTopics)) {
        setTopics(data.articleTopics as ArticleTopic[]);
      }

      // Reset form and close modal
      setNewTopic({
        topicname: "",
        status: "Not yet Used",
        usedCount: 0,
        usedDate: null,
      });
      await triggerRefresh();
      setIsAdding(false);
    } catch (err) {
      console.error(err);
      // Revert optimistic update on error
      setTopics(topics);
      // Keep the modal open so user can retry
    }
  };

  // Function to handle changes in the form inputs for adding
  const handleNewTopicInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setNewTopic((prevTopic) => {
      const updated = {
        ...prevTopic,
        [name]:
          name === "usedCount" ? (value === "" ? 0 : Number(value)) : value,
      };
      if (name === "usedCount") {
        updated.status = getStatusFromCount(updated.usedCount);
      }
      return updated;
    });
  };

  // --- NEW HANDLERS FOR ARTICLE CATEGORIES ---

  const handleAddCategory = async () => {
    if (!newTopicCategory.category.trim()) {
      toast.error("Category name is required");
      return;
    }

    if (newTopicCategory.titles.length === 0) {
      toast.error("At least one title is required");
      return;
    }

    const updatedCategories = [...categories, newTopicCategory];
    setCategories(updatedCategories);

    try {
      const res = await fetch(`/api/clients/${clientData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleCategories: updatedCategories }),
      });

      if (!res.ok) throw new Error(`Failed to save: ${res.status}`);

      const data = await res.json();
      if (Array.isArray(data.articleTopics)) {
        setCategories(data.articleTopics as ArticleCategory[]);
      }

      toast.success("Category added successfully!");
      await triggerRefresh();
      setNewTopicCategory({ category: "", titles: [] });
      setIsAddingCategory(false);
    } catch (err) {
      console.error(err);
      setCategories(categories);
      toast.error("Failed to add category");
    }
  };

  const handleDeleteCategory = async (categoryIdx: number) => {
    const updatedCategories = categories.filter((_, i) => i !== categoryIdx);
    setCategories(updatedCategories);

    try {
      const res = await fetch(`/api/clients/${clientData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleTopics: updatedCategories }),
      });

      if (!res.ok) throw new Error(`Failed to save`);
      toast.success("Category deleted!");
      await triggerRefresh();
    } catch (err) {
      console.error(err);
      setCategories(categories);
      toast.error("Failed to delete category");
    }
  };

  const handleAddTitleToNewCategory = () => {
    setNewTopicCategory((prev) => ({
      ...prev,
      titles: [
        ...prev.titles,
        { title: "", draftLink: "", draftStatus: "Pending" as const },
      ],
    }));
  };

  // === Inline Edit for Existing Categories (mirror onboarding behavior) ===
  const handleUpdateCategoryName = (catIdx: number, value: string) => {
    setCategories((prev) =>
      prev.map((c, i) => (i === catIdx ? { ...c, category: value } : c)),
    );
  };

  const handleAddTitleToCategory = (catIdx: number) => {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIdx
          ? {
              ...c,
              titles: [
                ...c.titles,
                { title: "", draftLink: "", draftStatus: "Pending" as const },
              ],
            }
          : c,
      ),
    );
  };

  const handleRemoveTitleFromCategory = (catIdx: number, titleIdx: number) => {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIdx
          ? { ...c, titles: c.titles.filter((_, ti) => ti !== titleIdx) }
          : c,
      ),
    );
  };

  const handleUpdateTitleInCategory = (
    catIdx: number,
    titleIdx: number,
    field: "title" | "draftLink" | "draftStatus",
    value: string,
  ) => {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIdx
          ? {
              ...c,
              titles: c.titles.map((t, ti) =>
                ti === titleIdx ? { ...t, [field]: value } : t,
              ),
            }
          : c,
      ),
    );
  };

  const saveCategories = async () => {
    try {
      // Normalize before save: trim strings, drop empty titles
      const normalized = categories
        .map((cat) => ({
          category: (cat.category || "").trim(),
          titles: cat.titles
            .map((t) => ({
              title: (t.title || "").trim(),
              draftLink: (t.draftLink || "").trim(),
              draftStatus: t.draftStatus,
            }))
            .filter((t) => t.title.length > 0),
        }))
        .filter((cat) => cat.category.length > 0);

      const res = await fetch(`/api/clients/${clientData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleCategories: normalized }),
      });
      if (!res.ok) throw new Error("Failed to save categories");
      const data = await res.json();
      if (Array.isArray(data.articleTopics)) {
        setCategories(data.articleTopics as ArticleCategory[]);
      }
      toast.success("Saved successfully");
      await triggerRefresh();
    } catch (e) {
      console.error(e);
      toast.error("Save failed");
    }
  };

  return (
    <Card className="shadow-lg border-0 bg-white dark:bg-slate-800 lg:col-span-2">
      <CardHeader className="bg-gradient-to-r from-orange-500/10 to-red-500/10 dark:from-orange-500/20 dark:to-red-500/20">
        <CardTitle className="flex items-center space-x-2">
          <BookOpen className="h-5 w-5 text-orange-600" />
          <span>
            {hasNewStructure ? "Article Categories from CQ" : "Article Topics"}
          </span>
          {hasNewStructure && categories.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {categories.length}
            </Badge>
          )}
          {!hasNewStructure && topics.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {topics.length}
            </Badge>
          )}
          <button
            type="button"
            onClick={() =>
              hasNewStructure ? setIsAddingCategory(true) : setIsAdding(true)
            }
            className="ml-auto inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-orange-500 to-red-500 px-3 py-2 text-sm font-medium text-white hover:from-orange-600 hover:to-red-600 transition-colors"
            title={hasNewStructure ? "Add Topic From CQ" : "Add Topic"}
          >
            <Plus size={16} />
            {hasNewStructure ? "Add Topic From CQ" : "Add Topic"}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {hasNewStructure ? (
          // New Structure: Article Categories
          categories.length > 0 ? (
            <div className="space-y-6">
              {categories.map((category, catIdx) => (
                <div
                  key={catIdx}
                  className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border-2 border-orange-200 dark:border-orange-700 p-5"
                >
                  <div className="flex items-start gap-3 mb-4">
                    <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-orange-600" /> Category
                      Name
                    </Label>
                    <Input
                      className="flex-1 border-2 border-gray-200 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 rounded-xl px-3 py-2"
                      value={category.category}
                      onChange={(e) =>
                        handleUpdateCategoryName(catIdx, e.target.value)
                      }
                      placeholder="e.g. Technology"
                    />
                    {hasPermissionClient(
                      user?.permissions,
                      "delete_article_topic",
                    ) && (
                      <button
                        onClick={() => handleDeleteCategory(catIdx)}
                        className="ml-auto text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        title="Delete Category"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 ml-4 pl-4 border-l-2 border-orange-200">
                    {category.titles.map((title, titleIdx) => (
                      <div
                        key={titleIdx}
                        className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-orange-200 dark:border-orange-700"
                      >
                        <div className="grid md:grid-cols-3 gap-3 items-end">
                          <div>
                            <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                              Title
                            </Label>
                            <Input
                              className="w-full border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 rounded-lg px-3 py-2 text-sm"
                              value={title.title}
                              onChange={(e) =>
                                handleUpdateTitleInCategory(
                                  catIdx,
                                  titleIdx,
                                  "title",
                                  e.target.value,
                                )
                              }
                              placeholder="Article title..."
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1">
                              <LinkIcon className="w-3 h-3" /> Draft Link
                            </Label>
                            <Input
                              className="w-full border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 rounded-lg px-3 py-2 text-sm"
                              value={title.draftLink}
                              onChange={(e) =>
                                handleUpdateTitleInCategory(
                                  catIdx,
                                  titleIdx,
                                  "draftLink",
                                  e.target.value,
                                )
                              }
                              placeholder="https://..."
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-gray-600 mb-1 block">
                              Draft Status
                            </Label>
                            <Select
                              value={title.draftStatus}
                              onValueChange={(value) =>
                                handleUpdateTitleInCategory(
                                  catIdx,
                                  titleIdx,
                                  "draftStatus",
                                  value,
                                )
                              }
                            >
                              <SelectTrigger className="w-full border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 rounded-lg text-sm">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Approved">
                                  Approved
                                </SelectItem>
                                <SelectItem value="Pending">Pending</SelectItem>
                                <SelectItem value="Revision">
                                  Revision
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex justify-end mt-3">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              handleRemoveTitleFromCategory(catIdx, titleIdx)
                            }
                            className="h-8 w-8 text-red-500 hover:text-white hover:bg-red-500 border border-red-300 hover:border-red-500 rounded-lg transition-all duration-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <Button
                      onClick={() => handleAddTitleToCategory(catIdx)}
                      variant="outline"
                      className="w-full mt-2 border-2 border-dashed border-orange-300 hover:border-orange-500 hover:bg-orange-50 text-orange-600 rounded-lg"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Title
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <Button
                  onClick={saveCategories}
                  className="mt-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                >
                  <Save className="h-4 w-4 mr-2" /> Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 flex-col p-4 text-slate-500 dark:text-slate-400 italic">
              <BookOpen className="h-8 w-8" />
              <p className="text-base">No article categories found.</p>
              <button
                onClick={() => setIsAddingCategory(true)}
                className="mt-4 flex items-center gap-2 rounded-md bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 text-sm font-medium text-white hover:from-orange-600 hover:to-red-600 transition-colors"
              >
                <Plus size={16} />
                Add First Category
              </button>
            </div>
          )
        ) : // Old Structure: Article Topics (Backward Compatibility)
        topics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse">
              <thead className="text-left text-sm font-medium text-slate-600 dark:text-slate-400">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3">Article Topic</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Used Count</th>
                  <th className="p-3 whitespace-nowrap">Last Used</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {topics.map((topic, index) => (
                  <tr
                    key={index}
                    className="hover:bg-slate-100/50 dark:hover:bg-slate-700/50 transition-colors"
                  >
                    <td className="p-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {editingIndex === index ? (
                        <input
                          type="text"
                          name="topicname"
                          value={editedTopic?.topicname || ""}
                          onChange={handleInputChange}
                          className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm p-1"
                        />
                      ) : (
                        topic.topicname || "(Untitled)"
                      )}
                    </td>
                    <td className="p-3">
                      {editingIndex === index ? (
                        <select
                          name="status"
                          value={editedTopic?.status || "Not yet Used"}
                          onChange={handleInputChange}
                          className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm p-1"
                        >
                          <option value="Not yet Used">Not yet Used</option>
                          <option value="Used 1">Used 1</option>
                          <option value="Used 2">Used 2</option>
                          <option value="Used 3">Used 3</option>
                          <option value="Used 4">Used 4</option>
                          <option value="Used 5">Used 5</option>
                          <option value="Used 6">Used 6</option>
                          <option value="Used 7">Used 7</option>
                          <option value="Used 8">Used 8</option>
                          <option value="Used 9">Used 9</option>
                          <option value="Used 10">Used 10</option>
                          <option value="More then 10">More then 10</option>
                        </select>
                      ) : (
                        <Badge
                          className={`font-bold ${getStatusBadgeClass(
                            topic.status,
                          )}`}
                        >
                          {topic.status}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-sm text-slate-700 dark:text-slate-300">
                      {editingIndex === index ? (
                        <input
                          type="number"
                          name="usedCount"
                          value={editedTopic?.usedCount ?? 0}
                          onChange={handleInputChange}
                          className="w-20 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm p-1"
                        />
                      ) : (
                        (topic.usedCount ?? "N/A")
                      )}
                    </td>
                    <td className="p-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {editingIndex === index ? (
                        <input
                          type="date"
                          name="usedDate"
                          value={
                            editedTopic?.usedDate
                              ? new Date(editedTopic.usedDate)
                                  .toISOString()
                                  .split("T")[0]
                              : ""
                          }
                          onChange={handleInputChange}
                          className="w-32 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-sm p-1"
                        />
                      ) : topic.usedDate ? (
                        new Date(topic.usedDate).toLocaleDateString()
                      ) : (
                        "N/A"
                      )}
                    </td>
                    <td className="p-3">
                      {editingIndex === index ? (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={handleSave}
                            className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 transition-colors"
                            title="Save Changes"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={handleCancel}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditClick(topic, index)}
                            className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                            title="Edit Topic"
                          >
                            <Pencil size={16} />
                          </button>
                          {hasPermissionClient(
                            user?.permissions,
                            "delete_article_topic",
                          ) && (
                            <button
                              onClick={() => handleDelete(index)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                              title="Delete Topic"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 flex-col p-4 text-slate-500 dark:text-slate-400 italic">
            <ListIcon className="h-8 w-8" />
            <p className="text-base">No article topics found.</p>
            <button
              onClick={() => setIsAdding(true)}
              className="mt-4 flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
              Add First Topic
            </button>
          </div>
        )}
      </CardContent>

      {/* Add New Category Modal */}
      {isAddingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Add New Category
              </h2>
              <button
                onClick={() => {
                  setIsAddingCategory(false);
                  setNewTopicCategory({ category: "", titles: [] });
                }}
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Category Name</Label>
                <Input
                  value={newTopicCategory.category}
                  onChange={(e) =>
                    setNewTopicCategory((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  placeholder="e.g. Technology, Business..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Titles</Label>
                <div className="space-y-3">
                  {newTopicCategory.titles.map(
                    (
                      title: {
                        title: string;
                        draftLink: string;
                        draftStatus: "Approved" | "Pending" | "Revision";
                      },
                      idx: number,
                    ) => (
                      <div
                        key={idx}
                        className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-sm font-semibold">
                            Title {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setNewTopicCategory((prev: ArticleCategory) => ({
                                ...prev,
                                titles: prev.titles.filter((_, i) => i !== idx),
                              }));
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div>
                          <Label className="text-xs">Title</Label>
                          <Input
                            value={title.title}
                            onChange={(e) =>
                              setNewTopicCategory((prev: ArticleCategory) => ({
                                ...prev,
                                titles: prev.titles.map((t, i) =>
                                  i === idx
                                    ? { ...t, title: e.target.value }
                                    : t,
                                ),
                              }))
                            }
                            placeholder="Article title..."
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-xs">Draft Link</Label>
                          <Input
                            value={title.draftLink}
                            onChange={(e) =>
                              setNewTopicCategory((prev: ArticleCategory) => ({
                                ...prev,
                                titles: prev.titles.map((t, i) =>
                                  i === idx
                                    ? { ...t, draftLink: e.target.value }
                                    : t,
                                ),
                              }))
                            }
                            placeholder="https://..."
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-xs">Draft Status</Label>
                          <Select
                            value={title.draftStatus}
                            onValueChange={(
                              value: "Approved" | "Pending" | "Revision",
                            ) =>
                              setNewTopicCategory((prev: ArticleCategory) => ({
                                ...prev,
                                titles: prev.titles.map((t, i) =>
                                  i === idx ? { ...t, draftStatus: value } : t,
                                ),
                              }))
                            }
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Approved">Approved</SelectItem>
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="Revision">Revision</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ),
                  )}

                  <button
                    type="button"
                    onClick={handleAddTitleToNewCategory}
                    className="w-full py-2 border-2 border-dashed border-orange-300 rounded-lg text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Add Title
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingCategory(false);
                    setNewTopicCategory({ category: "", titles: [] });
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-4 py-2 text-sm font-medium rounded-md text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 transition-colors"
                >
                  Add Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Topic Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Add New Topic
              </h2>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewTopic({
                    topicname: "",
                    status: "Not yet Used",
                    usedCount: 0,
                    usedDate: null,
                  });
                }}
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Category Name</Label>
                <Input
                  value={newTopicCategory.category}
                  onChange={(e) =>
                    setNewTopicCategory((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  placeholder="e.g. Technology, Business..."
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Titles</Label>
                <div className="space-y-3">
                  {newTopicCategory.titles.map((title, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-semibold">
                          Title {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewTopicCategory((prev) => ({
                              ...prev,
                              titles: prev.titles.filter((_, i) => i !== idx),
                            }));
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div>
                        <Label className="text-xs">Title</Label>
                        <Input
                          value={title.title}
                          onChange={(e) => {
                            setNewTopicCategory((prev) => ({
                              ...prev,
                              titles: prev.titles.map((t, i) =>
                                i === idx ? { ...t, title: e.target.value } : t,
                              ),
                            }));
                          }}
                          placeholder="Article title..."
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Draft Link</Label>
                        <Input
                          value={title.draftLink}
                          onChange={(e) => {
                            setNewTopicCategory((prev) => ({
                              ...prev,
                              titles: prev.titles.map((t, i) =>
                                i === idx
                                  ? { ...t, draftLink: e.target.value }
                                  : t,
                              ),
                            }));
                          }}
                          placeholder="https://..."
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Draft Status</Label>
                        <Select
                          value={title.draftStatus}
                          onValueChange={(
                            value: "Approved" | "Pending" | "Revision",
                          ) => {
                            setNewTopicCategory((prev) => ({
                              ...prev,
                              titles: prev.titles.map((t, i) =>
                                i === idx ? { ...t, draftStatus: value } : t,
                              ),
                            }));
                          }}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Approved">Approved</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Revision">Revision</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setNewTopicCategory((prev) => ({
                        ...prev,
                        titles: [
                          ...prev.titles,
                          { title: "", draftLink: "", draftStatus: "Pending" },
                        ],
                      }));
                    }}
                    className="w-full py-2 border-2 border-dashed border-orange-300 rounded-lg text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Add Title
                  </button>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setNewTopicCategory({ category: "", titles: [] });
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Create category with titles
                    const categoryName = newTopicCategory.category.trim();
                    const titles = newTopicCategory.titles;

                    if (!categoryName) {
                      toast.error("Category name is required");
                      return;
                    }

                    if (titles.length === 0) {
                      toast.error("At least one title is required");
                      return;
                    }

                    const newCategoryData = {
                      category: categoryName,
                      titles: titles
                        .filter((t) => t.title.trim())
                        .map((t) => ({
                          title: t.title.trim(),
                          draftLink: t.draftLink.trim(),
                          draftStatus: t.draftStatus,
                        })),
                    };

                    const updatedCategories = [...categories, newCategoryData];
                    setCategories(updatedCategories);

                    fetch(`/api/clients/${clientData.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        articleCategories: updatedCategories,
                      }),
                    })
                      .then(async (res) => {
                        if (!res.ok) throw new Error("Failed to save");
                        toast.success("Category added successfully!");
                        await triggerRefresh();
                        setIsAdding(false);
                        setNewTopicCategory({ category: "", titles: [] });
                      })
                      .catch((err) => {
                        console.error(err);
                        setCategories(categories);
                        toast.error("Failed to add category");
                      });
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-md text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 transition-colors"
                >
                  Add Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
