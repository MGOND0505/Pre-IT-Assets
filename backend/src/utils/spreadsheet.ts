import * as XLSX from "xlsx";

/** Parses a CSV/XLSX buffer into an array of row objects keyed by the raw column headers. */
export function parseSpreadsheet(buffer: Buffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });

  return rows.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key] = value === null || value === undefined ? "" : String(value).trim();
    }
    return normalized;
  });
}

/** Case/punctuation/whitespace-insensitive header lookup, e.g. "Emp ID" and "employee_id" both match "employeeid". */
export function findColumn(row: Record<string, string>, aliases: string[]): string {
  const normalizedRow = new Map<string, string>();
  for (const key of Object.keys(row)) {
    normalizedRow.set(normalizeHeader(key), key);
  }

  for (const alias of aliases) {
    const actualKey = normalizedRow.get(normalizeHeader(alias));
    if (actualKey !== undefined) return row[actualKey] ?? "";
  }
  return "";
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}
