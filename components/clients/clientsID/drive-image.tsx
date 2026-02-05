//components/clients/clientsID/
"use client"

import { DriveImageGallery } from "@/components/drive-image-gallery"
import { Card, CardContent } from "@/components/ui/card"
import { Images } from "lucide-react"
import { Client } from "@/types/client"

interface DriveImageProps {
  clientData: Client
}

export function DriveImage({ clientData }: DriveImageProps) {
  const normalizeDriveData = (raw: any) => {
    if (typeof raw === "string") {
      return { driveLink: raw, items: [] as Array<{ title?: string; link?: string }> }
    }
    if (Array.isArray(raw)) {
      return {
        driveLink: "",
        items: raw.filter((i) => i?.link || i?.title),
      }
    }
    if (raw && typeof raw === "object") {
      return {
        driveLink: typeof raw.driveLink === "string" ? raw.driveLink : "",
        items: Array.isArray(raw.items) ? raw.items.filter((i: any) => i?.link || i?.title) : [],
      }
    }
    return { driveLink: "", items: [] as Array<{ title?: string; link?: string }> }
  }

  const extractFolderId = (url: string): string | null => {
    try {
      const u = new URL(url)
      const foldIdx = u.pathname.indexOf("/folders/")
      if (foldIdx !== -1) {
        const id = u.pathname.slice(foldIdx + "/folders/".length).split("/")[0]
        if (id) return id
      }
      const viaQuery = u.searchParams.get("id")
      if (viaQuery) return viaQuery
      return null
    } catch {
      return null
    }
  }

  const { driveLink, items } = normalizeDriveData(clientData.imageDrivelink)
  const hasDriveLink = Boolean(driveLink)
  const hasItems = items.length > 0

  if (!hasDriveLink && !hasItems) {
    return (
      <Card className="shadow-lg border-0 bg-white dark:bg-slate-800">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-full mb-4">
              <Images className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Drive Link Available</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
              No Google Drive link has been provided for {clientData.name}. Please add a drive link to display images
              here.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const folderId = hasDriveLink ? extractFolderId(driveLink) : null
  if (hasDriveLink && !folderId) {
    return (
      <Card className="shadow-lg border-0 bg-white dark:bg-slate-800">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-slate-100 dark:bg-slate-700 rounded-full mb-4">
              <Images className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">Invalid Drive Link</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
              The provided Google Drive link is not a valid folder URL. Use a link like
              {" "}
              <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">https://drive.google.com/drive/folders/&lt;FOLDER_ID&gt;</code>
              {" "}
              or a link containing <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">?id=&lt;FOLDER_ID&gt;</code>.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {hasDriveLink && (
        <DriveImageGallery
          driveLink={driveLink}
          clientName={clientData.name}
          linkTabs={items}
        />
      )}
    </div>
  )
}
