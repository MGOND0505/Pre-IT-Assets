"use client"

import * as React from "react"
import { Download, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { can } from "@/lib/permissions"
import { useAuth } from "@/lib/auth-context"

const DOCUMENT_TYPES = ["Invoice", "Warranty", "AMC", "Purchase", "Other"] as const

type AssetDocument = {
  _id: string
  type: string
  originalName: string
  size: number
  createdDate: string
}

export function AssetDocumentsTab({ assetId }: { assetId: string }) {
  const { user } = useAuth()
  const [documents, setDocuments] = React.useState<AssetDocument[]>([])
  const [loading, setLoading] = React.useState(true)
  const [docType, setDocType] = React.useState<string>("Other")
  const [uploading, setUploading] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState<AssetDocument | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const canWrite = can(user, "assets", "edit")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<AssetDocument[]>>(`/assets/${assetId}/documents`)
      setDocuments(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load documents"))
    } finally {
      setLoading(false)
    }
  }, [assetId])

  React.useEffect(() => {
    load()
  }, [load])

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)
    formData.append("type", docType)

    setUploading(true)
    try {
      await apiClient.post(`/assets/${assetId}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      toast.success("Document uploaded")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not upload document"))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDelete(doc: AssetDocument) {
    try {
      await apiClient.delete(`/assets/${assetId}/documents/${doc._id}`)
      toast.success("Document deleted")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete document"))
    } finally {
      setPendingDelete(null)
    }
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col gap-4">
      {canWrite && (
        <div className="flex items-center gap-2">
          <Select value={docType} onValueChange={(v) => setDocType(v ?? "Other")}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />
          <Button
            variant="outline"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-4" />
            {uploading ? "Uploading..." : "Upload document"}
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => (
            <li key={doc._id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div className="flex flex-col">
                <span className="font-medium">{doc.originalName}</span>
                <span className="text-xs text-muted-foreground">
                  {doc.type} &middot; {formatSize(doc.size)} &middot; {new Date(doc.createdDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  render={
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_BASE_URL}/assets/${assetId}/documents/${doc._id}/download`}
                      target="_blank"
                      rel="noreferrer"
                    />
                  }
                >
                  <Download className="size-4" />
                </Button>
                {canWrite && (
                  <Button variant="ghost" size="icon" onClick={() => setPendingDelete(doc)}>
                    <Trash2 className="size-4" />
                  </Button>
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
          title={`Delete "${pendingDelete.originalName}"?`}
          description="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(pendingDelete)}
        />
      )}
    </div>
  )
}
