export type HouseholdRole = "admin" | "member";

export type Category = {
  id: string;
  household_id: string;
  name: string;
  color?: string | null;
  is_active: boolean;
  sort_order: number;
};

export type Expense = {
  id: string;
  household_id: string;
  created_by: string;
  merchant_name: string | null;
  description: string | null;
  amount: number;
  currency: string;
  expense_date: string;
  category_id: string;
  payment_method: string | null;
  notes: string | null;
  source: string;
  is_historical: boolean;
  is_recurring: boolean;
  deleted_at?: string | null;
  created_at: string;
  category?: Category;
};

export type DraftRow = {
  id: string;
  expense_date: string;
  merchant_name: string;
  description: string;
  amount: string;
  category_id: string;
  payment_method: string;
  notes: string;
  error?: string;
};

export type MonthlyDraft = {
  id: string;
  household_id: string;
  created_by: string;
  month: number;
  year: number;
  status: "draft" | "committed";
  draft_data: { rows: DraftRow[] };
  version: number;
  updated_at: string;
};

export type Household = {
  id: string;
  name: string;
  default_currency: string;
  role: HouseholdRole;
};
