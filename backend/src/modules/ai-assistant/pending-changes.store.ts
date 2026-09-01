import crypto from "node:crypto";

export type PendingAiChange = {
  token: string;
  organizationId: string;
  userId: string;
  /** null only for a proposed brand-new asset (create_asset), which has no existing id yet. */
  assetId: string | null;
  /** The human-readable asset ID (e.g. "VNR-LAP-000042") or proposed name, for display. */
  assetLabel: string;
  action: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown>;
  summary: string;
  createdAt: number;
};

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, PendingAiChange>();

function purgeExpired() {
  const now = Date.now();
  for (const [token, change] of store) {
    if (now - change.createdAt > TTL_MS) store.delete(token);
  }
}

/**
 * In-memory, single-instance store for AI-proposed-but-not-yet-applied changes. A deliberate,
 * honestly-scoped choice: this is a single local dev server, not a clustered deployment, and a
 * restart losing an unconfirmed proposal is harmless since nothing was ever written to the
 * database. Every entry is single-use (consumed by takePendingChange) and expires after 10
 * minutes so a stale "Confirm" button from an old chat can never silently apply later.
 */
export function createPendingChange(input: Omit<PendingAiChange, "token" | "createdAt">): PendingAiChange {
  purgeExpired();
  const change: PendingAiChange = { ...input, token: crypto.randomUUID(), createdAt: Date.now() };
  store.set(change.token, change);
  return change;
}

/** Consumes (removes) a pending change if it exists, isn't expired, and belongs to this exact
 * user+org - never returns another user's or another org's pending change. */
export function takePendingChange(token: string, organizationId: string, userId: string): PendingAiChange | null {
  purgeExpired();
  const change = store.get(token);
  if (!change) return null;
  if (change.organizationId !== organizationId || change.userId !== userId) return null;
  store.delete(token);
  return change;
}

export function discardPendingChange(token: string, organizationId: string, userId: string): PendingAiChange | null {
  return takePendingChange(token, organizationId, userId);
}
