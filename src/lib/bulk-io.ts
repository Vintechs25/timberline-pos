/**
 * Shared bulk import / export helpers for CSV, Excel (.xlsx) and PDF.
 * - parseTabular: parses CSV/Excel files OR pasted clipboard text into rows of objects
 * - exportRows: exports an array of objects to CSV / XLSX / PDF
 */
import * as XLSX from "xlsx";
import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type Row = Record<string, string | number | null | undefined>;

export interface ParsedTable {
  headers: string[];
  rows: Row[];
}

/* -------------------- PARSING -------------------- */

export async function parseFile(file: File): Promise<ParsedTable> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "csv" || file.type === "text/csv") {
    const text = await file.text();
    return parseCsvText(text);
  }
  // Excel
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: "" });
  return aoaToTable(aoa);
}

export function parseCsvText(text: string): ParsedTable {
  const out = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  return aoaToTable(out.data);
}

/** Parse pasted clipboard text — supports TSV (Excel paste) and CSV. */
export function parsePasted(text: string): ParsedTable {
  const trimmed = text.trim();
  if (!trimmed) return { headers: [], rows: [] };
  // If first line contains tabs, treat as TSV
  const firstLine = trimmed.split(/\r?\n/)[0];
  const delim = firstLine.includes("\t") ? "\t" : ",";
  const out = Papa.parse<string[]>(trimmed, { skipEmptyLines: true, delimiter: delim });
  return aoaToTable(out.data);
}

function aoaToTable(aoa: string[][]): ParsedTable {
  if (!aoa.length) return { headers: [], rows: [] };
  const headers = aoa[0].map((h) => String(h ?? "").trim());
  const rows: Row[] = [];
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    const obj: Row = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] ?? ""; });
    // Skip fully empty rows
    if (Object.values(obj).some((v) => String(v ?? "").trim() !== "")) rows.push(obj);
  }
  return { headers, rows };
}

/* -------------------- EXPORT -------------------- */

export type ExportFormat = "csv" | "xlsx" | "pdf";

export interface ExportOptions {
  filename: string;            // without extension
  title?: string;              // for PDF header
  columns: { key: string; label: string }[];
  rows: Row[];
}

export function exportRows(format: ExportFormat, opts: ExportOptions) {
  if (format === "csv") return exportCsv(opts);
  if (format === "xlsx") return exportXlsx(opts);
  return exportPdf(opts);
}

function buildAoa(opts: ExportOptions): (string | number)[][] {
  const head = opts.columns.map((c) => c.label);
  const body = opts.rows.map((r) =>
    opts.columns.map((c) => {
      const v = r[c.key];
      if (v === null || v === undefined) return "";
      return typeof v === "number" ? v : String(v);
    }),
  );
  return [head, ...body];
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function exportCsv(opts: ExportOptions) {
  const aoa = buildAoa(opts);
  const csv = Papa.unparse(aoa);
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `${opts.filename}.csv`);
}

function exportXlsx(opts: ExportOptions) {
  const aoa = buildAoa(opts);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${opts.filename}.xlsx`);
}

function exportPdf(opts: ExportOptions) {
  const doc = new jsPDF({ orientation: "landscape" });
  if (opts.title) {
    doc.setFontSize(14); doc.text(opts.title, 14, 14);
  }
  autoTable(doc, {
    head: [opts.columns.map((c) => c.label)],
    body: opts.rows.map((r) => opts.columns.map((c) => {
      const v = r[c.key];
      return v === null || v === undefined ? "" : String(v);
    })),
    startY: opts.title ? 20 : 14,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [40, 40, 40] },
  });
  doc.save(`${opts.filename}.pdf`);
}

/* -------------------- AUTO-SKU + MEASUREMENT PARSING -------------------- */

/** Generate a deterministic short SKU from a name + optional category. */
export function autoSku(name: string, category?: string | null): string {
  const slug = (s: string) =>
    s.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 4) || "ITEM";
  const cat = category ? slug(category) : "GEN";
  const base = slug(name);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${cat}-${base}-${rand}`;
}

/** Parse measurement strings like "2x4x12", "2 x 4 x 12 ft", "50mm x 100mm x 3m". */
export function parseTimberDims(input: string): {
  thickness?: number; width?: number; length?: number;
  dim_unit?: string; length_unit?: string;
} {
  if (!input) return {};
  const s = input.toLowerCase().replace(/[×x]/g, "x");
  const m = s.match(/(\d+(?:\.\d+)?)\s*(mm|cm|in|")?\s*x\s*(\d+(?:\.\d+)?)\s*(mm|cm|in|")?\s*x\s*(\d+(?:\.\d+)?)\s*(mm|cm|m|ft|')?/);
  if (!m) return {};
  const dimUnit = (m[2] || m[4] || "in").replace('"', "in");
  const lenUnit = (m[6] || "ft").replace("'", "ft");
  return {
    thickness: Number(m[1]),
    width: Number(m[3]),
    length: Number(m[5]),
    dim_unit: dimUnit,
    length_unit: lenUnit,
  };
}

/** Parse a price string like "KSh 1,200", "1200", "Ksh 850/pc" → number. */
export function parsePrice(s: string | number | null | undefined): number {
  if (s === null || s === undefined || s === "") return 0;
  if (typeof s === "number") return s;
  const m = String(s).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
}
