"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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

const NO_CATEGORY = "__none__"

export function KnowledgeBaseArticleFormDialog({
  article,
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  article?: KnowledgeBaseArticle
  onSaved: () => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isEdit = Boolean(article)
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange! : setInternalOpen

  const { items: categories } = useHelpdeskCategoryOptions()

  const [title, setTitle] = React.useState(article?.title ?? "")
  const [content, setContent] = React.useState(article?.content ?? "")
  const [category, setCategory] = React.useState(article?.category?._id ?? "")
  const [tags, setTags] = React.useState(article?.tags?.join(", ") ?? "")
  const [status, setStatus] = React.useState<KnowledgeBaseArticleStatus>(article?.status ?? "Draft")
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setTitle(article?.title ?? "")
      setContent(article?.content ?? "")
      setCategory(article?.category?._id ?? "")
      setTags(article?.tags?.join(", ") ?? "")
      setStatus(article?.status ?? "Draft")
    }
  }, [open, article])

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!content.trim()) {
      toast.error("Content is required")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        title,
        content,
        category: category || null,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        status,
      }
      if (isEdit && article) {
        await apiClient.put(`/knowledge-base/${article._id}`, payload)
        toast.success("Article updated")
      } else {
        await apiClient.post("/knowledge-base", payload)
        toast.success("Article created")
      }
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save article"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && <DialogTrigger render={trigger ?? <Button>Add article</Button>} />}
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit article" : "Add article"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="kb-title">Title</Label>
            <Input id="kb-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kb-content">Content</Label>
            <Textarea id="kb-content" rows={12} value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="kb-category">Category</Label>
              <Select value={category || NO_CATEGORY} onValueChange={(v) => setCategory(v === NO_CATEGORY ? "" : v ?? "")}>
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
              <Select value={status} onValueChange={(v) => v && setStatus(v as KnowledgeBaseArticleStatus)}>
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
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save changes" : "Create article"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
