/**
 * Minimal RFC 4180 CSV reader.
 *
 * Hand-rolled rather than pulled from npm because CLAUDE.md says not to add
 * dependencies without asking, and the export we ingest is a plain municipal
 * business list. It handles the parts that actually bite: quoted fields,
 * escaped quotes, embedded commas and newlines, CRLF, and a UTF-8 BOM.
 */

export type CsvRow = Record<string, string>;

/** Splits CSV text into rows of raw cells. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let index = 0;

  const endField = (): void => {
    row.push(field);
    field = '';
  };
  const endRow = (): void => {
    endField();
    // Ignore blank trailing lines rather than emitting a row of one empty cell.
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ',') {
      endField();
      index += 1;
      continue;
    }
    if (char === '\r') {
      index += 1;
      continue;
    }
    if (char === '\n') {
      endRow();
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }

  if (field.length > 0 || row.length > 0) endRow();
  return rows;
}

/** Header key normalisation: `Postal Code`, `postal_code` and `POSTALCODE` agree. */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Parses CSV text into objects keyed by normalised header. Short rows are
 * padded rather than rejected — municipal exports routinely omit trailing
 * empty cells.
 */
export function parseCsvRows(input: string): CsvRow[] {
  const rows = parseCsv(input);
  const header = rows.shift();
  if (!header) return [];

  const keys = header.map(normalizeHeader);
  return rows.map((cells) => {
    const record: CsvRow = {};
    keys.forEach((key, position) => {
      if (!key) return;
      record[key] = (cells[position] ?? '').trim();
    });
    return record;
  });
}

/** First non-empty value among `names`. Lets one parser accept several exports. */
export function pickColumn(row: CsvRow, ...names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== '') return value;
  }
  return '';
}
