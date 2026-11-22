"use client";

import * as Tesseract from "tesseract.js";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Check, ImagePlus, LoaderCircle, RotateCcw, Sparkles, Upload, X } from "lucide-react";
import type { Category, DraftRow } from "@/lib/types";
import { annualMonthName, annualSummaryToRows, parseAnnualAmount, parseAnnualSummary } from "@/lib/annual-import";
import {
  detectMonth,
  extractRecognizedLines,
  formatOcrProgress,
  mergeHebrewAndNumericOcr,
  parseNotebookText,
  type SuggestedNotebookRow,
} from "@/lib/notebook-import";

type NotebookImportProps = {
  categories: Category[];
  initialMonth: string;
  destination: "monthly" | "expense" | "annual";
  onConfirm: (rows: DraftRow[], month: string, file: File, extractedText: string) => Promise<void> | void;
  onCancel: () => void;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function NotebookImport({ categories, initialMonth, destination, onConfirm, onCancel }: NotebookImportProps) {
  const isAnnual = destination === "annual";
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [month, setMonth] = useState(initialMonth);
  const [rows, setRows] = useState<SuggestedNotebookRow[]>([]);
  const [extractedText, setExtractedText] = useState("");
  const [status, setStatus] = useState<"idle" | "reading" | "ready">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectFile(nextFile: File | undefined) {
    if (!nextFile) return;
    setError("");
    if (!nextFile.type.startsWith("image/")) {
      setError("אפשר להעלות קובץ תמונה בלבד.");
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setError("התמונה גדולה מדי. אפשר להעלות תמונה עד 10 מגה־בייט.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setRows([]);
    setExtractedText("");
    setStatus("idle");
  }

  async function readImage() {
    if (!file) {
      setError("יש לבחור תמונה לפני הקריאה.");
      return;
    }
    const [yearText, monthText] = month.split("-");
    const year = Number(yearText);
    const monthNumber = Number(monthText);
    setError("");
    setStatus("reading");
    setProgress(0);

    try {
      const recognize = async (language: "heb+eng" | "eng", start: number, end: number) => {
        const worker = await Tesseract.createWorker(language, 1, {
          logger: (message) => {
            if (typeof message.progress === "number") {
              setProgress(start + message.progress * (end - start));
            }
          },
        });
        try {
          await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            preserve_interword_spaces: "1",
          });
          const result = await worker.recognize(file, {}, { blocks: true });
          return result.data;
        } finally {
          await worker.terminate();
        }
      };

      // מודל משולב מזהה את המילים בעברית, ומודל אנגלי מזהה את הספרות בצורה טובה יותר.
      const labelData = await recognize("heb+eng", 0, 0.5);
      const numericData = await recognize("eng", 0.5, 1);
      if (isAnnual) {
        const numericLines = extractRecognizedLines(numericData);
        const labelLines = extractRecognizedLines(labelData);
        const annualLines = [...numericLines, ...labelLines];
        const summary = parseAnnualSummary(annualLines, year);
        const otherCategory = categories.find((category) => category.name === "אחר") ?? categories[0];
        setMonth(`${summary.year}-01`);
        setExtractedText(annualLines.map((line) => line.text).join("\n"));
        setRows(annualSummaryToRows(summary, otherCategory?.id ?? ""));
      } else {
        const detectedMonth = detectMonth(extractRecognizedLines(labelData), month);
        const [detectedYear, detectedMonthNumber] = detectedMonth.split("-").map(Number);
        setMonth(detectedMonth);
        const mergedText = mergeHebrewAndNumericOcr(labelData, numericData);
        setExtractedText(mergedText);
        setRows(parseNotebookText(mergedText, detectedYear || year, detectedMonthNumber || monthNumber, categories));
      }
      setStatus("ready");
    } catch {
      setStatus("idle");
      setError("לא הצלחנו לקרוא את התמונה. אפשר לנסות תמונה חדה יותר או להזין את הנתונים ידנית.");
    }
  }

  function updateRow(id: string, field: keyof DraftRow, value: string) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value,
              needsReview: field === "amount" || field === "category_id" ? false : row.needsReview,
            }
          : row,
      ),
    );
  }

  const validRows = rows.filter((row) => {
    if (!row.category_id || !(row.merchant_name || row.description)) return false;
    if (isAnnual) return (parseAnnualAmount(row.amount) ?? 0) > 0;
    return Boolean(row.amount);
  });
  const annualRowsComplete = !isAnnual || (
    rows.length === 12 &&
    rows.every((row) => row.amount.trim() !== "" && (parseAnnualAmount(row.amount) ?? -1) >= 0)
  );

  async function confirmRows() {
    if (!file || !validRows.length || !annualRowsComplete) return;
    setConfirming(true);
    setError("");
    try {
      const rowsToConfirm = isAnnual
        ? validRows.map((row) => ({ ...row, amount: String(parseAnnualAmount(row.amount) ?? 0) }))
        : validRows;
      await onConfirm(rowsToConfirm, month, file, extractedText);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "שמירת התמונה נכשלה.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{isAnnual ? "סיכום שנתי מתמונה" : destination === "expense" ? "הוספה מתמונה" : "העברה מתמונה"}</p>
          <h1>{isAnnual ? "צילום סיכום שנתי" : destination === "expense" ? "צילום קבלה או הוצאה" : "צילום דף הוצאות"}</h1>
          <p className="muted">{isAnnual ? "המערכת תזהה את השנה ואת הסכום של כל חודש. אפשר לתקן לפני השמירה." : destination === "expense" ? "אפשר לצלם קבלה אחת או כמה פריטים. המערכת תציע את הפרטים לפני השמירה." : "המערכת תציע שורות וקטגוריות. שום דבר לא נשמר בלי אישור שלך."}</p>
        </div>
        <button className="icon-button" type="button" onClick={onCancel} aria-label="סגירת מסך התמונה">
          <X size={18} />
        </button>
      </div>

      <div className="photo-import-layout">
        <div className="form-card">
          <label>
            {isAnnual ? "השנה שאליה שייך הסיכום" : "החודש שאליו שייכת התמונה"}
            {isAnnual ? (
              <input type="number" min="2000" max="2100" value={month.split("-")[0]} onChange={(event) => setMonth(`${event.target.value}-01`)} />
            ) : (
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            )}
          </label>
          <label className="upload-dropzone">
            <ImagePlus size={28} />
            <strong>{isAnnual ? "בחירת תמונה של סיכום שנתי" : "בחירת תמונה מהטלפון או מהמחשב"}</strong>
            <span className="small muted">JPG, PNG או HEIC עד 10 מגה־בייט</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              capture="environment"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
          </label>
          {file && <p className="small muted">נבחרה תמונה: {file.name}</p>}
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={onCancel}>ביטול</button>
            <button className="primary-button" type="button" onClick={readImage} disabled={!file || status === "reading"}>
              {status === "reading" ? <><LoaderCircle className="spin" size={17} /> {formatOcrProgress(progress)}</> : <><Upload size={17} /> קריאת התמונה</>}
            </button>
          </div>
          <p className="small muted">
            הקריאה מתבצעת בדפדפן. כתב יד או תמונה לא ברורה עלולים לדרוש תיקון ידני.
          </p>
        </div>

        <div className="image-preview-card">
          {previewUrl ? (
            <Image src={previewUrl} alt="תצוגה מקדימה של דף ההוצאות שנבחר" width={800} height={600} unoptimized />
          ) : (
            <div className="empty-state"><ImagePlus size={30} /><p>כאן תופיע תצוגה מקדימה של התמונה.</p></div>
          )}
        </div>
      </div>

      {status === "ready" && (
        <div className="form-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow"><Sparkles size={15} /> הצעות מהתמונה</p>
              <h2>בדיקה לפני שמירה</h2>
            </div>
            <span className="small muted">{isAnnual ? `${validRows.length} חודשים עם סכום` : `${validRows.length} שורות מוכנות`}</span>
          </div>
          {isAnnual && !annualRowsComplete && <p className="field-error" role="alert">יש להשלים סכום לכל אחד מ־12 החודשים. בחודש ללא הוצאות אפשר לרשום 0.</p>}
          <div className="import-review-list">
            {rows.length === 0 && <div className="empty-state"><p>לא זוהו שורות. אפשר להזין את ההוצאות ידנית.</p></div>}
            {rows.map((row, index) => (
              <article className={`import-review-row ${row.needsReview ? "needs-review" : ""}`} key={row.id}>
                <div className="import-review-heading">
                  <strong>{isAnnual ? `חודש ${index + 1} — ${annualMonthName(index + 1)}` : `שורה ${index + 1}`}</strong>
                  <span className="small muted">{row.needsReview ? "דורשת בדיקה" : "הצעה טובה"}</span>
                </div>
                <p className="small muted">זוהה: {row.sourceLine}</p>
                {isAnnual ? (
                  <div className="form-grid">
                    <label>סכום החודש<input inputMode="decimal" value={row.amount} onChange={(event) => updateRow(row.id, "amount", event.target.value)} placeholder="אפשר לרשום 0" /></label>
                    <label>חודש<input value={`${row.expense_date.slice(0, 7)}`} readOnly /></label>
                  </div>
                ) : (
                  <div className="form-grid">
                    <label>סכום<input inputMode="decimal" value={row.amount} onChange={(event) => updateRow(row.id, "amount", event.target.value)} /></label>
                    <label>תיאור<input value={row.description} onChange={(event) => updateRow(row.id, "description", event.target.value)} /></label>
                    <label>קטגוריה<select value={row.category_id} onChange={(event) => updateRow(row.id, "category_id", event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                    <label>תאריך משוער<input type="date" value={row.expense_date} onChange={(event) => updateRow(row.id, "expense_date", event.target.value)} /></label>
                  </div>
                )}
              </article>
            ))}
          </div>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => { setRows([]); setStatus("idle"); }}><RotateCcw size={17} /> קריאה מחדש</button>
            <button className="primary-button" type="button" disabled={!validRows.length || !annualRowsComplete || confirming} onClick={confirmRows}>
              <Check size={17} /> {confirming ? "שומר את התמונה..." : isAnnual ? "אישור ושמירת הסיכום השנתי" : destination === "expense" ? "אישור ושמירת ההוצאה" : "אישור והמשך להזנה החודשית"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
