import { afterEach, describe, expect, it } from "vitest";
import {
  addMember,
  asAdmin,
  asUser,
  categoryIdByName,
  createHousehold,
  createTestDb,
  createUser,
  insertExpense,
  type TestDb,
} from "./harness";

describe("סכמת מסד הנתונים והרשאות", () => {
  let db: TestDb | undefined;

  afterEach(async () => {
    await db?.close();
    db = undefined;
  });

  it("יוצר משק בית עם קטגוריות ברירת מחדל, כולל אירועים", async () => {
    db = await createTestDb();
    const userId = await createUser(db, "owner");
    const householdId = await createHousehold(db, userId, "משפחת ישראלי");

    await asAdmin(db);
    const result = await db.query<{ count: string }>(
      "select count(*)::text as count from public.categories where household_id = $1",
      [householdId],
    );

    expect(result.rows[0].count).toBe("32");
  });

  it("מסמן קטגוריות מאוחדות כלא פעילות ומשנה את שם התחבורה", async () => {
    db = await createTestDb();
    const userId = await createUser(db, "housing");
    const householdId = await createHousehold(db, userId, "משפחת דיור");

    await asAdmin(db);
    const result = await db.query<{ name: string; is_active: boolean }>(
      "select name, is_active from public.categories where household_id = $1 and name in ('מזון וסופר', 'שכירות או משכנתה', 'חשמל', 'מים', 'ארנונה', 'גז', 'אחזקת הבית', 'תחבורה', 'דלק', 'רכב', 'הלוואות', 'סלולר', 'תרופות', 'חופשות ונסיעות', 'ביגוד ואופנה', 'בעלי מקצוע') order by name",
      [householdId],
    );

    expect(result.rows).toHaveLength(15);
    expect(result.rows.every((category) => !category.is_active)).toBe(true);
    const renamed = await db.query<{ is_active: boolean }>(
      "select is_active from public.categories where household_id = $1 and name = 'תחבורה ורכב'",
      [householdId],
    );
    expect(renamed.rows[0].is_active).toBe(true);
    const health = await db.query<{ is_active: boolean }>(
      "select is_active from public.categories where household_id = $1 and name = 'בריאות ותרופות'",
      [householdId],
    );
    expect(health.rows[0].is_active).toBe(true);
  });

  it("מסכם הוצאות לפי שנה במסד הנתונים", async () => {
    db = await createTestDb();
    const owner = await createUser(db, "yearly");
    const householdId = await createHousehold(db, owner, "סיכום שנתי");
    const categoryId = await categoryIdByName(db, owner, householdId, "דיור");

    await insertExpense(db, owner, householdId, {
      categoryId,
      amount: "100",
      date: "2024-06-01",
      merchant: "חשמל",
    });
    await insertExpense(db, owner, householdId, {
      categoryId,
      amount: "250",
      date: "2025-06-01",
      merchant: "מים",
    });

    await asUser(db, owner);
    const result = await db.query<{ year: number; total_amount: string; item_count: string }>(
      "select year, total_amount::text, item_count::text from public.expense_yearly_totals($1) order by year",
      [householdId],
    );

    expect(result.rows).toEqual([
      { year: 2024, total_amount: "100.00", item_count: "1" },
      { year: 2025, total_amount: "250.00", item_count: "1" },
    ]);
  });

  it("מונע מחבר לקרוא נתונים ממשק בית אחר", async () => {
    db = await createTestDb();
    const owner = await createUser(db, "owner");
    const outsider = await createUser(db, "outsider");
    const householdId = await createHousehold(db, owner, "בית פרטי");
    const categoryId = await categoryIdByName(db, owner, householdId, "צרכנות וקניות");
    await insertExpense(db, owner, householdId, {
      categoryId,
      amount: "125.50",
      date: "2026-12-01",
      merchant: "סופר",
    });

    await asUser(db, outsider);
    const householdRows = await db.query("select * from public.households");
    const expenseRows = await db.query("select * from public.expenses");

    expect(householdRows.rows).toHaveLength(0);
    expect(expenseRows.rows).toHaveLength(0);
  });

  it("מאפשר לקבל הזמנה למשק בית רק עם האימייל המתאים", async () => {
    db = await createTestDb();
    const owner = await createUser(db, "owner");
    const invited = await createUser(db, "invited");
    const householdId = await createHousehold(db, owner, "משפחה משותפת");

    await asUser(db, owner);
    await db.query(
      `insert into public.household_invitations
        (household_id, invited_email, invited_by, token_hash)
       values ($1, 'invited@example.com', $2, 'test-invitation-hash')`,
      [householdId, owner],
    );

    await asUser(db, invited);
    await db.query("select public.accept_household_invitation($1)", ["test-invitation-hash"]);

    await asAdmin(db);
    const members = await db.query<{ count: string }>(
      "select count(*)::text as count from public.household_members where household_id = $1",
      [householdId],
    );
    expect(members.rows[0].count).toBe("2");
  });

  it("מאפשר לחברי אותו משק בית לראות הוצאות, אך לא לשנות את היוצר", async () => {
    db = await createTestDb();
    const owner = await createUser(db, "owner");
    const member = await createUser(db, "member");
    const householdId = await createHousehold(db, owner, "משפחה");
    await addMember(db, owner, householdId, member);
    const categoryId = await categoryIdByName(db, owner, householdId, "תחבורה ורכב");
    const expenseId = await insertExpense(db, owner, householdId, {
      categoryId,
      amount: "80",
      date: "2026-12-02",
      merchant: "דלק",
    });

    await asUser(db, member);
    const visible = await db.query("select id from public.expenses where id = $1", [expenseId]);
    expect(visible.rows).toHaveLength(1);

    await db.query(
      "update public.expenses set created_by = $1 where id = $2",
      [member, expenseId],
    );
    const unchanged = await db.query<{ created_by: string }>(
      "select created_by from public.expenses where id = $1",
      [expenseId],
    );
    expect(unchanged.rows[0].created_by).toBe(owner);
  });

  it("חוסם מחיקה פיזית ומאפשר מחיקה רכה ושחזור", async () => {
    db = await createTestDb();
    const owner = await createUser(db, "owner");
    const householdId = await createHousehold(db, owner, "משפחה");
    const categoryId = await categoryIdByName(db, owner, householdId, "דיור");
    const expenseId = await insertExpense(db, owner, householdId, {
      categoryId,
      amount: "350",
      date: "2026-12-03",
      merchant: "ועד בית",
    });

    await asUser(db, owner);
    await expect(db.query("delete from public.expenses where id = $1", [expenseId])).rejects.toThrow();

    await db.query("update public.expenses set deleted_at = now() where id = $1", [expenseId]);
    const hidden = await db.query("select id from public.expenses where id = $1", [expenseId]);
    expect(hidden.rows).toHaveLength(1);

    await db.query("update public.expenses set deleted_at = null where id = $1", [expenseId]);
    const restored = await db.query("select id from public.expenses where id = $1", [expenseId]);
    expect(restored.rows).toHaveLength(1);
  });

  it("שומר הזנה חודשית פעם אחת בלבד גם אם שולחים אותה שוב", async () => {
    db = await createTestDb();
    const owner = await createUser(db, "owner");
    const householdId = await createHousehold(db, owner, "משפחה");
    const categoryId = await categoryIdByName(db, owner, householdId, "תחבורה ורכב");

    await asUser(db, owner);
    const draft = await db.query<{ id: string }>(
      `insert into public.monthly_entry_drafts
        (household_id, created_by, year, month, draft_data)
       values ($1, $2, 2026, 12, '{"rows":[]}'::jsonb)
       returning id`,
      [householdId, owner],
    );
    const draftId = draft.rows[0].id;
    const batchKey = "10000000-0000-0000-0000-000000000001";
    const rows = JSON.stringify([
      {
        merchant_name: "תחנת דלק",
        description: "",
        amount: "200",
        expense_date: "2026-12-01",
        category_id: categoryId,
        payment_method: "",
        paid_by: owner,
        notes: "",
      },
      {
        merchant_name: "",
        description: "דלק",
        amount: "75.50",
        expense_date: "2026-12-02",
        category_id: categoryId,
        payment_method: "",
        paid_by: owner,
        notes: "",
      },
    ]);

    const save = async () =>
      db!.query<{ result: { status: string; inserted_count: number } }>(
        `select public.commit_monthly_entry(
          $1, $2, $3, 1, $4::jsonb, '{"rows":[]}'::jsonb, 'ILS'
        ) as result`,
        [householdId, draftId, batchKey, rows],
      );

    const first = await save();
    const second = await save();
    expect(first.rows[0].result.status).toBe("saved");
    expect(second.rows[0].result.status).toBe("already_saved");
    expect(Number(second.rows[0].result.inserted_count)).toBe(2);

    const expenses = await db.query<{ count: string }>(
      "select count(*)::text as count from public.expenses where household_id = $1",
      [householdId],
    );
    expect(expenses.rows[0].count).toBe("2");
  });

  it("לא שומר אף שורה כאשר אחת משורות ההזנה אינה תקינה", async () => {
    db = await createTestDb();
    const owner = await createUser(db, "owner");
    const householdId = await createHousehold(db, owner, "משפחה");
    const categoryId = await categoryIdByName(db, owner, householdId, "צרכנות וקניות");

    await asUser(db, owner);
    const draft = await db.query<{ id: string }>(
      `insert into public.monthly_entry_drafts
        (household_id, created_by, year, month, draft_data)
       values ($1, $2, 2026, 12, '{"rows":[]}'::jsonb)
       returning id`,
      [householdId, owner],
    );
    const rows = JSON.stringify([
      {
        merchant_name: "סופר",
        amount: "100",
        expense_date: "2026-12-01",
        category_id: categoryId,
      },
      {
        merchant_name: "שורה ללא סכום",
        amount: "",
        expense_date: "2026-12-02",
        category_id: categoryId,
      },
    ]);

    await expect(
      db.query(
        `select public.commit_monthly_entry(
          $1, $2, '20000000-0000-0000-0000-000000000001', 1,
          $3::jsonb, '{"rows":[]}'::jsonb, 'ILS'
        )`,
        [householdId, draft.rows[0].id, rows],
      ),
    ).rejects.toThrow("לא נשמרה אף שורה");

    const expenses = await db.query<{ count: string }>(
      "select count(*)::text as count from public.expenses where household_id = $1",
      [householdId],
    );
    expect(expenses.rows[0].count).toBe("0");
  });
});
