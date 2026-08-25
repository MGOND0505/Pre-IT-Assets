"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const PAGE_SIZE_OPTIONS = [10, 20, 50]

/** A one-off, richer pagination bar for the Super Admin Organizations table only - deliberately
 * a separate component rather than a change to the shared `Pagination` used across every other
 * list page in the app. */
export function OrganizationsPagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
}: {
  page: number
  limit: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}) {
  if (total === 0) return null

  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  const pageNumbers = buildPageWindow(page, totalPages)

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Select value={String(limit)} onValueChange={(v) => v && onLimitChange(Number(v))}>
          <SelectTrigger size="sm" className="w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>
          Showing {from} to {to} of {total} results
        </span>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" disabled={page <= 1} aria-label="Previous page" onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          {pageNumbers.map((entry, index) =>
            entry === "ellipsis" ? (
              <span key={`ellipsis-${index}`} className="px-1.5 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={entry}
                variant="outline"
                size="icon-sm"
                className={cn(entry === page && "border-primary bg-primary/10 text-primary")}
                onClick={() => onPageChange(entry)}
              >
                {entry}
              </Button>
            )
          )}
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page >= totalPages}
            aria-label="Next page"
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

/** Always shows first, last, and a small window around the current page; collapses the rest
 * behind an ellipsis so this stays usable even with dozens of pages. */
function buildPageWindow(current: number, totalPages: number): (number | "ellipsis")[] {
  const windowSize = 1
  const pages = new Set<number>([1, totalPages])
  for (let p = current - windowSize; p <= current + windowSize; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p)
  }
  const sorted = [...pages].sort((a, b) => a - b)

  const result: (number | "ellipsis")[] = []
  let previous = 0
  for (const p of sorted) {
    if (previous !== 0 && p - previous > 1) result.push("ellipsis")
    result.push(p)
    previous = p
  }
  return result
}
