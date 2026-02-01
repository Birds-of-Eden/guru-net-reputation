// components/clients/clientsID/template-customization/PostingTaskTime.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PostingTaskDurationSettingsModalProps {
  onClose?: () => void;
}

export default function PostingTaskDurationSettingsModal({
  onClose,
}: PostingTaskDurationSettingsModalProps) {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Posting Task Duration</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Per-Site Asset Duration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-slate-600">
            Posting task duration is now configured per site asset in the
            template (Posting Duration min). Those values are used
            automatically when creating posting tasks.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
