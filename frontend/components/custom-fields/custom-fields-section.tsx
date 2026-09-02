"use client"

import * as React from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  useCustomFieldDefinitionOptions,
  type CustomFieldDefinitionOption,
  type CustomFieldModule,
} from "@/lib/use-lookup-options"

function RequiredMark({ required }: { required: boolean }) {
  return required ? <span className="text-destructive"> *</span> : null
}

function CustomFieldControl({
  definition,
  value,
  onChange,
}: {
  definition: CustomFieldDefinitionOption
  value: unknown
  onChange: (value: unknown) => void
}) {
  const id = `custom-field-${definition.key}`

  if (definition.type === "checkbox") {
    return (
      <div className="flex items-center gap-2 pt-6">
        <Checkbox id={id} checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} />
        <Label htmlFor={id} className="cursor-pointer">
          {definition.label}
          <RequiredMark required={definition.required} />
        </Label>
      </div>
    )
  }

  if (definition.type === "select") {
    const selected = typeof value === "string" ? value : ""
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>
          {definition.label}
          <RequiredMark required={definition.required} />
        </Label>
        <Select value={selected} onValueChange={(v) => onChange(v ?? "")}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {definition.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  const inputType = definition.type === "number" ? "number" : definition.type === "date" ? "date" : "text"
  const stringValue =
    value === undefined || value === null
      ? ""
      : definition.type === "date" && typeof value === "string"
        ? value.slice(0, 10)
        : String(value)

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {definition.label}
        <RequiredMark required={definition.required} />
      </Label>
      <Input id={id} type={inputType} value={stringValue} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/**
 * One form control per active custom field definition for `module`, sorted by the admin-configured
 * `order` (useCustomFieldDefinitionOptions already sorts). Fully controlled - `value` is keyed by
 * each definition's `key`, matching the shape Asset/License/Ticket.customFields is stored in and
 * validateCustomFieldValues expects on submit. Renders nothing when the module has zero active
 * definitions, so a form with no custom fields configured looks unchanged.
 */
export function CustomFieldsSection({
  module,
  categoryId,
  value,
  onChange,
}: {
  module: CustomFieldModule
  // module "assets" only - the asset's chosen Asset Type, so a category-scoped field like "UPS
  // Capacity" only renders on assets of that type. Omitted = org-wide definitions only.
  categoryId?: string
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}) {
  const { items: definitions } = useCustomFieldDefinitionOptions(module, categoryId)

  if (definitions.length === 0) return <></>

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {definitions.map((def) => (
        <CustomFieldControl
          key={def._id}
          definition={def}
          value={value[def.key]}
          onChange={(fieldValue) => onChange({ ...value, [def.key]: fieldValue })}
        />
      ))}
    </div>
  )
}

/**
 * Read-only counterpart for detail/view pages - a simple label: value list of whatever's actually
 * stored on the record, skipping fields with no value. Independent of CustomFieldsSection's own
 * active-definitions fetch so a value survives on screen even if its definition was later made
 * Inactive (labeled with the key itself as a fallback in that edge case).
 */
export function CustomFieldValuesList({
  module,
  categoryId,
  values,
}: {
  module: CustomFieldModule
  categoryId?: string
  values: Record<string, unknown> | null | undefined
}) {
  const { items: definitions } = useCustomFieldDefinitionOptions(module, categoryId)
  const entries = Object.entries(values ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== "")

  if (entries.length === 0) return <></>

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map(([key, v]) => {
        const def = definitions.find((d) => d.key === key)
        const label = def?.label ?? key
        const display = typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)
        return (
          <div key={key} className="flex flex-col gap-0.5 py-1.5">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-sm">{display}</span>
          </div>
        )
      })}
    </div>
  )
}
