const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parses simple durations like "8h", "30m", "7d" into milliseconds. */
export function parseDurationMs(input: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(input.trim());

  if (!match) {
    throw new Error(`Unsupported duration format: ${input}`);
  }

  const [, value, unit] = match;
  return Number(value) * UNIT_MS[unit.toLowerCase()];
}
