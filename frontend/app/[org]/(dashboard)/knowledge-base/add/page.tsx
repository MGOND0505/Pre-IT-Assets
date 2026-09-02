"use client"

import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  KnowledgeBaseArticleForm,
  EMPTY_KNOWLEDGE_BASE_ARTICLE_FORM,
} from "@/components/knowledge-base/knowledge-base-article-form"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

export default function AddKnowledgeBaseArticlePage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()

  const canCreate = can(user, "knowledgeBase", "create")

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Article</h1>
        <p className="text-sm text-muted-foreground">Create a help article for users and the AI Assistant.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New article</CardTitle>
        </CardHeader>
        <CardContent>
          <KnowledgeBaseArticleForm
            initial={EMPTY_KNOWLEDGE_BASE_ARTICLE_FORM}
            onSaved={() => router.push(toOrgHref("/knowledge-base"))}
            onCancel={() => router.push(toOrgHref("/knowledge-base"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
