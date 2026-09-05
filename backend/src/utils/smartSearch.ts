import type { Model } from "mongoose";
import { escapeRegex } from "./regex";

/** Splits a free-text query into whitespace-separated tokens and requires EVERY token to match
 * SOMEWHERE across the given fields (each token itself matching ANY of those fields) - an
 * AND-of-ORs, same approach search.service.ts's global command-palette search already uses. This
 * is why "Dell 5420" now matches "Dell Latitude 5420 Laptop" (both words present, any order, any
 * field) and "ABC 12345" matches "ABC-12345" (each token is its own substring match, so the
 * space/hyphen difference no longer matters) - neither of which the old single-regex-against-the-
 * whole-query approach could ever match, since it required the literal whole phrase to appear in
 * one field. Returns {} (no-op filter) for an empty query. */
export function tokenSearchFilter(fields: string[], rawQuery: string): Record<string, unknown> {
  const tokens = rawQuery
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ({ $regex: escapeRegex(token), $options: "i" }));
  if (tokens.length === 0) return {};
  return { $and: tokens.map((rx) => ({ $or: fields.map((field) => ({ [field]: rx })) })) };
}

/** Iterative single-row Levenshtein edit distance - small and dependency-free, which is fine
 * given this only ever runs on short strings (one search token vs. one word from a field). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev = curr;
  }
  return prev[b.length];
}

/** 1.0 for a substring match either way (handles partial keywords like "Dell" against "Dell's" or
 * a longer word), otherwise a normalized edit-distance similarity in [0, 1] - close enough to
 * catch a genuine spelling mistake (e.g. "Latitde" vs "Latitude") without a real search-engine
 * dependency. */
function wordSimilarity(token: string, word: string): number {
  if (!token || !word) return 0;
  if (word.includes(token) || token.includes(word)) return 1;
  const distance = levenshtein(token, word);
  const maxLen = Math.max(token.length, word.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

/** Scores a candidate's chosen fields against the raw query - each query token is scored against
 * its single best-matching word anywhere across those fields, and the candidate's overall score
 * is the average of its tokens' best scores. Exported mainly so the ranking logic itself is
 * unit-testable independent of any one module's Mongo query shape. */
export function similarityScore(fields: string[], record: Record<string, unknown>, rawQuery: string): number {
  const tokens = rawQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const words = fields.flatMap((field) => String(record[field] ?? "").toLowerCase().split(/\s+/)).filter(Boolean);
  if (words.length === 0) return 0;
  const perTokenScores = tokens.map((token) => words.reduce((best, word) => Math.max(best, wordSimilarity(token, word)), 0));
  return perTokenScores.reduce((sum, s) => sum + s, 0) / perTokenScores.length;
}

/**
 * The "did you mean" fallback for when tokenSearchFilter's strict AND-of-ORs finds nothing -
 * covers what deterministic substring matching structurally can't (an actual spelling mistake).
 * Pulls a bounded candidate pool with the SAME filter the caller already used minus the search
 * clause (so status/category/ownership filters etc. still apply), scores each candidate against
 * the raw query in plain JS, and returns the real Mongoose documents for only the top matches -
 * re-queried by id (rather than working from the lean candidate pool directly) so the result is
 * exactly the same populated/hydrated document shape the caller's normal query already returns.
 *
 * A plain in-memory scoring pass only works at this app's per-organization scale (hundreds to a
 * few thousand records, never millions) - `candidatePoolSize` exists specifically to keep that
 * bounded regardless of collection size.
 */
export async function fuzzyFallback<T = unknown>(
  model: Model<any>,
  baseFilter: Record<string, unknown>,
  fields: string[],
  rawQuery: string,
  options: { candidatePoolSize?: number; limit?: number; minScore?: number } = {}
): Promise<T[]> {
  const candidatePoolSize = options.candidatePoolSize ?? 500;
  const limit = options.limit ?? 10;
  const minScore = options.minScore ?? 0.5;

  const candidates: Record<string, unknown>[] = await model
    .find(baseFilter)
    .select([...fields, "_id"].join(" "))
    .limit(candidatePoolSize)
    .lean();

  const ranked = candidates
    .map((candidate) => ({ id: String(candidate._id), score: similarityScore(fields, candidate, rawQuery) }))
    .filter((c) => c.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (ranked.length === 0) return [];

  const rankOrder = new Map(ranked.map((r, index) => [r.id, index]));
  const fullDocs: Array<{ _id: unknown }> = await model.find({ _id: { $in: ranked.map((r) => r.id) } });
  fullDocs.sort((a, b) => (rankOrder.get(String(a._id)) ?? 0) - (rankOrder.get(String(b._id)) ?? 0));
  return fullDocs as T[];
}
