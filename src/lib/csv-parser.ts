// Pass 82 — CSV/TSV parser (saf TypeScript, domain-bağımsız).
//
// Operatörün Excel/Google Sheets'ten kopyaladığı tabular veriyi
// `Array<Record<string,string>>` formatına çevirir. Pass 81 BatchRunForm
// JSON textarea pain noktasını çözer — header row variable adlarını,
// data rows variable values'ını verir.
//
// Tasarım hedefleri:
//   - Saf TypeScript, hiç dependency yok (taşınabilir; başka uygulamalara
//     aynen taşınır)
//   - CSV ve TSV otomatik delimiter tespiti (header row'da virgül/tab
//     hangisi daha çok varsa)
//   - RFC 4180 quoted field desteği ("a,b" ile değer içinde virgül/tab,
//     "" → ")
//   - Newline normalization: \r\n / \r / \n hepsi tek satır
//   - Empty rows ignore (trailing newline tolerated)
//   - Header validation: variable name regex (`[a-zA-Z][a-zA-Z0-9_]*`)
//   - Per-row column count validation (header'a eşit olmalı)
//   - Max 50 rows + max 30 columns + max 200 char/value (Pass 80 batch
//     limitleriyle uyumlu)
//
// Pass 82 V1 scope:
//   - parseTabularToVariableSets(input) → { ok, sets, errors[] }
//   - detectDelimiter(input) → "," | "\t"
//   - extractHeader(input) → string[]
//
// Pass 83+ scope:
//   - Quoted field içinde escaped quote (mevcut V1: temel destek)
//   - Custom delimiter (semicolon, pipe)
//   - Type coercion (number/boolean) — şu an her şey string

const VAR_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export type ParseTabularOptions = {
  /**
   * Maksimum satır sayısı (header dahil değil). Default 50 (Pass 80
   * batch service limitiyle uyumlu).
   */
  maxRows?: number;
  /** Maksimum kolon sayısı (variable count). Default 30. */
  maxColumns?: number;
  /** Her hücre için max karakter. Default 200. */
  maxValueLength?: number;
  /** Otomatik delimiter tespitini override et. */
  delimiter?: "," | "\t";
};

export type ParseTabularResult =
  | {
      ok: true;
      delimiter: "," | "\t";
      header: string[];
      sets: Array<Record<string, string>>;
      warnings: string[];
    }
  | {
      ok: false;
      errors: string[];
      delimiter?: "," | "\t";
      partial?: {
        header: string[];
        sets: Array<Record<string, string>>;
      };
    };

/**
 * CSV/TSV input'undaki ilk satırı analiz edip delimiter'ı tespit eder.
 * Tab karakteri ve virgül sayılır; daha çok olan delimiter olarak
 * seçilir. Eşitlik durumunda virgül (CSV daha yaygın).
 */
export function detectDelimiter(input: string): "," | "\t" {
  // İlk newline'a kadar (header row)
  const firstLine = input.split(/\r\n|\r|\n/)[0] ?? "";
  let tabs = 0;
  let commas = 0;
  let inQuote = false;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (inQuote) continue;
    if (ch === "\t") tabs++;
    else if (ch === ",") commas++;
  }
  return tabs > commas ? "\t" : ",";
}

/**
 * Tek satırı delimiter ile böler (RFC 4180 quoted field desteği).
 * Quoted field içinde delimiter ve newline değer parçası sayılır.
 */
function parseRow(line: string, delimiter: "," | "\t"): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        // Escaped quote ("") → tek " içine
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"' && cur.length === 0) {
        // Field başı quote → quoted mode
        inQuote = true;
      } else if (ch === delimiter) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

/**
 * Multi-line input'u satırlara böler — quoted field içinde newline'a
 * tolerant. RFC 4180 davranışı.
 */
function splitLines(input: string): string[] {
  // Newline normalize
  const normalized = input.replace(/\r\n|\r/g, "\n");
  const lines: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') {
      // Escaped quote check (sadece quoted modeda anlamlı)
      if (inQuote && normalized[i + 1] === '"') {
        cur += '""';
        i++;
        continue;
      }
      inQuote = !inQuote;
      cur += ch;
      continue;
    }
    if (ch === "\n" && !inQuote) {
      lines.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines;
}

