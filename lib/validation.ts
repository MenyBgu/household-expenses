import { z } from "zod";

export const expenseSchema = z.object({
  merchant_name: z.string().trim().max(120, "שם העסק ארוך מדי").optional(),
  description: z.string().trim().max(240, "התיאור ארוך מדי").optional(),
  amount: z.coerce.number().positive("הסכום חייב להיות גדול מאפס"),
  expense_date: z.string().min(1, "יש לבחור תאריך"),
  category_id: z.string().min(1, "יש לבחור קטגוריה"),
  payment_method: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(500).optional(),
}).superRefine((value, context) => {
  if (!value.merchant_name && !value.description) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["merchant_name"],
      message: "יש למלא שם עסק או תיאור",
    });
  }
});

export const householdSchema = z.object({
  name: z.string().trim().min(1, "יש להזין שם למשק הבית").max(100, "השם ארוך מדי"),
});

export const draftRowSchema = expenseSchema.extend({
  id: z.string(),
});

export function validateDraftRows(rows: unknown[]) {
  return rows.map((row) => {
    const result = draftRowSchema.safeParse(row);
    return result.success
      ? { ...result.data, error: undefined }
      : {
          ...(row as Record<string, unknown>),
          error: result.error.issues[0]?.message ?? "יש לתקן את השורה",
        };
  });
}
