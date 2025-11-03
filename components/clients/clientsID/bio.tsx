// components/clients/clientsID/bio.tsx

"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, User } from "lucide-react"
import { Client } from "@/types/client"
import DOMPurify from "dompurify"

interface BioProps {
  clientData: Client
}

export function Bio({ clientData }: BioProps) {
  const hasBio =
    typeof clientData.biography === "string" &&
    clientData.biography.trim() !== ""

  // Sanitize rich HTML (from TinyMCE/Jodit) so tags render properly and safely.
  const safeBioHTML = hasBio
    ? DOMPurify.sanitize(clientData.biography!, { USE_PROFILES: { html: true } })
    : ""

  return (
    <Card className="shadow-lg border-0 bg-white dark:bg-slate-800">
      <CardHeader className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20">
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          <span>Biography - {clientData.name}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {hasBio ? (
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <div
              className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed"
              // Render sanitized HTML instead of showing raw tags/text
              dangerouslySetInnerHTML={{ __html: safeBioHTML }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-full mb-4">
              <User className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              No Biography Available
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
              The biography for {clientData.name} has not been added yet. Please add
              biographical information to display here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default Bio
