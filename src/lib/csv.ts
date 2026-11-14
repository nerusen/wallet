/**
 * Dependency-free CSV codec.
 *
 * Written by hand rather than pulling in a parser because the import surface
 * is a single known schema and the export must be byte-predictable.
 *
 * Handles RFC-4180 quoting: `"` escaping, embedded commas, embedded newlines,
 * CRLF, and a UTF-8 BOM (Excel writes one).
 */

export type CsvRow = Record<string, string>;

export function parseCsv(input: string): { headers: string[]; rows: CsvRow[] } {
  const text = input.replace(/^\uFEFF/, "");
  const table: string[][] = [];

  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    // `noUncheckedIndexedAccess` types this as `string | undefined`; the loop
    // bound guarantees it is defined, and the fallback keeps it honest.
    const char = text[i] ?? "";

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      table.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // Swallow CR; the following LF terminates the record.
    } else {
      field += char;
    }
  }

  // Flush the trailing record when the file does not end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    table.push(row);
  }

  const nonEmpty = table.filter((cells) =>
    cells.some((cell) => cell.trim().length > 0),
  );

  const headerRow = nonEmpty[0];
  if (headerRow === undefined) return { headers: [], rows: [] };

  const headers = headerRow.map((h) => h.trim());
  const rows: CsvRow[] = nonEmpty.slice(1).map((cells) => {
    const record: CsvRow = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? "").trim();
    });
    return record;
  });

  return { headers, rows };
}

function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | boolean | null)[])[],
): string {
  const lines: string[] = [headers.map((h) => escapeCell(h)).join(",")];

  for (const row of rows) {
    lines.push(
      row
        .map((cell) => {
          if (cell === null) return "";
          if (typeof cell === "boolean") return cell ? "true" : "false";
          return escapeCell(String(cell));
        })
        .join(","),
    );
  }

  // Lead with a BOM so Excel opens the Indonesian labels correctly.
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/**
 * Resolve a logical column to whichever header the file actually uses.
 * Accepts snake_case, Title Case, and the Indonesian labels.
 */
export function pickColumn(
  row: CsvRow,
  candidates: readonly string[],
): string | undefined {
  const normalized = new Map<string, string>();
  for (const key of Object.keys(row)) {
    normalized.set(key.toLowerCase().replace(/[\s_-]+/g, ""), key);
  }

  for (const candidate of candidates) {
    const key = normalized.get(candidate.toLowerCase().replace(/[\s_-]+/g, ""));
    if (key !== undefined) {
      const value = row[key];
      if (value !== undefined && value.length > 0) return value;
    }
  }
  return undefined;
}
