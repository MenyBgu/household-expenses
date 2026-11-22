import type { SuggestedNotebookRow } from "@/lib/notebook-import";

export type AnnualOcrLine = {
  text: string;
  y?: number;
};

export type AnnualMonthTotal = {
  month: number;
  amount: number | null;
  sourceLine: string;
};

export type AnnualSummary = {
  year: number;
  months: AnnualMonthTotal[];
};

const MONTH_NAMES = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

function normalizeDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632));
}

export function parseAnnualAmount(value: string): number | null {
  let normalized = normalizeDigits(value)
    .replace(/[₪$€]/g, "")
    .replace(/\s/g, "")
    .trim();
  if (!normalized || !/^\d[\d,.]*$/.test(normalized)) return null;

  if (normalized.includes(",") && normalized.includes(".")) {
    const decimalSeparator = normalized.lastIndexOf(",") > normalized.lastIndexOf(".") ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = normalized.replaceAll(thousandsSeparator, "").replace(decimalSeparator, ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replaceAll(".", "");
  } else if (normalized.includes(",")) {
    const parts = normalized.split(",");
    normalized = parts.at(-1)?.length === 3 ? parts.join("") : normalized.replace(",", ".");
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 && amount <= 10_000_000
    ? Math.round(amount * 100) / 100
    : null;
}

function formatAmount(amount: number | null): string {
  if (amount === null) return "";
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function monthFromLabel(value: string): number | null {
  const normalized = value.trim().toLocaleLowerCase("he-IL");
  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return numeric;
  const index = MONTH_NAMES.findIndex((name) => normalized.includes(name));
  return index >= 0 ? index + 1 : null;
}

function extractYear(lines: AnnualOcrLine[], fallbackYear: number): number {
  const match = lines
    .map((line) => normalizeDigits(line.text).match(/\b(20\d{2})\b/)?.[1])
    .find(Boolean);
  const year = Number(match ?? fallbackYear);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : fallbackYear;
}

function readRowsFromLine(line: string): Array<{ month: number; amount: number | null }> {
  const normalized = normalizeDigits(line).replace(/[|]/g, " ").trim();
  const monthPattern = "(1[0-2]|[1-9]|ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)";
  const matches = [...normalized.matchAll(new RegExp(`(?:^|\\s)${monthPattern}\\s*(?:[.)\\-:]\\s*|\\s+)(\\d[\\d,.]*)(?=\\s|$)`, "gi"))];
  return matches
    .map((match) => {
      const month = monthFromLabel(match[1]);
      return month ? { month, amount: parseAnnualAmount(match[2]) } : null;
    })
    .filter((row): row is { month: number; amount: number | null } => row !== null);
}

export function parseAnnualSummary(lines: AnnualOcrLine[], fallbackYear: number): AnnualSummary {
  const year = extractYear(lines, fallbackYear);
  const detected = new Map<number, AnnualMonthTotal>();
  let pendingMonth: number | null = null;

  for (const line of lines) {
    const text = line.text.trim();
    if (!text || /\b20\d{2}\b/.test(normalizeDigits(text))) continue;

    const rows = readRowsFromLine(text);
    if (rows.length) {
      for (const row of rows) {
        const previous = detected.get(row.month);
        if (!previous || previous.amount === null || previous.amount === row.amount) {
          detected.set(row.month, { ...row, sourceLine: text });
        }
      }
      pendingMonth = null;
      continue;
    }

    const onlyMonth = monthFromLabel(text.replace(/[.)\-:]/g, "").trim());
    if (onlyMonth) {
      pendingMonth = onlyMonth;
      continue;
    }

    if (pendingMonth !== null) {
      const amount = parseAnnualAmount(text);
      if (amount !== null) {
        detected.set(pendingMonth, { month: pendingMonth, amount, sourceLine: text });
        pendingMonth = null;
      }
    }
  }

  return {
    year,
    months: Array.from({ length: 12 }, (_, index) => detected.get(index + 1) ?? {
      month: index + 1,
      amount: null,
      sourceLine: "",
    }),
  };
}

export function annualSummaryToRows(
  summary: AnnualSummary,
  categoryId: string,
): SuggestedNotebookRow[] {
  return summary.months.map((item) => ({
    id: `annual-${summary.year}-${item.month}`,
    expense_date: `${summary.year}-${String(item.month).padStart(2, "0")}-01`,
    merchant_name: `סיכום שנתי ${summary.year}`,
    description: `חודש ${item.month} — ${MONTH_NAMES[item.month - 1]} ${summary.year}`,
    amount: formatAmount(item.amount),
    category_id: categoryId,
    payment_method: "",
    notes: "נוצר מסיכום שנתי מתמונה",
    sourceLine: item.sourceLine || `חודש ${item.month}`,
    confidence: item.amount === null ? 0 : 0.95,
    categorySuggestion: "אחר",
    needsReview: item.amount === null,
  }));
}

export function annualMonthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}
