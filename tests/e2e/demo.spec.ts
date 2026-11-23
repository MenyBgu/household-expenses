import { expect, test } from "@playwright/test";

test.describe("מצב הדגמה", () => {
  test("מציג ממשק בעברית ומאפשר לפתוח הזנה מתמונה", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("הוצאות הבית");
    await expect(page.getByRole("heading", { name: "שלום, בואו נעשה סדר" })).toBeVisible();
    await expect(page.getByText("מצב הדגמה פעיל")).toBeVisible();
    await expect(page.getByText("סך כל ההוצאות")).toBeVisible();
    await expect(page.getByText("© כל הזכויות שמורות למני בוגנים")).toBeVisible();

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
    const monthPicker = page.getByRole("textbox", { name: "בחירת חודש לניתוח" });
    await expect(monthPicker).toHaveValue(/2026-10|2026-11/);
    const selectedMonth = await monthPicker.inputValue();
    await page.getByRole("button", { name: "הוצאות" }).first().click();
    await page.getByRole("button", { name: "בית" }).first().click();
    await expect(monthPicker).toHaveValue(selectedMonth);
    await page.getByRole("tab", { name: "שנתי" }).click();
    await expect(page.getByText(/סיכום שנת 20\d{2}/)).toBeVisible();
    await expect(page.getByText("מגמת ההוצאות השנתית")).toBeVisible();
    await expect(page.getByText("השוואת הוצאות בין שנים")).toBeVisible();
  });

  test("שומר את מסך הזנת החודש והחודש גם אחרי שמירת טיוטה וטעינה מחדש", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "הזנת חודש שלם" }).first().click();

    const monthInput = page.getByLabel("החודש");
    await monthInput.fill("2025-05");
    await page.getByRole("button", { name: "הוספת שורה" }).first().click();
    await page.locator(".monthly-table input[placeholder='עסק']").fill("בדיקת הקשר");
    await page.locator(".monthly-table input[placeholder='0.00']").fill("10");
    await page.locator(".monthly-table select").first().selectOption({ index: 1 });
    await page.getByRole("button", { name: "שמירת טיוטה" }).click();
    await expect(page.getByText("הטיוטה נשמרה")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "הזנת חודש שלם" })).toBeVisible();
    await expect(page.getByLabel("החודש")).toHaveValue("2025-05");
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

  test("שומר את מסנן החודש במסך ההוצאות אחרי עריכה ושמירה", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "הוצאות" }).first().click();

    const monthFilter = page.locator(".filters-bar input[type='month']");
    await monthFilter.fill("2026-11");
    await page.getByRole("button", { name: "עריכת הוצאה" }).first().click();
    await page.getByLabel("שם העסק").fill("עסק מעודכן");
    await page.getByRole("button", { name: "שמירת שינויים" }).click();

    await expect(page.getByRole("heading", { name: "הוצאות" })).toBeVisible();
    await expect(monthFilter).toHaveValue("2026-11");
    await expect(page.getByText("עסק מעודכן")).toBeVisible();
  });

  test("מאפשר ליצור הוצאה קבועה למספר חודשים", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "הוספת הוצאה" }).first().click();
    await page.getByLabel("שם העסק").fill("כבלים");
    await page.getByLabel("סכום").fill("120");
    await page.getByLabel("תאריך").fill("2026-11-01");
    await page.getByLabel("קטגוריה").selectOption({ label: "תקשורת ואינטרנט" });
    await page.getByLabel("סוג ההוצאה").selectOption("fixed");
    await page.getByLabel("לכמה חודשים").fill("3");
    await page.getByRole("button", { name: "שמירת הוצאה" }).click();

    await page.getByRole("button", { name: "הוצאות" }).first().click();
    await expect(page.getByText("הוצאה קבועה · 3 חודשים").first()).toBeVisible();
  });

  test("מאפשר לשכפל הוצאה ולבטל מחיקה", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "הוצאות" }).first().click();
    await page.getByRole("button", { name: "שכפול הוצאה" }).first().click();
    await expect(page.getByLabel("שם העסק")).toHaveValue("רמי לוי");
    await page.getByRole("button", { name: "ביטול" }).click();

    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "מחיקת הוצאה" }).first().click();
    await page.getByRole("button", { name: "ביטול" }).click();
    await expect(page.getByText("רמי לוי")).toBeVisible();
  });

  test("מאפשר לפתוח הגדרות ולשנות את שם משק הבית", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "הגדרות" }).first().click();
    await expect(page.getByRole("heading", { name: "הגדרות" })).toBeVisible();
    await page.getByLabel("שם משק הבית").fill("משפחת ישראלי החדשה");
    await page.getByRole("button", { name: "שמירת ההגדרות" }).click();
    await expect(page.getByText("ההגדרות נשמרו בהצלחה")).toBeVisible();
    await expect(page.getByText("משפחת ישראלי החדשה").first()).toBeVisible();
  });
});
