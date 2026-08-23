import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";

type Row = Record<string, unknown>;

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function rowsToCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]);
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c])).join(","));
  }
  return lines.join("\n");
}

export function rowsToExcelBuffer(rows: Row[], sheetName: string): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function rowsToPdfBuffer(rows: Row[], title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(title, { align: "left" });
    doc.fontSize(9).fillColor("#666").text(`Generated ${new Date().toLocaleString()} - ${rows.length} record(s)`);
    doc.moveDown();

    if (rows.length === 0) {
      doc.fontSize(11).fillColor("#000").text("No records match the current filters.");
      doc.end();
      return;
    }

    const columns = Object.keys(rows[0]);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / columns.length;

    function drawHeader() {
      doc.fontSize(8).fillColor("#fff");
      const y = doc.y;
      doc.rect(doc.page.margins.left, y, pageWidth, 16).fill("#333");
      doc.fillColor("#fff");
      columns.forEach((col, i) => {
        doc.text(col, doc.page.margins.left + i * colWidth + 2, y + 4, { width: colWidth - 4, ellipsis: true });
      });
      doc.y = y + 16;
      doc.fillColor("#000");
    }

    drawHeader();

    for (const row of rows) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      doc.fontSize(7.5).fillColor("#000");
      columns.forEach((col, i) => {
        const value = row[col];
        doc.text(value === null || value === undefined ? "" : String(value), doc.page.margins.left + i * colWidth + 2, y, {
          width: colWidth - 4,
          ellipsis: true,
        });
      });
      doc.y = y + 14;
    }

    doc.end();
  });
}