/**
 * Header row'u extract eder (delimiter otomatik tespit + parse + trim).
 * Variable name regex ile validate edilir.
 *
 * @returns header column adları (sırada)
 */
export function extractHeader(
  input: string,
  delimiter?: "," | "\t",
): string[] {
  const d = delimiter ?? detectDelimiter(input);
  const lines = splitLines(input);
  if (lines.length === 0) return [];
  const headerLine = lines[0]!;
  return parseRow(headerLine, d).map((s) => s.trim());
}

/**
 * Tabular input'u variable sets'e parse eder.
 *
 * @example
 * const csv = `subject,style,mood
 * boho mandala,watercolor,calming
 * geometric line,ink,minimal`;
 * parseTabularToVariableSets(csv);
 * // { ok: true, sets: [
 * //   { subject: "boho mandala", style: "watercolor", mood: "calming" },
 * //   { subject: "geometric line", style: "ink", mood: "minimal" }
 * // ], header: ["subject","style","mood"], delimiter: "," }
 */
export function parseTabularToVariableSets(
  input: string,
  options: ParseTabularOptions = {},
): ParseTabularResult {
  const maxRows = options.maxRows ?? 50;
  const maxColumns = options.maxColumns ?? 30;
  const maxValueLength = options.maxValueLength ?? 200;

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, errors: ["Input boş"] };
  }

  const delimiter = options.delimiter ?? detectDelimiter(trimmed);
  const lines = splitLines(trimmed);

  if (lines.length < 2) {
    return {
      ok: false,
      delimiter,
      errors: [
        "En az 2 satır gerek: 1 header + 1+ data row",
      ],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Header
  const headerCols = parseRow(lines[0]!, delimiter).map((s) => s.trim());
  if (headerCols.length === 0) {
    return { ok: false, delimiter, errors: ["Header satırı boş"] };
  }
  if (headerCols.length > maxColumns) {
    errors.push(
      `Max ${maxColumns} kolon (header: ${headerCols.length})`,
    );
  }
  // Header duplicate check
  const headerSeen = new Set<string>();
  for (const h of headerCols) {
    if (h.length === 0) {
      errors.push("Header'da boş kolon adı var");
      continue;
    }
    if (!VAR_NAME_REGEX.test(h)) {
      errors.push(
        `Geçersiz variable adı: "${h}" (sadece harf+rakam+underscore, harfle başlamalı)`,
      );
    }
    if (headerSeen.has(h)) {
      errors.push(`Header'da tekrar eden kolon: "${h}"`);
    }
    headerSeen.add(h);
  }

  // Data rows
  const dataLines = lines.slice(1).filter((l) => l.trim().length > 0);
  if (dataLines.length === 0) {
    errors.push("Data row'u yok (header sonrası tüm satırlar boş)");
  }
  if (dataLines.length > maxRows) {
    errors.push(
      `Max ${maxRows} data row (geçen: ${dataLines.length})`,
    );
  }

  const sets: Array<Record<string, string>> = [];
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i]!;
    const cols = parseRow(line, delimiter);
    if (cols.length !== headerCols.length) {
      errors.push(
        `Row [${i}] kolon sayısı ${cols.length}, header ${headerCols.length} (eşit olmalı)`,
      );
      continue;
    }
    const entry: Record<string, string> = {};
    let rowOk = true;
    for (let c = 0; c < headerCols.length; c++) {
      const name = headerCols[c]!;
      const value = (cols[c] ?? "").trim();
      if (value.length > maxValueLength) {
        errors.push(
          `Row [${i}].${name} max ${maxValueLength} karakter (${value.length})`,
        );
        rowOk = false;
        break;
      }
      entry[name] = value;
    }
    if (rowOk) sets.push(entry);
  }

  if (errors.length > 0) {
    return {
      ok: false,
      delimiter,
      errors,
      partial: { header: headerCols, sets },
    };
  }

  return {
    ok: true,
    delimiter,
    header: headerCols,
    sets,
    warnings,
  };
}
