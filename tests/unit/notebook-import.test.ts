import { describe, expect, it } from "vitest";
import {
  detectMonth,
  extractRecognizedLines,
  mergeHebrewAndNumericOcr,
  parseNotebookText,
  restoreHebrewSpacing,
  suggestCategory,
} from "@/lib/notebook-import";
import { annualSummaryToRows, parseAnnualSummary } from "@/lib/annual-import";
import { demoCategories } from "@/lib/demo-data";
import type { Category } from "@/lib/types";

const categories: Category[] = [
  { id: "fuel", household_id: "house", name: "דלק", is_active: true, sort_order: 1 },
  { id: "mortgage", household_id: "house", name: "שכירות או משכנתה", is_active: true, sort_order: 2 },
  { id: "home", household_id: "house", name: "דיור", is_active: true, sort_order: 3 },
  { id: "events", household_id: "house", name: "אירועים", is_active: true, sort_order: 4 },
  { id: "other", household_id: "house", name: "אחר", is_active: true, sort_order: 5 },
];

describe("קריאת רשימת הוצאות מתמונה", () => {
  it("כולל את כל קטגוריות ברירת המחדל גם במצב הדגמה", () => {
    expect(demoCategories).toHaveLength(32);
    expect(demoCategories.map((category) => category.name)).toContain("שכירות או משכנתה");
  });

  it("מפרק שורות עם סכום בתחילת השורה", () => {
    const rows = parseNotebookText("אוקטובר 26\n200 דלק\n1000 משכנתא\n350 וועד בית\n2000 חתונה מאי", 2026, 12, categories);

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => row.amount)).toEqual(["200", "1000", "350", "2000"]);
    expect(rows.map((row) => row.category_id)).toEqual(["fuel", "home", "home", "events"]);
    expect(rows[0].expense_date).toBe("2026-12-01");
  });

  it("מזהה סכום גם בסוף השורה ומסמן שורה ללא סכום לבדיקה", () => {
    const rows = parseNotebookText("דלק 200\nועד בית", 2026, 12, categories);

    expect(rows[0].description).toBe("דלק");
    expect(rows[0].category_id).toBe("fuel");
    expect(rows[1].needsReview).toBe(true);
    expect(rows[1].amount).toBe("");
  });

  it("נרמול עברית מזהה ניסוחים דומים", () => {
    expect(suggestCategory("וועד הבית", categories).categoryId).toBe("home");
    expect(suggestCategory("חתונה מאי", categories).categoryId).toBe("events");
    expect(suggestCategory("תחנת דלק", categories).confidence).toBeGreaterThan(0.8);
    expect(suggestCategory("משהו לא מוכר", categories).categoryId).toBe("other");
  });

  it("משחזר רווחים נפוצים ש-OCR מחבר", () => {
    expect(restoreHebrewSpacing("ועדבית")).toBe("ועד בית");
    expect(restoreHebrewSpacing("חזהעוף")).toBe("חזה עוף");
    expect(restoreHebrewSpacing("חתונהמאי")).toBe("חתונה מאי");
  });

  it("מעדיף את ההתאמה הארוכה והמדויקת ביותר", () => {
    const byName = (text: string) =>
      demoCategories.find((category) => category.id === suggestCategory(text, demoCategories).categoryId)?.name;
    expect(byName("סופר פארם")).toBe("תרופות");
    expect(byName("ארנונה")).toBe("דיור");
    expect(byName("גז")).toBe("דיור");
    expect(byName("שמלה")).toBe("ביגוד ואופנה");
    expect(byName("ספר קטן")).toBe("אחר");
    expect(restoreHebrewSpacing("ממשכנתא")).toBe("משכנתא");
  });

  it("מאחד שתי קריאות OCR לפי שורה ומזהה את החודש מהכותרת", () => {
    const labels = { blocks: [{ paragraphs: [{ lines: [
      { text: "אוקטובר26", bbox: { y0: 0 } },
      { text: "ועדבית ~", bbox: { y0: 50 } },
      { text: "חינהמאי", bbox: { y0: 100 } },
    ] }] }] };
    const digits = { text: "x\n350\n2000" };
    expect(detectMonth(extractRecognizedLines(labels), "2026-01")).toBe("2026-10");
    expect(mergeHebrewAndNumericOcr(labels, { blocks: [{ paragraphs: [{ lines: [
      { text: "350", bbox: { y0: 52 } },
      { text: "2000", bbox: { y0: 98 } },
    ] }] }] })).toBe("350 ועד בית\n2000 חינה מאי");
    expect(extractRecognizedLines(digits)).toHaveLength(3);
  });

  it("מסנן רעש לטיני ברור שה-OCR הוסיף", () => {
    const rows = parseNotebookText("12 In N\n2000 חתונה מאי", 2026, 10, categories);
    expect(rows).toHaveLength(1);
    expect(rows[0].category_id).toBe("events");
  });

  it("מזהה סיכום שנתי לפי מספרי חודשים וסכומים", () => {
    const summary = parseAnnualSummary(
      [
        { text: "שנת 2025" },
        { text: "1. 2880" },
        { text: "2. 2,135" },
        { text: "3. 1000" },
        { text: "4. 0" },
      ],
      2026,
    );

    expect(summary.year).toBe(2025);
    expect(summary.months.slice(0, 4).map((month) => month.amount)).toEqual([2880, 2135, 1000, 0]);
    expect(summary.months[4].amount).toBeNull();
  });

  it("מזהה גם את פורמט התמונה: סכום לפני מספר החודש", () => {
    const summary = parseAnnualSummary(
      [
        { text: "2020" },
        { text: "2880 .1" },
        { text: "2135 .2" },
        { text: "510 .3" },
        { text: "580 .4" },
        { text: "1370 .5" },
        { text: "3930 .6" },
        { text: "2020 .7" },
        { text: "3610 .8" },
        { text: "104675 .9" },
        { text: "6650 .10" },
        { text: "6020 .11" },
        { text: "3300 .12" },
      ],
      2026,
    );

    expect(summary.year).toBe(2020);
    expect(summary.months.map((month) => month.amount)).toEqual([
      2880, 2135, 510, 580, 1370, 3930, 2020, 3610, 104675, 6650, 6020, 3300,
    ]);
  });

  it("משלים סכום שנמצא בשורה שאחרי מספר החודש", () => {
    const summary = parseAnnualSummary([{ text: "שנת 2025" }, { text: "1." }, { text: "2880" }], 2026);

    expect(summary.months[0].amount).toBe(2880);
    expect(summary.months[1].amount).toBeNull();
  });

  it("יוצר 12 שורות ניתנות לעריכה ומסמן חודשים שלא זוהו", () => {
    const rows = annualSummaryToRows(
      parseAnnualSummary([{ text: "2025" }, { text: "1. 2880" }], 2026),
      "other",
    );

    expect(rows).toHaveLength(12);
    expect(rows[0].expense_date).toBe("2025-01-01");
    expect(rows[0].amount).toBe("2880");
    expect(rows[11].needsReview).toBe(true);
  });
});
