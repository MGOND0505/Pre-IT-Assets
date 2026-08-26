import jwt from "jsonwebtoken";
import { env } from "../../config/env";

const EMBED_TOKEN_TTL_SECONDS = 10 * 60;

/**
 * Signs a Metabase "static embedding" JWT scoped to one organization - the dashboard's
 * Organization filter is set to "locked" in Metabase itself (see metabase/provision.mjs), so
 * Metabase enforces this filter server-side and an embedded viewer can never override or drop
 * it, no matter what they do in the iframe. This is the whole tenant-isolation boundary for the
 * embed; see metabase/README.md for how the underlying reporting views got the `organization`
 * field this locks onto.
 *
 * Returns null (not an error) when Metabase hasn't been configured for this environment yet -
 * callers turn that into an honest "not set up" response rather than a crash.
 */
export function getAnalyticsEmbedUrl(organizationId: string): { url: string } | null {
  if (!env.METABASE_URL || !env.METABASE_EMBEDDING_SECRET_KEY || !env.METABASE_DASHBOARD_ID) {
    return null;
  }

  const payload = {
    resource: { dashboard: env.METABASE_DASHBOARD_ID },
    params: { organization: organizationId },
    exp: Math.round(Date.now() / 1000) + EMBED_TOKEN_TTL_SECONDS,
  };

  const token = jwt.sign(payload, env.METABASE_EMBEDDING_SECRET_KEY);
  return { url: `${env.METABASE_URL}/embed/dashboard/${token}#bordered=false&titled=false` };
}
