import type { Category, DraftRow } from "@/lib/types";

export type SuggestedNotebookRow = DraftRow & {
  sourceLine: string;
  confidence: number;
  categorySuggestion: string;
  needsReview: boolean;
};

const CATEGORY_RULES: Array<{ category: string; words: string[] }> = [
  { category: "דיור", words: ["משכנתא", "משכנתה", "שכירות", "שכר דירה", "ארנונה", "חשמל", "חברת החשמל", "מים", "מי אביבים", "תאגיד מים", "גז", "ועד בית", "וועד בית", "ועד הבית", "דירה", "אחזקת הבית", "אחזקה", "שיפוץ", "תיקון בבית", "בעלי מקצוע", "אינסטלטור", "חשמלאי", "נגר", "שיפוצניק"] },
  { category: "ביטוחים", words: ["ביטוח"] },
  { category: "צרכנות וקניות", words: ["שמלה", "חולצה", "מכנסיים", "נעליים", "בגדים", "ביגוד", "חליפה", "תספורת", "מספרה", "איפור", "שיער", "מניקור", "קוסמטיקה", "סופר", "מכולת", "מזון", "רמי לוי", "שופרסל", "ויקטורי", "יינות ביתן", "חזה עוף", "עוף"] },
  { category: "חינוך", words: ["צהרון", "חוג", "שכר לימוד", "מעון"] },
  { category: "חיות מחמד", words: ["וטרינר", "אוכל לכלב", "אוכל לחתול"] },
  { category: "מנויים ושירותים דיגיטליים", words: ["נטפליקס", "ספוטיפיי", "מנוי"] },
  { category: "בנק ועמלות", words: ["עמלה", "עמלת", "הלוואה", "הלוואות"] },
  { category: "מסעדות ומשלוחים", words: ["מסעדה", "מסעדות", "משלוח", "וולט", "אוכל בחוץ", "קפה", "פאב"] },
  { category: "תקשורת ואינטרנט", words: ["אינטרנט", "בזק", "הוט", "סלקום", "פרטנר", "תקשורת", "סלולר", "פלאפון", "טלפון נייד"] },
  { category: "תחבורה ורכב", words: ["אוטובוס", "רכבת", "מונית", "רב קו", "תחבורה", "דלק", "תחנת דלק", "סונול", "פז", "דור אלון", "מוסך", "טסט", "צמיגים", "חניה", "חנייה", "כביש 6", "רכב"] },
  { category: "בריאות ותרופות", words: ["רופא", "רופאה", "קופת חולים", "טיפול", "מרפאה", "תרופה", "תרופות", "בית מרקחת", "סופר פארם"] },
  { category: "בילויים ופנאי", words: ["חופשה", "חופשות", "מלון", "טיסה", "טיסות", "נסיעה", "נסיעות", "טיול", "טיולים", "נופש", "צימר"] },
  { category: "אירועים", words: ["חתונה", "חינה", "בר מצווה", "ברמצווה", "ברית", "יום הולדת", "יומולדת"] },
  { category: "מתנות ותרומות", words: ["מתנה", "תרומה"] },
];

