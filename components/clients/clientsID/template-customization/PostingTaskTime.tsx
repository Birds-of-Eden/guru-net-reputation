// components/clients/clientsID/template-customization/PostingTaskTime.tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Save } from "lucide-react";

interface TaskDurationRule {
  match: string;
  minutes: number;
}

interface TaskDurationCategory {
  default: number;
  rules: TaskDurationRule[];
}

interface TaskDurationConfig {
  blogPosting: TaskDurationCategory;
  socialActivity: TaskDurationCategory;
}

interface PostingTaskDurationSettingsModalProps {
  onClose?: () => void;
}

export default function PostingTaskDurationSettingsModal({ onClose }: PostingTaskDurationSettingsModalProps) {
  const [config, setConfig] = useState<TaskDurationConfig>({
    blogPosting: { default: 20, rules: [] },
    socialActivity: { default: 10, rules: [] },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch config on mount
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/settings/task-duration");
      const result = await response.json();
      
      if (result.success) {
        setConfig(result.data);
      } else {
        toast.error("Failed to load task duration configuration");
      }
    } catch (error) {
      toast.error("Error loading configuration");
    } finally {
      setLoading(false);
    }
  };

  const updateDefault = (category: "blogPosting" | "socialActivity", value: number) => {
    if (value <= 0) return;
    
    setConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        default: value
      }
    }));
  };

  const updateRule = (
    category: "blogPosting" | "socialActivity",
    index: number,
    field: "match" | "minutes",
    value: string | number
  ) => {
    if (field === "minutes" && (typeof value === "number" ? value : parseInt(value)) <= 0) {
      return;
    }
    
    if (field === "match" && (typeof value === "string" ? value : "").trim() === "") {
      return;
    }

    setConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        rules: prev[category].rules.map((rule, i) =>
          i === index
            ? { ...rule, [field]: field === "minutes" ? parseInt(value as string) || 0 : value }
            : rule
        )
      }
    }));
  };

  const addRule = (category: "blogPosting" | "socialActivity") => {
    setConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        rules: [...prev[category].rules, { match: "", minutes: 5 }]
      }
    }));
  };

  const deleteRule = (category: "blogPosting" | "socialActivity", index: number) => {
    setConfig(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        rules: prev[category].rules.filter((_, i) => i !== index)
      }
    }));
  };

  const saveConfig = async () => {
    // Validation
    const validationErrors: string[] = [];
    
    if (config.blogPosting.default <= 0) {
      validationErrors.push("Blog Posting default duration must be greater than 0");
    }
    
    if (config.socialActivity.default <= 0) {
      validationErrors.push("Social Activity default duration must be greater than 0");
    }
    
    config.blogPosting.rules.forEach((rule, i) => {
      if (!rule.match.trim()) {
        validationErrors.push(`Blog Posting rule ${i + 1}: Match keyword cannot be empty`);
      }
      if (rule.minutes <= 0) {
        validationErrors.push(`Blog Posting rule ${i + 1}: Minutes must be greater than 0`);
      }
    });
    
    config.socialActivity.rules.forEach((rule, i) => {
      if (!rule.match.trim()) {
        validationErrors.push(`Social Activity rule ${i + 1}: Match keyword cannot be empty`);
      }
      if (rule.minutes <= 0) {
        validationErrors.push(`Social Activity rule ${i + 1}: Minutes must be greater than 0`);
      }
    });
    
    if (validationErrors.length > 0) {
      toast.error("Validation errors:\n" + validationErrors.join("\n"));
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/settings/task-duration", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success("Task duration configuration saved successfully!");
        onClose?.();
      } else {
        toast.error("Failed to save configuration");
      }
    } catch (error) {
      toast.error("Error saving configuration");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Task Duration Settings</h1>
        <Button onClick={saveConfig} disabled={saving} className="flex items-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Blog Posting Section */}
      <Card>
        <CardHeader>
          <CardTitle>Blog Posting Durations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="font-medium">Default Duration (minutes):</label>
            <Input
              type="number"
              min="1"
              value={config.blogPosting.default}
              onChange={(e) => updateDefault("blogPosting", parseInt(e.target.value) || 0)}
              className="w-32"
            />
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Match Keyword</TableHead>
                <TableHead>Minutes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.blogPosting.rules.map((rule, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      value={rule.match}
                      onChange={(e) => updateRule("blogPosting", index, "match", e.target.value)}
                      placeholder="e.g., medium, wix"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      value={rule.minutes}
                      onChange={(e) => updateRule("blogPosting", index, "minutes", e.target.value)}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteRule("blogPosting", index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          <Button onClick={() => addRule("blogPosting")} variant="outline" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Rule
          </Button>
        </CardContent>
      </Card>

      {/* Social Activity Section */}
      <Card>
        <CardHeader>
          <CardTitle>Social Activity Durations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="font-medium">Default Duration (minutes):</label>
            <Input
              type="number"
              min="1"
              value={config.socialActivity.default}
              onChange={(e) => updateDefault("socialActivity", parseInt(e.target.value) || 0)}
              className="w-32"
            />
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Match Keyword</TableHead>
                <TableHead>Minutes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {config.socialActivity.rules.map((rule, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      value={rule.match}
                      onChange={(e) => updateRule("socialActivity", index, "match", e.target.value)}
                      placeholder="e.g., behance, quora"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      value={rule.minutes}
                      onChange={(e) => updateRule("socialActivity", index, "minutes", e.target.value)}
                      className="w-24"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteRule("socialActivity", index)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          <Button onClick={() => addRule("socialActivity")} variant="outline" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Rule
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
