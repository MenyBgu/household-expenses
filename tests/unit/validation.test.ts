import { describe, expect, it } from "vitest";
import { draftRowSchema, expenseSchema } from "@/lib/validation";

const validExpense = {
  merchant_name: "רמי לוי",
  description: "קניות",
  amount: "120.50",
  expense_date: "2026-11-21",
  category_id: "00000000-0000-0000-0000-000000000001",
};

describe("expense validation", () => {
  it("accepts a complete expense", () => {
    expect(expenseSchema.safeParse(validExpense).success).toBe(true);
  });

  it("requires a positive amount", () => {
    expect(expenseSchema.safeParse({ ...validExpense, amount: "0" }).success).toBe(false);
    expect(expenseSchema.safeParse({ ...validExpense, amount: "-1" }).success).toBe(false);
  });

  it("allows a description when the merchant is unknown", () => {
    expect(expenseSchema.safeParse({ ...validExpense, merchant_name: "" }).success).toBe(true);
  });

  it("rejects a row without merchant or description", () => {
    expect(expenseSchema.safeParse({ ...validExpense, merchant_name: "", description: "" }).success).toBe(false);
  });
});

describe("monthly entry row validation", () => {
  it("requires a stable row id", () => {
    expect(draftRowSchema.safeParse({ ...validExpense, id: "row-1" }).success).toBe(true);
    expect(draftRowSchema.safeParse(validExpense).success).toBe(false);
  });
});