function normalizeHebrew(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[״“”"׳']/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLocaleLowerCase("he-IL");
}

export function restoreHebrewSpacing(value: string): string {
  return value
    .replace(/(^|\s)ממשכנת/g, "$1משכנת")
    .replace(/אלמוג\s*מור\s*יוסףחתונה/g, "אלמוג מור יוסף חתונה")
    .replace(/ועד\s*בית/g, "ועד בית")
    .replace(/חזה\s*עוף/g, "חזה עוף")
    .replace(/פאב\s*שדרות/g, "פאב שדרות")
    .replace(/איפור\s*ושיער/g, "איפור ושיער")
    .replace(/חתונה\s*מאי/g, "חתונה מאי")
    .replace(/חינה\s*מאי/g, "חינה מאי")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAmount(value: string): number | null {
  const normalized = value.replace(/,/g, "").replace(/[₪$€]/g, "").trim();
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function findAmount(line: string): { amount: number; text: string } | null {
  const amountPattern = /(?:₪\s*)?\d{1,9}(?:[,.]\d{1,2})?(?:\s*₪)?/g;
  const match = line.match(amountPattern)?.[0];
  if (!match) return null;
  const amount = parseAmount(match);
  if (amount === null) return null;
  return { amount, text: line.replace(match, " ").replace(/\s+/g, " ").trim() };
}

function isMonthHeading(text: string): boolean {
  return /^(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s*(?:20\d{2}|\d{2})?$/.test(text);
}

export function suggestCategory(
  text: string,
  categories: Category[],
): { categoryId: string; categoryName: string; confidence: number } {
  const normalized = normalizeHebrew(text);
  let rule: (typeof CATEGORY_RULES)[number] | undefined;
  let longestMatch = 0;
  for (const candidate of CATEGORY_RULES) {
    for (const word of candidate.words) {
      const normalizedWord = normalizeHebrew(word);
      if (normalizedWord.length > longestMatch && normalized.includes(normalizedWord)) {
        rule = candidate;
        longestMatch = normalizedWord.length;
      }
    }
  }
  const activeCategories = categories.filter((category) => category.is_active);
  const fallback = activeCategories.find((category) => category.name === "אחר") ?? activeCategories[0];
  const category = rule
    ? activeCategories.find((item) => item.name === rule.category)
    : undefined;

  if (!category) {
    return {
      categoryId: fallback?.id ?? "",
      categoryName: fallback?.name ?? "דורש בדיקה",
      confidence: 0.25,
    };
  }

  return {
    categoryId: category.id,
    categoryName: category.name,
    confidence: 0.92,
  };
}

export function parseNotebookText(
  text: string,
  year: number,
  month: number,
  categories: Category[],
): SuggestedNotebookRow[] {
  const date = `${year}-${String(month).padStart(2, "0")}-01`;
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((sourceLine, index) => {
      const parsed = findAmount(sourceLine);
      const description = restoreHebrewSpacing(parsed?.text ?? sourceLine);
      const hasHebrew = /[\u0590-\u05FF]/.test(description);
      if (!hasHebrew || isMonthHeading(description)) return null;
      const suggestion = suggestCategory(description, categories);
      const hasAmount = parsed !== null;

      return {
        id: `ocr-${index + 1}`,
        expense_date: date,
        merchant_name: "",
        description,
        amount: parsed ? String(parsed.amount) : "",
        category_id: suggestion.categoryId,
        payment_method: "",
        notes: "נוצר מהזנת תמונה — יש לבדוק ולאשר",
        sourceLine,
        confidence: hasAmount ? suggestion.confidence : 0,
        categorySuggestion: suggestion.categoryName,
        needsReview: !hasAmount || suggestion.confidence < 0.7,
      };
    })
    .filter((row): row is SuggestedNotebookRow => row !== null);
}

export type RecognizedLine = { text: string; y: number };

const MONTH_NAMES = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export function extractRecognizedLines(data: unknown): RecognizedLine[] {
  const blocks = (data as {
    blocks?: Array<{
      paragraphs?: Array<{ lines?: Array<{ text: string; bbox: { y0: number } }> }>;
    }> | null;
  }).blocks;
  const lines = blocks?.flatMap((block) =>
    block.paragraphs?.flatMap((paragraph) =>
      paragraph.lines?.map((line) => ({ text: line.text.trim(), y: line.bbox.y0 })) ?? [],
    ) ?? [],
  ).filter((line) => line.text);

  if (lines?.length) return lines;
  return ((data as { text?: string }).text ?? "")
    .split(/\r?\n/)
    .map((text, index) => ({ text: text.trim(), y: index * 40 }))
    .filter((line) => line.text);
}

function extractNumericValue(text: string): string {
  const matches = text.match(/\d{1,9}(?:[,.]\d{1,2})?/g);
  return matches?.at(-1)?.replace(",", ".") ?? "";
}

function cleanRecognizedLabel(text: string): string {
  return text
    .replace(/\d{1,9}(?:[,.]\d{1,2})?/g, " ")
    .replace(/[^\p{L}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectMonth(lines: RecognizedLine[], fallback: string): string {
  const pattern = new RegExp(`^(${MONTH_NAMES.join("|")})(20\\d{2}|\\d{2})$`);
  const match = lines
    .map((line) => line.text.replace(/[^\u0590-\u05FF0-9]/g, "").replace(/^\d+/, ""))
    .map((line) => line.match(pattern))
    .find(Boolean);
  if (!match) return fallback;
  const year = match[2].length === 2 ? `20${match[2]}` : match[2];
  return `${year}-${String(MONTH_NAMES.indexOf(match[1]) + 1).padStart(2, "0")}`;
}

export function mergeHebrewAndNumericOcr(labelData: unknown, numericData: unknown): string {
  const labels = extractRecognizedLines(labelData);
  return extractRecognizedLines(numericData)
    .map((numericLine) => {
      const amount = extractNumericValue(numericLine.text);
      const nearestLabel = labels.reduce<RecognizedLine | undefined>((nearest, label) => {
        if (!nearest || Math.abs(label.y - numericLine.y) < Math.abs(nearest.y - numericLine.y)) return label;
        return nearest;
      }, undefined);
      const label = restoreHebrewSpacing(cleanRecognizedLabel(nearestLabel?.text ?? ""));
      return { amount, label };
    })
    .filter(({ amount, label }) => amount && !isMonthHeading(label))
    .map(({ amount, label }) => `${amount} ${label}`.trim())
    .join("\n");
}

export function formatOcrProgress(progress: number): string {
  return `קורא את התמונה… ${Math.round(progress * 100)}%`;
}
