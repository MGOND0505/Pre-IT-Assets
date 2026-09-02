"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useHelpdeskCategoryOptions } from "@/lib/use-lookup-options"

export type KnowledgeBaseArticleStatus = "Published" | "Draft"

export type KnowledgeBaseArticle = {
  _id: string
  title: string
  content: string
  category: { _id: string; name: string } | null
  tags: string[]
  status: KnowledgeBaseArticleStatus
}

export type KnowledgeBaseArticleFormValues = {
  _id?: string
  title: string
  content: string
  category: string
  tags: string
  status: KnowledgeBaseArticleStatus
}

export const EMPTY_KNOWLEDGE_BASE_ARTICLE_FORM: KnowledgeBaseArticleFormValues = {
  title: "",
  content: "",
  category: "",
  tags: "",
  status: "Draft",
}

export function toKnowledgeBaseArticleFormValues(article: KnowledgeBaseArticle): KnowledgeBaseArticleFormValues {
  return {
    _id: article._id,
    title: article.title,
    content: article.content,
    category: article.category?._id ?? "",
    tags: article.tags?.join(", ") ?? "",
    status: article.status,
  }
}

const NO_CATEGORY = "__none__"

// Field-only, Dialog-agnostic - used directly by /knowledge-base/add and
// /knowledge-base/[id]/edit, mirroring asset-form.tsx/license-form.tsx's own shape.
export function KnowledgeBaseArticleForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: KnowledgeBaseArticleFormValues
  onSaved: () => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<KnowledgeBaseArticleFormValues>(initial)
  const [submitting, setSubmitting] = React.useState(false)
  const { items: categories } = useHelpdeskCategoryOptions()

  const isEdit = Boolean(form._id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!form.content.trim()) {
      toast.error("Content is required")
      return
    }

    const payload = {
      title: form.title,
      content: form.content,
      category: form.category || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      status: form.status,
    }

    setSubmitting(true)
    try {
      if (isEdit && form._id) {
        await apiClient.put(`/knowledge-base/${form._id}`, payload)
        toast.success("Article updated")
      } else {
        await apiClient.post("/knowledge-base", payload)
        toast.success("Article created")
      }
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save article"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="kb-title">Title</Label>
        <Input id="kb-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="kb-content">Content</Label>
        <Textarea
          id="kb-content"
          rows={12}
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="kb-category">Category</Label>
          <Select
            value={form.category || NO_CATEGORY}
            onValueChange={(v) => setForm((f) => ({ ...f, category: v === NO_CATEGORY ? "" : v ?? "" }))}
          >
            <SelectTrigger id="kb-category">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>None</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="kb-status">Status</Label>
          <Select value={form.status} onValueChange={(v) => v && setForm((f) => ({ ...f, status: v as KnowledgeBaseArticleStatus }))}>
            <SelectTrigger id="kb-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="kb-tags">Tags</Label>
        <Input
          id="kb-tags"
          placeholder="comma, separated, keywords"
          value={form.tags}
          onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save changes" : "Create article"}
        </Button>
      </div>
    </form>
  )
}
