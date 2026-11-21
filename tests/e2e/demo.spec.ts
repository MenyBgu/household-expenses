import { expect, test } from "@playwright/test";

test.describe("מצב הדגמה", () => {
  test("מציג ממשק בעברית ומאפשר לפתוח הזנה מתמונה", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("הוצאות הבית");
    await expect(page.getByRole("heading", { name: "שלום, בואו נעשה סדר" })).toBeVisible();
    await expect(page.getByText("מצב הדגמה פעיל")).toBeVisible();

    await page.getByRole("button", { name: "הזנה מתמונה" }).click();
    await expect(page.getByRole("heading", { name: "צילום דף הוצאות" })).toBeVisible();
    await expect(page.getByLabel("החודש שאליו שייכת התמונה")).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveAttribute(
      "accept",
      /image\/jpeg/,
    );
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
});
