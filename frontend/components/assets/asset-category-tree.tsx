"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown, ChevronRight, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { ASSET_CATEGORY_GROUPS } from "@/components/asset-categories/asset-category-form-dialog"
import type { AssetCategoryOption } from "@/lib/use-lookup-options"

type AssetCategoryGroup = (typeof ASSET_CATEGORY_GROUPS)[number]

export type AssetCategorySelection = { group: AssetCategoryGroup | null; category: string | null }

function NavRow({
  label,
  active,
  indent,
  onClick,
  trailingCount,
  leading,
}: {
  label: string
  active: boolean
  indent?: boolean
  onClick: () => void
  trailingCount?: number
  leading?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
        indent && "pl-7",
        active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        {leading}
        <span className="truncate">{label}</span>
      </span>
      {trailingCount !== undefined && <span className="shrink-0 text-xs text-muted-foreground">{trailingCount}</span>}
    </button>
  )
}

function CategoryRow({
  category,
  active,
  onSelect,
  addHref,
}: {
  category: AssetCategoryOption
  active: boolean
  onSelect: () => void
  addHref: string | null
}) {
  return (
    <div className="flex items-center gap-0.5 pl-7">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors",
          active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {category.name}
      </button>
      {addHref && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                aria-label={`Add asset in ${category.name}`}
                render={<Link href={addHref} />}
              >
                <Plus className="size-3.5" />
              </Button>
            }
          />
          <TooltipContent>Add asset in {category.name}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

// Category-based nav: "All Assets" + each of the 5 groups (expandable), listing that group's
// categories - clicking any node filters assets/page.tsx's list via the group/category query
// params assets.service.ts#listAssets now understands. A category not yet assigned a real group
// defaults to "Peripherals & Other" server-side (AssetCategory.ts's schema default), so every
// category always lands under exactly one node here.
export function AssetCategoryTree({
  categories,
  selection,
  onChange,
  buildAddAssetHref,
}: {
  categories: AssetCategoryOption[]
  selection: AssetCategorySelection
  onChange: (next: AssetCategorySelection) => void
  // Returns the org-scoped "add asset preset to this category" URL, or null when the current user
  // can't create assets at all - omitting it entirely hides every category row's quick-add button.
  buildAddAssetHref?: (categoryId: string) => string
}) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(ASSET_CATEGORY_GROUPS.map((g) => [g, true]))
  )

  const byGroup = React.useMemo(() => {
    const map = new Map<string, AssetCategoryOption[]>()
    for (const group of ASSET_CATEGORY_GROUPS) map.set(group, [])
    for (const category of categories) {
      const list = map.get(category.group)
      if (list) list.push(category)
      else map.set(category.group, [category])
    }
    return map
  }, [categories])

  const isAllActive = selection.group === null && selection.category === null

  return (
    <nav className="flex w-full flex-col gap-0.5 md:w-56 md:shrink-0">
      <NavRow label="All Assets" active={isAllActive} onClick={() => onChange({ group: null, category: null })} />
      {ASSET_CATEGORY_GROUPS.map((group) => {
        const groupCategories = byGroup.get(group) ?? []
        const isExpanded = expanded[group]
        const isGroupActive = selection.group === group && selection.category === null
        return (
          <div key={group}>
            <div className="flex items-center">
              <button
                type="button"
                aria-label={isExpanded ? `Collapse ${group}` : `Expand ${group}`}
                onClick={() => setExpanded((prev) => ({ ...prev, [group]: !prev[group] }))}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
              >
                {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              </button>
              <div className="flex-1">
                <NavRow
                  label={group}
                  active={isGroupActive}
                  trailingCount={groupCategories.length}
                  onClick={() => onChange({ group, category: null })}
                />
              </div>
            </div>
            {isExpanded &&
              groupCategories.map((c) => (
                <CategoryRow
                  key={c._id}
                  category={c}
                  active={selection.category === c._id}
                  onSelect={() => onChange({ group: null, category: c._id })}
                  addHref={buildAddAssetHref ? buildAddAssetHref(c._id) : null}
                />
              ))}
          </div>
        )
      })}
    </nav>
  )
}
