"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  KnowledgeBaseArticleForm,
  toKnowledgeBaseArticleFormValues,
  type KnowledgeBaseArticle,
} from "@/components/knowledge-base/knowledge-base-article-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

export default function EditKnowledgeBaseArticlePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [article, setArticle] = React.useState<KnowledgeBaseArticle | null>(null)
  const [loading, setLoading] = React.useState(true)

  const canWrite = can(user, "knowledgeBase", "update")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<KnowledgeBaseArticle>>(`/knowledge-base/${params.id}`)
      setArticle(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load article"))
    } finally {
      setLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    if (canWrite) load()
  }, [canWrite, load])

  if (authLoading) return null
  if (!canWrite) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }
  if (loading || !article) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Article</h1>
        <p className="text-sm text-muted-foreground">{article.title}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Article details</CardTitle>
        </CardHeader>
        <CardContent>
          <KnowledgeBaseArticleForm
            initial={toKnowledgeBaseArticleFormValues(article)}
            onSaved={() => router.push(toOrgHref("/knowledge-base"))}
            onCancel={() => router.push(toOrgHref("/knowledge-base"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
