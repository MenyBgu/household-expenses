import { describe, expect, it } from "vitest";
import { formatCurrency, monthBounds, percentChange, previousIsoMonth } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats Israeli shekels without floating point noise", () => {
    expect(formatCurrency(1245.9)).toContain("1,245.90");
    expect(formatCurrency(1245.9)).toContain("₪");
  });
});

describe("percentChange", () => {
  it("calculates a percentage change", () => {
    expect(percentChange(120, 100)).toBe(20);
    expect(percentChange(80, 100)).toBe(-20);
  });

  it("returns null when there is no previous period", () => {
    expect(percentChange(120, 0)).toBeNull();
  });
});

describe("חודשי דיווח", () => {
  it("מחזיר את סוף החודש הנכון ולא את תחילת החודש הבא", () => {
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("מטפל גם במעבר בין שנים", () => {
    expect(previousIsoMonth("2026-01")).toBe("2025-12");
  });
});
