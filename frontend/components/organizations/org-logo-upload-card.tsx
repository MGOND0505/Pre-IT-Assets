"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { apiErrorMessage } from "@/lib/api-client"

// Reusable logo upload/preview/remove UI - deliberately endpoint-agnostic (the caller supplies
// onUpload/onRemove) so it can back both the Super Admin's org-scoped /settings/logo route
// (administration/logo/page.tsx) and the Sub-Super Admin's flat /my-organizations/:id/logo route
// (EditGrantedOrgLogoDialog in app/page.tsx) without duplicating this markup. Mirrors the existing
// Branding card's UI in administration/settings/page.tsx, which is left untouched. Deliberately
// has no outer Card/heading of its own - the Super Admin's page wraps it in a Card with its own
// title, while the Sub-Super Admin's dialog already supplies a DialogTitle, so nesting two
// headings would be redundant either way.
export function OrgLogoUploadCard({
  logoUrl,
  hasLogo,
  canWrite,
  onUpload,
  onRemove,
}: {
  logoUrl: string | null
  hasLogo: boolean
  canWrite: boolean
  onUpload: (file: File) => Promise<void>
  onRemove: () => Promise<void>
}) {
  const [submitting, setSubmitting] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setSubmitting(true)
    try {
      await onUpload(file)
      toast.success("Logo updated")
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not upload logo"))
    } finally {
      setSubmitting(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function handleRemove() {
    setSubmitting(true)
    try {
      await onRemove()
      toast.success("Logo removed")
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not remove logo"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl ?? undefined}
            alt="Current logo"
            className="h-12 max-w-40 rounded border bg-background object-contain p-1"
          />
        ) : (
          <div className="flex h-12 w-40 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
            No logo set
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="org-logo-upload" className="sr-only">
            Upload logo
          </Label>
          <input
            ref={inputRef}
            id="org-logo-upload"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={!canWrite || submitting}
            onChange={handleFileSelected}
            className="text-sm"
          />
          <div className="flex gap-2">
            {hasLogo && canWrite && (
              <Button variant="outline" size="sm" onClick={handleRemove} disabled={submitting}>
                Remove logo
              </Button>
            )}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">PNG, JPG, or WEBP - up to 2MB.</p>
    </div>
  )
}
