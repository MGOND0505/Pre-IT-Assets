"use client"

import * as React from "react"
import { Download, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { apiClient, apiErrorMessage, orgScopedApiUrl, type ApiEnvelope } from "@/lib/api-client"
import { can } from "@/lib/permissions"
import { useAuth } from "@/lib/auth-context"

// Mirrors components/assets/asset-documents-tab.tsx - no `type` selector (Task attachments are
// generic, unlike AssetDocument's Invoice/Warranty/AMC/Purchase/Other), plus a client-side
// pre-check against this feature's own 500KB limit (backend/src/utils/upload.ts's
// uploadTaskAttachment) so a too-large file never even reaches the network.
const MAX_ATTACHMENT_SIZE_BYTES = 500 * 1024

type TaskAttachment = {
  _id: string
  originalName: string
  size: number
  createdDate: string
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function TaskAttachmentsTab({ taskId }: { taskId: string }) {
  const { user } = useAuth()
  const [attachments, setAttachments] = React.useState<TaskAttachment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState<TaskAttachment | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const canManage = can(user, "tasks", "manageAttachments")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<TaskAttachment[]>>(`/tasks/${taskId}/attachments`)
      setAttachments(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load attachments"))
    } finally {
      setLoading(false)
    }
  }, [taskId])

  React.useEffect(() => {
    load()
  }, [load])

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      toast.error(`"${file.name}" is ${formatSize(file.size)} - attachments must be 500 KB or smaller.`)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    const formData = new FormData()
    formData.append("file", file)

    setUploading(true)
    try {
      await apiClient.post(`/tasks/${taskId}/attachments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      toast.success("Attachment uploaded")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not upload attachment"))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDelete(attachment: TaskAttachment) {
    try {
      await apiClient.delete(`/tasks/${taskId}/attachments/${attachment._id}`)
      toast.success("Attachment removed")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not remove attachment"))
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Attachments</h2>
          {canManage && (
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
              <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-4" />
                {uploading ? "Uploading..." : "Attach file"}
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Maximum file size: 500 KB per file.</p>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {attachments.map((attachment) => (
              <li key={attachment._id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{attachment.originalName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatSize(attachment.size)} &middot; {new Date(attachment.createdDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Download attachment"
                          render={
                            <a
                              href={orgScopedApiUrl(`/tasks/${taskId}/attachments/${attachment._id}/download`)}
                              target="_blank"
                              rel="noreferrer"
                            />
                          }
                        >
                          <Download className="size-4" />
                        </Button>
                      }
                    />
                    <TooltipContent>Download</TooltipContent>
                  </Tooltip>
                  {canManage && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remove attachment"
                            onClick={() => setPendingDelete(attachment)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        }
                      />
                      <TooltipContent>Remove</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {pendingDelete && (
          <ConfirmDialog
            open
            onOpenChange={(open) => !open && setPendingDelete(null)}
            title={`Remove "${pendingDelete.originalName}"?`}
            description="This cannot be undone."
            confirmLabel="Remove"
            destructive
            onConfirm={() => handleDelete(pendingDelete)}
          />
        )}
      </CardContent>
    </Card>
  )
}
