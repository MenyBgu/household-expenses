import { expect, test } from "@playwright/test";

test.describe("מצב הדגמה", () => {
  test("מציג ממשק בעברית ומאפשר לפתוח הזנה מתמונה", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("הוצאות הבית");
    await expect(page.getByRole("heading", { name: "שלום, בואו נעשה סדר" })).toBeVisible();
    await expect(page.getByText("מצב הדגמה פעיל")).toBeVisible();
    await expect(page.getByText("סך כל ההוצאות")).toBeVisible();

    await page.getByRole("button", { name: "הזנה מתמונה" }).click();
    await expect(page.getByRole("heading", { name: "צילום דף הוצאות" })).toBeVisible();
    await expect(page.getByLabel("החודש שאליו שייכת התמונה")).toBeVisible();
    await expect(page.getByText("בחירה מהגלריה")).toBeVisible();
    await expect(page.getByText("צילום חדש")).toBeVisible();
    await expect(page.locator('input[type="file"]').first()).toHaveAttribute(
      "accept",
      /image\/jpeg/,
    );
    await expect(page.locator('input[type="file"]').nth(1)).toHaveAttribute("capture", "environment");
  });

  test("בטלפון יש ניווט תחתון שעובד", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: "ניווט ראשי" });
    await nav.getByRole("button", { name: "חודש שלם" }).click();
    await expect(page.getByRole("heading", { name: "הזנת חודש שלם" })).toBeVisible();
    await nav.getByRole("button", { name: "תמונה" }).click();
    await expect(page.getByRole("heading", { name: "צילום דף הוצאות" })).toBeVisible();
  });

  test("מאפשר לדפדף בין חודשים ולראות סיכום שנתי", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("tab", { name: "חודשי" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "חודש קודם" }).click();
    await expect(page.getByRole("textbox", { name: "בחירת חודש לניתוח" })).toHaveValue(/2026-10|2026-11/);
    await page.getByRole("tab", { name: "שנתי" }).click();
    await expect(page.getByText(/סיכום שנת 20\d{2}/)).toBeVisible();
    await expect(page.getByText("מגמת ההוצאות השנתית")).toBeVisible();
  });

  test("מאפשר להתחיל הוספת הוצאה גם מתמונה", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "הוספת הוצאה" }).click();
    await page.getByRole("button", { name: "הוספה מתמונה" }).click();
    await expect(page.getByRole("heading", { name: "צילום קבלה או הוצאה" })).toBeVisible();
  });

  test("מאפשר לפתוח סיכום שנתי מתמונה", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "סיכום שנתי מתמונה" }).click();
    await expect(page.getByRole("heading", { name: "צילום סיכום שנתי" })).toBeVisible();
    await expect(page.getByLabel("השנה שאליה שייך הסיכום")).toBeVisible();
    await page.getByRole("button", { name: "מעבר להזנת חודש מתמונה" }).click();
    await expect(page.getByRole("heading", { name: "צילום דף הוצאות" })).toBeVisible();
  });

  test("מאפשר לבחור כמה הוצאות למחיקה מרוכזת", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "הוצאות" }).first().click();
    await page.getByRole("checkbox", { name: "בחירת כל ההוצאות המוצגות" }).check();
    await expect(page.getByRole("button", { name: "מחיקת ההוצאות שנבחרו" })).toBeVisible();
  });
});
