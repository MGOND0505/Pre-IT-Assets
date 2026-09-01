/** User input going straight into a Mongo $regex must have its metacharacters escaped first -
 * otherwise a search like "a+" or "(" can throw, silently match more than intended, or (in a
 * pathological case) trigger expensive backtracking. Was previously duplicated independently in
 * ai-tools.service.ts, organizations.service.ts, and search.service.ts - centralized here as the
 * one shared implementation, and now applied everywhere a free-text filter builds a $regex. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
