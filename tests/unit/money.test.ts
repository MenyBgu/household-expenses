import { describe, expect, it } from "vitest";
import { fromAgorot, sumMoney, toAgorot } from "@/lib/money";

describe("חישובי כסף באגורות", () => {
  it("ממיר סכום לאגורות שלמות", () => {
    expect(toAgorot("1,245.90")).toBe(124590);
    expect(toAgorot("12.5")).toBe(1250);
    expect(fromAgorot(124590)).toBe(1245.9);
  });

  it("מחבר סכומים בלי שגיאת נקודה צפה", () => {
    expect(sumMoney(["0.1", "0.2", "0.3"])).toBe(0.6);
  });
});
