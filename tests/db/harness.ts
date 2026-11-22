import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = process.cwd();

export type TestDb = PGlite;

/** מסד PGlite חדש עם מדמה-Supabase ומיגרציית הבסיס. */
export async function createTestDb(): Promise<TestDb> {
  const db = await PGlite.create();
  await db.exec(readFileSync(join(ROOT, "tests/db/auth-shim.sql"), "utf8"));
  await db.exec(readFileSync(join(ROOT, "supabase/migrations/0001_initial_schema.sql"), "utf8"));
  await db.exec(readFileSync(join(ROOT, "supabase/migrations/0003_merge_housing_categories.sql"), "utf8"));
  await db.exec(readFileSync(join(ROOT, "supabase/migrations/0004_merge_expense_categories.sql"), "utf8"));
  return db;
}

/** מריץ את השאילתות הבאות בהרשאות משתמש (authenticated) עם auth.uid() שלו. null = anon. */
export async function asUser(db: TestDb, userId: string | null): Promise<void> {
  await db.exec("reset role");
  const claims = userId ? { sub: userId, role: "authenticated" } : { role: "anon" };
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims)]);
  await db.exec(`set role ${userId ? "authenticated" : "anon"}`);
}

/** חזרה להרשאות מנהל מסד הנתונים (bypass RLS), לצורך יצירת נתוני בדיקה. */
export async function asAdmin(db: TestDb): Promise<void> {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', '', false)");
}

export async function createUser(db: TestDb, label: string): Promise<string> {
  await asAdmin(db);
  const result = await db.query<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id",
    [`${label}@example.com`, JSON.stringify({ full_name: `משתמש ${label}` })],
  );
  return result.rows[0].id;
}

export async function createHousehold(db: TestDb, ownerId: string, name: string): Promise<string> {
  await asUser(db, ownerId);
  const result = await db.query<{ id: string }>("select id from public.create_household($1, 'ILS')", [name]);
  return result.rows[0].id;
}

export async function addMember(
  db: TestDb,
  adminId: string,
  householdId: string,
  userId: string,
): Promise<void> {
  await asUser(db, adminId);
  await db.query(
    "insert into public.household_members (household_id, user_id, role) values ($1, $2, 'member')",
    [householdId, userId],
  );
}

export async function categoryIdByName(
  db: TestDb,
  userId: string,
  householdId: string,
  name: string,
): Promise<string> {
  await asUser(db, userId);
  const result = await db.query<{ id: string }>(
    "select id from public.categories where household_id = $1 and name = $2",
    [householdId, name],
  );
  return result.rows[0].id;
}

/** מזריק הוצאה בהרשאות המשתמש עצמו ומחזיר את מזהה ההוצאה. */
export async function insertExpense(
  db: TestDb,
  userId: string,
  householdId: string,
  fields: {
    categoryId: string;
    amount: string;
    date: string;
    merchant?: string | null;
    description?: string | null;
    paymentMethod?: string | null;
  },
): Promise<string> {
  await asUser(db, userId);
  const result = await db.query<{ id: string }>(
    `insert into public.expenses
       (household_id, created_by, category_id, amount, expense_date, merchant_name, description, payment_method)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id`,
    [
      householdId,
      userId,
      fields.categoryId,
      fields.amount,
      fields.date,
      fields.merchant ?? null,
      fields.description ?? null,
      fields.paymentMethod ?? null,
    ],
  );
  return result.rows[0].id;
}
