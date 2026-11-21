// @vitest-environment node
import * as Tesseract from "tesseract.js";
import { describe, expect, it } from "vitest";
import { demoCategories } from "@/lib/demo-data";
import {
  detectMonth,
  extractRecognizedLines,
  mergeHebrewAndNumericOcr,
  parseNotebookText,
} from "@/lib/notebook-import";

const imagePath = process.env.OCR_IMAGE;

async function recognize(language: "heb+eng" | "eng") {
  const worker = await Tesseract.createWorker(language, 1);
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
      preserve_interword_spaces: "1",
    });
    return (await worker.recognize(imagePath!, {}, { blocks: true })).data;
  } finally {
    await worker.terminate();
  }
}

describe.skipIf(!imagePath)("OCR על תמונה אמיתית", () => {
  it("מפיק שורות עם סכומים וקטגוריות", async () => {
    const labelData = await recognize("heb+eng");
    const numericData = await recognize("eng");
    const month = detectMonth(extractRecognizedLines(labelData), "2026-01");
    const [year, monthNumber] = month.split("-").map(Number);
    const rows = parseNotebookText(mergeHebrewAndNumericOcr(labelData, numericData), year, monthNumber, demoCategories);
    const names = new Map(demoCategories.map((category) => [category.id, category.name]));

    console.table(rows.map((row) => ({
      amount: row.amount,
      description: row.description,
      category: names.get(row.category_id),
      review: row.needsReview,
    })));
    console.log("month:", month);

    expect(rows.length).toBeGreaterThan(5);
  }, 180_000);
});
