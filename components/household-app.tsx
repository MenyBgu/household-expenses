"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Copy,
  FileText,
  Home,
  ImagePlus,
  LogIn,
  LogOut,
  Plus,
  Receipt,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { demoCategories, demoExpenses, demoHousehold } from "@/lib/demo-data";
import { BrandLogo, HouseholdIllustration } from "@/components/brand";
import { NotebookImport } from "@/components/notebook-import";
import { suggestCategory } from "@/lib/notebook-import";
import { formatCurrency, formatDate, monthTitle, nextIsoMonth, percentChange, previousIsoMonth } from "@/lib/format";
import { splitMoney, sumMoney } from "@/lib/money";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Category, DraftRow, Expense, Household } from "@/lib/types";
import { draftRowSchema, expenseSchema, householdSchema } from "@/lib/validation";

type View = "dashboard" | "expenses" | "monthly" | "photo" | "drafts" | "settings";

type YearlyTotal = {
  year: number;
  total: number;
  count: number;
};

type DashboardRange = "month" | "year";

const mobileNavItems: Array<{ id: View; label: string; Icon: typeof Home }> = [
  { id: "dashboard", label: "בית", Icon: Home },
  { id: "expenses", label: "הוצאות", Icon: Receipt },
  { id: "monthly", label: "חודש שלם", Icon: FileText },
  { id: "photo", label: "תמונה", Icon: ImagePlus },
];

type HouseholdAppProps = {
  supabaseConfigured: boolean;
  userId?: string;
  userEmail?: string;
  displayName?: string;
  initialDate: string;
  initialMonth: string;
  loginNext?: string;
};

type ExpenseFormValues = {
  merchant_name: string;
  description: string;
  amount: string;
  expense_date: string;
  category_id: string;
  payment_method: string;
  notes: string;
  schedule_type: "none" | "fixed" | "installment";
  schedule_months: string;
};

type ScheduleType = ExpenseFormValues["schedule_type"];

const paymentMethodOptions = [
  { value: "credit_card", label: "אשראי" },
  { value: "cash", label: "מזומן" },
  { value: "bank_transfer", label: "העברה בנקאית" },
  { value: "direct_debit", label: "הוראת קבע" },
  { value: "check", label: "צ׳ק" },
  { value: "bit_paybox", label: "ביט / פייבוקס" },
  { value: "other", label: "אחר" },
];

const legacyPaymentMethods: Record<string, string> = {
  "אשראי": "credit_card",
  "מזומן": "cash",
  "העברה": "bank_transfer",
  "הוראת קבע": "direct_debit",
};

const mergedCategoryNames = new Set([
  "מזון וסופר",
  "שכירות או משכנתה",
  "חשמל",
  "מים",
  "ארנונה",
  "גז",
  "סלולר",
  "הלוואות",
  "דלק",
  "רכב",
  "תחבורה",
  "אחזקת הבית",
  "תרופות",
  "בריאות",
  "חופשות ונסיעות",
  "ביגוד ואופנה",
  "בעלי מקצוע",
]);

function toDatabasePaymentMethod(value: string) {
  return legacyPaymentMethods[value] ?? value;
}

function addMonthsToIsoDate(date: string, offset: number) {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + offset, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function scheduleLabel(type: ScheduleType, months: number | null | undefined) {
  if (type === "fixed") return `הוצאה קבועה · ${months} חודשים`;
  if (type === "installment") return `תשלומים · ${months} חודשים`;
  return "";
}

function makeNewRow(categoryId = demoCategories[0]?.id ?? "", date: string): DraftRow {
  return {
    id: crypto.randomUUID(),
    expense_date: date,
    merchant_name: "",
    description: "",
    amount: "",
    category_id: categoryId,
    payment_method: "",
    notes: "",
  };
}

function emptyExpenseForm(categoryId = "", date: string): ExpenseFormValues {
  return {
    merchant_name: "",
    description: "",
    amount: "",
    expense_date: date,
    category_id: categoryId,
    payment_method: "",
    notes: "",
    schedule_type: "none",
    schedule_months: "",
  };
}

function displayNameFromEmail(email?: string) {
  return email?.split("@")[0] || "משתמש";
}

function readableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const details = [value.message, value.code, value.details, value.hint]
      .filter((item): item is string => typeof item === "string" && item.length > 0);
    if (details.length) return `${fallback}: ${details.join(" · ")}`;
  }
  return fallback;
}

function LoginScreen({ onLogin, configured }: { onLogin: () => void; configured: boolean }) {
  return (
    <main className="login-page">
      <section className="login-card">
        <BrandLogo />
        <HouseholdIllustration />
        <p className="eyebrow">הוצאות הבית</p>
        <h1>מנהלים את הוצאות הבית בפשטות</h1>
        <p className="muted">
          מקום אחד, ברור ונוח, לרישום הוצאות, להעברת המחברת ולתמונה חודשית של ההתנהלות בבית.
        </p>
        {configured ? (
          <button className="primary-button wide-button" onClick={onLogin}>
            <LogIn size={18} />
            התחברות באמצעות Google
          </button>
        ) : (
          <div className="notice info-notice">
            <CircleHelp size={18} />
            <span>המערכת פועלת כרגע במצב הדגמה. לאחר חיבור Supabase תופעל התחברות Google.</span>
          </div>
        )}
        <p className="small muted">המידע שלך מופרד לפי משק בית ואינו משותף עם משתמשים אחרים.</p>
      </section>
    </main>
  );
}

function Onboarding({
  onCreate,
  displayName,
  demoMode,
}: {
  onCreate: (name: string) => Promise<void>;
  displayName: string;
  demoMode: boolean;
}) {
  const [name, setName] = useState(demoMode ? demoHousehold.name : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = householdSchema.safeParse({ name });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "יש לתקן את השדה");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onCreate(result.data.name);
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "יצירת משק הבית נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card onboarding-card">
        <BrandLogo />
        <p className="eyebrow">ברוכים הבאים, {displayName}</p>
        <h1>ניצור את משק הבית הראשון</h1>
        <p className="muted">אפשר לשנות את השם בהמשך. בשלב זה רק אתה תהיה חבר במשק הבית.</p>
        <form onSubmit={submit} className="stack-form">
          <label>
            שם משק הבית
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="לדוגמה: משפחת כהן" autoFocus />
          </label>
          {error && <p className="field-error">{error}</p>}
          <button className="primary-button wide-button" disabled={saving}>
            {saving ? "שומר..." : "יצירת משק הבית"}
          </button>
        </form>
      </section>
    </main>
  );
}

function StatCard({
  title,
  value,
  helper,
  icon,
  tone = "blue",
}: {
  title: string;
  value: string;
  helper?: string;
  icon: React.ReactNode;
  tone?: "blue" | "green" | "orange" | "purple";
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <div className="stat-icon">{icon}</div>
      <p className="stat-title">{title}</p>
      <p className="stat-value">{value}</p>
      {helper && <p className="stat-helper">{helper}</p>}
    </article>
  );
}

function ExpenseForm({
  categories,
  initial,
  editingId,
  onCancel,
  onPhoto,
  onSave,
}: {
  categories: Category[];
  initial: ExpenseFormValues;
  editingId?: string;
  onCancel?: () => void;
  onPhoto?: () => void;
  onSave: (values: ExpenseFormValues, id?: string) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [categoryTouched, setCategoryTouched] = useState(Boolean(initial.category_id));

  function change(name: keyof ExpenseFormValues, value: string) {
    setValues((current) => {
      const next = { ...current, [name]: value };
      if (!categoryTouched && (name === "merchant_name" || name === "description")) {
        const suggestion = suggestCategory(`${next.merchant_name} ${next.description}`, categories);
        return { ...next, category_id: suggestion.categoryId };
      }
      return next;
    });
    if (name === "category_id") setCategoryTouched(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = expenseSchema.safeParse(values);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "יש לתקן את הפרטים");
      return;
    }
    const scheduleMonths = Number(values.schedule_months);
    if (values.schedule_type !== "none" && (!Number.isInteger(scheduleMonths) || scheduleMonths < 1 || scheduleMonths > 120)) {
      setError("יש לבחור משך של 1 עד 120 חודשים.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave(values, editingId);
    } catch (saveError) {
      setError(readableError(saveError, "שמירת ההוצאה נכשלה"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{editingId ? "עריכת הוצאה" : "הוספת הוצאה"}</p>
          <h2>{editingId ? "עדכון פרטי ההוצאה" : "מה הוצאתם?"}</h2>
        </div>
        {onCancel && <button type="button" className="icon-button" onClick={onCancel} aria-label="סגירה"><X size={18} /></button>}
      </div>
      <div className="form-grid">
        <label className="span-two">
          שם העסק
          <input value={values.merchant_name} onChange={(event) => change("merchant_name", event.target.value)} placeholder="לדוגמה: רמי לוי" />
        </label>
        <label>
          סכום
          <div className="input-with-suffix"><input inputMode="decimal" value={values.amount} onChange={(event) => change("amount", event.target.value)} placeholder="0.00" /><span>₪</span></div>
        </label>
        <label>
          תאריך
          <input type="date" value={values.expense_date} onChange={(event) => change("expense_date", event.target.value)} />
        </label>
        <label>
          קטגוריה
          <select value={values.category_id} onChange={(event) => change("category_id", event.target.value)}>
            <option value="">בחירת קטגוריה</option>
            {categories.filter((category) => category.is_active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label>
          אמצעי תשלום
          <select value={values.payment_method} onChange={(event) => change("payment_method", event.target.value)}>
            <option value="">לא צוין</option>
            {paymentMethodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="span-two">
          תיאור או הערה
          <textarea value={values.description} onChange={(event) => change("description", event.target.value)} placeholder="מה נקנה או עבור מה שולם?" rows={2} />
        </label>
        <label className="span-two">
          סוג ההוצאה
          <select value={values.schedule_type} disabled={Boolean(editingId)} onChange={(event) => change("schedule_type", event.target.value as ScheduleType)}>
            <option value="none">הוצאה רגילה</option>
            <option value="fixed">הוצאה קבועה</option>
            <option value="installment">תשלום בתשלומים</option>
          </select>
          {editingId && <span className="small muted">עריכת חודש בודד לא משנה את שאר חודשי הסדרה.</span>}
        </label>
        {values.schedule_type !== "none" && (
          <label>
            {values.schedule_type === "installment" ? "מספר תשלומים" : "לכמה חודשים"}
            <input inputMode="numeric" type="number" min="1" max="120" value={values.schedule_months} disabled={Boolean(editingId)} onChange={(event) => change("schedule_months", event.target.value)} placeholder="לדוגמה: 12" />
            {values.schedule_type === "installment" && <span className="small muted">הסכום יחולק שווה ככל האפשר בין החודשים.</span>}
          </label>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
      <div className="form-actions">
        {onCancel && <button type="button" className="secondary-button" onClick={onCancel}>ביטול</button>}
        {!editingId && onPhoto && <button type="button" className="secondary-button" onClick={onPhoto}><ImagePlus size={17} /> הוספה מתמונה</button>}
        <button className="primary-button" disabled={saving}>{saving ? "שומר..." : editingId ? "שמירת שינויים" : "שמירת הוצאה"}</button>
      </div>
    </form>
  );
}

function MonthlyEntry({
  rows,
  categories,
  expenses,
  month,
  onMonthChange,
  onChange,
  onSaveDraft,
  onCommit,
  onAddRow,
  onDeleteRow,
}: {
  rows: DraftRow[];
  categories: Category[];
  expenses: Expense[];
  month: string;
  onMonthChange: (month: string) => void;
  onChange: (id: string, field: keyof DraftRow, value: string) => void;
  onSaveDraft: (silent?: boolean) => Promise<void>;
  onCommit: () => Promise<number | undefined>;
  onAddRow: () => void;
  onDeleteRow: (id: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const saveDraftRef = useRef(onSaveDraft);
  const validRows = rows.filter((row) => draftRowSchema.safeParse(row).success);
  const total = sumMoney(validRows.map((row) => row.amount));
  const duplicateCount = validRows.filter((row) =>
    expenses.some((expense) =>
      expense.expense_date === row.expense_date &&
      Math.abs(expense.amount - Number(row.amount)) < 0.01 &&
      (expense.merchant_name || "").trim().toLowerCase() === row.merchant_name.trim().toLowerCase(),
    ),
  ).length;

  useEffect(() => {
    saveDraftRef.current = onSaveDraft;
  }, [onSaveDraft]);

  useEffect(() => {
    if (!rows.length) return;
    const timeout = window.setTimeout(() => {
      void saveDraftRef.current(true);
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [month, rows]);

  async function saveDraft(silent = false) {
    setSaving(true);
    setMessage("");
    try {
      await onSaveDraft(silent);
      if (!silent) setMessage("הטיוטה נשמרה. אפשר לחזור אליה מאוחר יותר.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "שמירת הטיוטה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  async function commit() {
    setSaving(true);
    setMessage("");
    try {
      const remaining = await onCommit();
      setMessage(remaining ? `השורות התקינות נשמרו. ${remaining} שורות נשארו בטיוטה לתיקון.` : "ההוצאות נשמרו בהצלחה.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "שמירת ההוצאות נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">העברה מהמחברת</p>
          <h1>הזנת חודש שלם</h1>
          <p className="muted">הזינו כמה שורות ברצף, שמרו טיוטה ואשרו רק אחרי בדיקה.</p>
        </div>
        <label className="month-picker"><CalendarDays size={18} /><span className="sr-only">החודש</span><input type="month" value={month} onChange={(event) => onMonthChange(event.target.value)} /></label>
      </div>
      <div className="entry-summary">
        <div><span>שורות</span><strong>{rows.length}</strong></div>
        <div><span>תקינות</span><strong className={validRows.length === rows.length ? "success-text" : "warning-text"}>{validRows.length}/{rows.length}</strong></div>
        <div><span>סכום כולל</span><strong>{formatCurrency(total)}</strong></div>
        <div><span>כפילויות אפשריות</span><strong className={duplicateCount ? "warning-text" : ""}>{duplicateCount}</strong></div>
      </div>
      <div className="table-toolbar">
        <button className="secondary-button" type="button" onClick={onAddRow}><Plus size={17} /> הוספת שורה</button>
        <span className="small muted">טיפ: אפשר להדביק כמה שורות מ-Excel לתוך הטבלה.</span>
      </div>
      <div className="monthly-table-wrap">
        <table className="monthly-table">
          <thead><tr><th>תאריך</th><th>שם העסק</th><th>תיאור</th><th>סכום</th><th>קטגוריה</th><th>אמצעי תשלום</th><th aria-label="פעולות" /></tr></thead>
          <tbody>
            {rows.map((row) => {
              const validation = draftRowSchema.safeParse(row);
              return (
                <tr key={row.id} className={!validation.success ? "invalid-row" : ""}>
                  <td><input type="date" value={row.expense_date} onChange={(event) => onChange(row.id, "expense_date", event.target.value)} /></td>
                  <td><input value={row.merchant_name} onChange={(event) => onChange(row.id, "merchant_name", event.target.value)} placeholder="עסק" /></td>
                  <td><input value={row.description} onChange={(event) => onChange(row.id, "description", event.target.value)} placeholder="תיאור" /></td>
                  <td><input inputMode="decimal" value={row.amount} onChange={(event) => onChange(row.id, "amount", event.target.value)} placeholder="0.00" /></td>
                  <td><select value={row.category_id} onChange={(event) => onChange(row.id, "category_id", event.target.value)}><option value="">קטגוריה</option>{categories.filter((category) => category.is_active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></td>
                  <td><select value={row.payment_method} onChange={(event) => onChange(row.id, "payment_method", event.target.value)}><option value="">לא צוין</option>{paymentMethodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></td>
                  <td><button className="icon-button danger-icon" type="button" onClick={() => onDeleteRow(row.id)} aria-label="מחיקת שורה"><Trash2 size={17} /></button></td>
                  {!validation.success && <td className="row-error" colSpan={7}>{validation.error.issues[0]?.message}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="empty-table"><FileText size={28} /><p>עדיין אין שורות. הוסיפו את ההוצאה הראשונה מהמחברת.</p><button className="secondary-button" onClick={onAddRow}><Plus size={17} /> הוספת שורה</button></div>}
      </div>
      <div className="monthly-mobile-list">
        {rows.map((row, index) => {
          const validation = draftRowSchema.safeParse(row);
          return (
            <article className={`mobile-entry-card ${!validation.success ? "invalid-row" : ""}`} key={row.id}>
              <div className="mobile-entry-heading"><strong>הוצאה {index + 1}</strong><button className="icon-button danger-icon" type="button" onClick={() => onDeleteRow(row.id)} aria-label="מחיקת שורה"><Trash2 size={17} /></button></div>
              <div className="mobile-entry-fields">
                <label>תאריך<input type="date" value={row.expense_date} onChange={(event) => onChange(row.id, "expense_date", event.target.value)} /></label>
                <label>סכום<input inputMode="decimal" value={row.amount} onChange={(event) => onChange(row.id, "amount", event.target.value)} placeholder="0.00" /></label>
                <label>שם העסק<input value={row.merchant_name} onChange={(event) => onChange(row.id, "merchant_name", event.target.value)} placeholder="עסק" /></label>
                <label>קטגוריה<select value={row.category_id} onChange={(event) => onChange(row.id, "category_id", event.target.value)}><option value="">בחירה</option>{categories.filter((category) => category.is_active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label className="mobile-span-two">תיאור<input value={row.description} onChange={(event) => onChange(row.id, "description", event.target.value)} placeholder="תיאור קצר" /></label>
              </div>
              {!validation.success && <p className="row-error">{validation.error.issues[0]?.message}</p>}
            </article>
          );
        })}
      </div>
      {message && <div className="notice success-notice"><Check size={18} />{message}</div>}
      <div className="form-actions">
        <button className="secondary-button" onClick={() => void saveDraft()} disabled={saving}>שמירת טיוטה</button>
        <button className="primary-button" onClick={commit} disabled={saving || validRows.length === 0}><Check size={17} /> {validRows.length && validRows.length < rows.length ? `שמירת ${validRows.length} השורות התקינות` : "אישור ושמירת ההוצאות"}</button>
      </div>
    </section>
  );
}

function Dashboard({
  expenses,
  categories,
  selectedMonth,
  onMonthChange,
  range,
  onRangeChange,
  yearWindowStart,
  onYearWindowStart,
  onAdd,
  onNavigate,
  onAnnualPhoto,
  allTimeTotal,
  yearlyTotals,
}: {
  expenses: Expense[];
  categories: Category[];
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  yearWindowStart: number;
  onYearWindowStart: (year: number) => void;
  onAdd: () => void;
  onNavigate: (view: View) => void;
  onAnnualPhoto: () => void;
  allTimeTotal: number | null | undefined;
  yearlyTotals: YearlyTotal[] | null | undefined;
}) {
  const displayedAllTimeTotal = allTimeTotal === undefined ? sumMoney(expenses.map((expense) => expense.amount)) : allTimeTotal;
  const selectedYear = selectedMonth.slice(0, 4);
  const selectedYearNumber = Number(selectedYear);
  const monthExpenses = expenses.filter((expense) => expense.expense_date.startsWith(selectedMonth));
  const previousMonth = expenses.filter((expense) => expense.expense_date.startsWith(previousIsoMonth(selectedMonth)));
  const yearExpenses = expenses.filter((expense) => expense.expense_date.startsWith(`${selectedYear}-`));
  const total = sumMoney(monthExpenses.map((expense) => expense.amount));
  const previousTotal = sumMoney(previousMonth.map((expense) => expense.amount));
  const change = percentChange(total, previousTotal);
  const byCategory = categories.filter((category) => category.is_active).map((category) => ({
    name: category.name,
    amount: sumMoney(monthExpenses.filter((expense) => expense.category_id === category.id).map((expense) => expense.amount)),
  })).filter((category) => category.amount > 0).sort((a, b) => b.amount - a.amount);
  const largest = byCategory[0];
  const dailyTotals = Array.from(new Set(monthExpenses.map((expense) => expense.expense_date)))
    .sort()
    .map((date) => ({
      day: date.slice(-2),
      amount: sumMoney(monthExpenses.filter((expense) => expense.expense_date === date).map((expense) => expense.amount)),
    }));
  const annualTotals = Array.from({ length: 12 }, (_, index) => {
    const month = `${selectedYear}-${String(index + 1).padStart(2, "0")}`;
    const monthData = yearExpenses.filter((expense) => expense.expense_date.startsWith(month));
    return {
      month,
      label: monthTitle(month).replace(selectedYear, "").trim(),
      amount: sumMoney(monthData.map((expense) => expense.amount)),
      count: monthData.length,
    };
  });
  const annualTotal = sumMoney(yearExpenses.map((expense) => expense.amount));
  const annualAverage = annualTotals.filter((item) => item.count > 0);
  const highestMonth = [...annualTotals].sort((a, b) => b.amount - a.amount)[0];
  const annualByCategory = categories.filter((category) => category.is_active).map((category) => ({
    name: category.name,
    amount: sumMoney(yearExpenses.filter((expense) => expense.category_id === category.id).map((expense) => expense.amount)),
  })).filter((category) => category.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 8);
  const localYearlyTotals = Array.from(new Set(expenses.map((expense) => Number(expense.expense_date.slice(0, 4)))))
    .filter((year) => Number.isInteger(year))
    .map((year) => ({
      year,
      total: sumMoney(expenses.filter((expense) => expense.expense_date.startsWith(`${year}-`)).map((expense) => expense.amount)),
      count: expenses.filter((expense) => expense.expense_date.startsWith(`${year}-`)).length,
    }));
  const comparisonSource = yearlyTotals ?? localYearlyTotals;
  const totalsByYear = new Map(comparisonSource.map((item) => [item.year, item]));
  const sourceYears = comparisonSource.map((item) => item.year);
  const firstComparisonYear = Math.min(selectedYearNumber, ...(sourceYears.length ? sourceYears : [selectedYearNumber]));
  const lastComparisonYear = Math.max(selectedYearNumber, ...(sourceYears.length ? sourceYears : [selectedYearNumber]));
  const maxWindowStart = Math.max(firstComparisonYear, lastComparisonYear - 9);
  const comparisonStart = Math.min(Math.max(yearWindowStart, firstComparisonYear), maxWindowStart);
  const comparisonYears = Array.from(
    { length: Math.min(10, lastComparisonYear - firstComparisonYear + 1) },
    (_, index) => comparisonStart + index,
  );
  const comparisonData = comparisonYears.map((year) => ({
    year,
    amount: totalsByYear.get(year)?.total ?? 0,
    count: totalsByYear.get(year)?.count ?? 0,
  }));
  const hasPreviousComparisonWindow = comparisonStart > firstComparisonYear;
  const hasNextComparisonWindow = comparisonStart < maxWindowStart;

  return (
    <section className="content-section">
      <div className="section-heading">
        <div><p className="eyebrow">{range === "month" ? monthTitle(selectedMonth) : `סיכום שנת ${selectedYear}`}</p><h1>שלום, בואו נעשה סדר</h1><p className="muted">{range === "month" ? "זו תמונת המצב של ההוצאות שלכם החודש." : "מבט פשוט על המגמות וההוצאות לאורך השנה."}</p></div>
        <button className="primary-button" onClick={onAdd}><Plus size={18} /> הוספת הוצאה</button>
      </div>
      <div className="analytics-toolbar">
        <div className="range-tabs" role="tablist" aria-label="טווח ניתוח">
          <button className={range === "month" ? "active" : ""} role="tab" aria-selected={range === "month"} onClick={() => onRangeChange("month")}>חודשי</button>
          <button className={range === "year" ? "active" : ""} role="tab" aria-selected={range === "year"} onClick={() => onRangeChange("year")}>שנתי</button>
        </div>
        {range === "month" && (
          <div className="month-navigation">
            <button className="icon-button" onClick={() => onMonthChange(previousIsoMonth(selectedMonth))} aria-label="חודש קודם"><ChevronRight size={18} /></button>
            <strong>{monthTitle(selectedMonth)}</strong>
            <input type="month" value={selectedMonth} onChange={(event) => onMonthChange(event.target.value)} aria-label="בחירת חודש לניתוח" />
            <button className="icon-button" onClick={() => onMonthChange(nextIsoMonth(selectedMonth))} aria-label="חודש הבא"><ChevronLeft size={18} /></button>
          </div>
        )}
        {range === "year" && <label className="year-picker"><span>שנה</span><input type="number" min="2000" max="2100" value={selectedYear} onChange={(event) => onMonthChange(`${event.target.value}-01`)} /></label>}
      </div>
      {range === "month" ? (
        <>
          <div className="stats-grid">
            <StatCard title="הוצאות החודש" value={formatCurrency(total)} helper={`${monthExpenses.length} הוצאות`} icon={<Wallet size={20} />} />
            <StatCard title="לעומת החודש הקודם" value={change === null ? "אין נתונים" : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`} helper={previousTotal ? formatCurrency(previousTotal) : "לא קיימים נתוני השוואה"} icon={change !== null && change >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />} tone={change !== null && change > 0 ? "orange" : "green"} />
            <StatCard title="הקטגוריה הגדולה" value={largest?.name ?? "אין עדיין"} helper={largest ? formatCurrency(largest.amount) : "הוסיפו הוצאה כדי לראות"} icon={<BarChart3 size={20} />} tone="purple" />
            <StatCard title="הוצאות היסטוריות" value={String(monthExpenses.filter((expense) => expense.is_historical).length)} helper="הועברו מהמחברת" icon={<FileText size={20} />} tone="blue" />
            <StatCard title="סך כל ההוצאות" value={displayedAllTimeTotal === null ? "לא זמין" : formatCurrency(displayedAllTimeTotal)} helper="מצטבר מכל השנים" icon={<Wallet size={20} />} tone="blue" />
          </div>
          <div className="dashboard-grid">
            <article className="panel chart-panel">
              <div className="panel-heading"><div><h2>קצב ההוצאות</h2><p className="muted">סכום לפי יום בחודש</p></div><BarChart3 size={20} className="muted-icon" /></div>
              {dailyTotals.length ? <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={dailyTotals} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="day" stroke="var(--muted)" fontSize={11} /><YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(value) => `${value} ₪`} /><Tooltip formatter={(value) => formatCurrency(Number(value))} labelFormatter={(label) => `יום ${label}`} /><Line type="monotone" dataKey="amount" name="הוצאות" stroke="#3b5ccc" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer></div> : <div className="empty-state"><BarChart3 size={30} /><p>עדיין אין נתונים להצגת המגמה.</p></div>}
            </article>
            <article className="panel chart-panel">
              <div className="panel-heading"><div><h2>התפלגות לפי קטגוריה</h2><p className="muted">החודש הנבחר</p></div><BarChart3 size={20} className="muted-icon" /></div>
              {byCategory.length ? <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={byCategory} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" /><XAxis type="number" tickFormatter={(value) => `${value} ₪`} stroke="var(--muted)" fontSize={11} /><YAxis type="category" dataKey="name" width={105} stroke="var(--muted)" fontSize={11} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="amount" name="סכום" radius={[0, 5, 5, 0]}>{byCategory.map((entry, index) => <Cell key={entry.name} fill={["#3b5ccc", "#36a269", "#c98018", "#8b5cf6", "#d25b83"][index % 5]} />)}</Bar></BarChart></ResponsiveContainer></div> : <div className="empty-state"><BarChart3 size={30} /><p>עדיין אין מספיק נתונים להצגת הגרף.</p></div>}
            </article>
          </div>
          {largest && <div className="insight"><Sparkles size={19} /><span>הקטגוריה הגדולה ביותר החודש היא <strong>{largest.name}</strong>, עם {formatCurrency(largest.amount)}.</span></div>}
        </>
      ) : (
        <>
          <div className="stats-grid">
            <StatCard title={`סך הוצאות ${selectedYear}`} value={formatCurrency(annualTotal)} helper={`${yearExpenses.length} הוצאות`} icon={<Wallet size={20} />} />
            <StatCard title="ממוצע לחודש פעיל" value={annualAverage.length ? formatCurrency(annualTotal / annualAverage.length) : "אין נתונים"} helper={`${annualAverage.length} חודשים עם הוצאות`} icon={<BarChart3 size={20} />} tone="green" />
            <StatCard title="החודש היקר ביותר" value={highestMonth?.amount ? highestMonth.label : "אין עדיין"} helper={highestMonth?.amount ? formatCurrency(highestMonth.amount) : "הוסיפו הוצאות כדי לראות"} icon={<ArrowUpRight size={20} />} tone="orange" />
            <StatCard title="קטגוריה מובילה" value={annualByCategory[0]?.name ?? "אין עדיין"} helper={annualByCategory[0] ? formatCurrency(annualByCategory[0].amount) : "אין נתונים"} icon={<BarChart3 size={20} />} tone="purple" />
            <StatCard title="סך כל ההוצאות" value={displayedAllTimeTotal === null ? "לא זמין" : formatCurrency(displayedAllTimeTotal)} helper="מצטבר מכל השנים" icon={<Wallet size={20} />} tone="blue" />
          </div>
          <div className="dashboard-grid">
            <article className="panel chart-panel">
              <div className="panel-heading"><div><h2>מגמת ההוצאות השנתית</h2><p className="muted">{selectedYear}, לפי חודש</p></div><BarChart3 size={20} className="muted-icon" /></div>
              <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={annualTotals} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="label" stroke="var(--muted)" fontSize={11} /><YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(value) => `${value} ₪`} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="amount" name="סכום" fill="#3b5ccc" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </article>
            <article className="panel chart-panel">
              <div className="panel-heading"><div><h2>הקטגוריות המובילות</h2><p className="muted">סיכום שנתי</p></div><BarChart3 size={20} className="muted-icon" /></div>
              {annualByCategory.length ? <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={annualByCategory} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" /><XAxis type="number" tickFormatter={(value) => `${value} ₪`} stroke="var(--muted)" fontSize={11} /><YAxis type="category" dataKey="name" width={105} stroke="var(--muted)" fontSize={11} /><Tooltip formatter={(value) => formatCurrency(Number(value))} /><Bar dataKey="amount" name="סכום" fill="#36a269" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer></div> : <div className="empty-state"><BarChart3 size={30} /><p>עדיין אין מספיק נתונים להצגת הסיכום השנתי.</p></div>}
            </article>
          </div>
          <article className="panel chart-panel annual-comparison-panel">
            <div className="panel-heading">
              <div><h2>השוואת הוצאות בין שנים</h2><p className="muted">עד 10 שנים רצופות, לפי השנה שנבחרה</p></div>
              <BarChart3 size={20} className="muted-icon" />
            </div>
            <div className="year-comparison-toolbar">
              <button className="icon-button" type="button" onClick={() => onYearWindowStart(comparisonStart - 10)} disabled={!hasPreviousComparisonWindow} aria-label="שנים קודמות"><ChevronRight size={18} /></button>
              <strong>{comparisonYears[0]}–{comparisonYears.at(-1)}</strong>
              <button className="icon-button" type="button" onClick={() => onYearWindowStart(comparisonStart + 10)} disabled={!hasNextComparisonWindow} aria-label="שנים הבאות"><ChevronLeft size={18} /></button>
            </div>
            {comparisonData.some((item) => item.amount > 0) ? (
              <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparisonData} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="year" stroke="var(--muted)" fontSize={11} /><YAxis stroke="var(--muted)" fontSize={11} tickFormatter={(value) => `${value} ₪`} /><Tooltip formatter={(value) => formatCurrency(Number(value))} labelFormatter={(label) => `שנת ${label}`} /><Bar dataKey="amount" name="סך שנתי" radius={[5, 5, 0, 0]}>{comparisonData.map((entry) => <Cell key={entry.year} fill={entry.year === selectedYearNumber ? "#3b5ccc" : "#9aaae0"} />)}</Bar></BarChart></ResponsiveContainer></div>
            ) : <div className="empty-state"><BarChart3 size={30} /><p>אין נתונים להשוואה בשנים האלו.</p></div>}
          </article>
          <div className="insight"><Sparkles size={19} /><span>{annualTotal ? `בשנת ${selectedYear} נרשמו ${yearExpenses.length} הוצאות בסכום כולל של ${formatCurrency(annualTotal)}.` : "עדיין אין הוצאות לשנה הזו. אפשר לבחור שנה אחרת או להוסיף הוצאה."}</span></div>
        </>
      )}
      <article className="panel quick-actions-panel">
        <div className="panel-heading"><div><h2>פעולות מהירות</h2><p className="muted">הדרך הקלה להמשיך</p></div><Sparkles size={20} className="muted-icon" /></div>
        <div className="quick-actions">
          <button onClick={onAdd}><Receipt size={19} /><span><strong>הוצאה בודדת</strong><small>רישום מהיר של הוצאה</small></span><ChevronLeft size={17} /></button>
          <button onClick={() => onNavigate("monthly")}><FileText size={19} /><span><strong>הזנת חודש שלם</strong><small>העברת הוצאות מהמחברת</small></span><ChevronLeft size={17} /></button>
          <button onClick={onAnnualPhoto}><CalendarDays size={19} /><span><strong>סיכום שנתי מתמונה</strong><small>הזנת סכום לכל חודש בשנה</small></span><ChevronLeft size={17} /></button>
          <button onClick={() => onNavigate("expenses")}><Search size={19} /><span><strong>חיפוש הוצאות</strong><small>מציאת הוצאה לפי עסק או קטגוריה</small></span><ChevronLeft size={17} /></button>
        </div>
      </article>
    </section>
  );
}

function ExpensesView({
  expenses,
  categories,
  initialMonth,
  dateFilter,
  onDateFilterChange,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
  onDeleteMany,
}: {
  expenses: Expense[];
  categories: Category[];
  initialMonth: string;
  dateFilter: string;
  onDateFilterChange: (month: string) => void;
  onAdd: () => void;
  onEdit: (expense: Expense) => void;
  onDuplicate: (expense: Expense) => void;
  onDelete: (id: string) => Promise<void>;
  onDeleteMany: (ids: string[]) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const filtered = expenses.filter((expense) => {
    const text = `${expense.merchant_name ?? ""} ${expense.description ?? ""}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) &&
      (!categoryFilter || expense.category_id === categoryFilter) &&
      (!dateFilter || expense.expense_date.startsWith(dateFilter));
  });
  const total = sumMoney(filtered.map((expense) => expense.amount));
  const allSelected = filtered.length > 0 && filtered.every((expense) => selectedIds.has(expense.id));

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(filtered.map((expense) => expense.id)));
  }

  async function deleteSelected() {
    const ids = [...selectedIds].filter((id) => filtered.some((expense) => expense.id === id));
    if (!ids.length) return;
    if (!window.confirm(`למחוק ${ids.length} הוצאות? הן יוסרו מהרשימה ומהסטטיסטיקות.`)) return;
    await onDeleteMany(ids);
    setSelectedIds(new Set());
  }

  return (
    <section className="content-section">
      <div className="section-heading"><div><p className="eyebrow">כל הנתונים במקום אחד</p><h1>הוצאות</h1><p className="muted">{filtered.length} תוצאות · {formatCurrency(total)}</p></div><button className="primary-button" onClick={onAdd}><Plus size={18} /> הוספת הוצאה</button></div>
      <div className="filters-bar">
        <label className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי עסק או תיאור" /></label>
        <label><span className="sr-only">חודש</span><input type="month" value={dateFilter} onChange={(event) => onDateFilterChange(event.target.value)} /></label>
        <label><span className="sr-only">קטגוריה</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">כל הקטגוריות</option>{categories.filter((category) => category.is_active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        {(query || categoryFilter || dateFilter) && <button className="text-button" onClick={() => { setQuery(""); setCategoryFilter(""); onDateFilterChange(""); }}>ניקוי מסננים</button>}
      </div>
      <div className="month-shortcuts" aria-label="קיצורי חודשים">
        {[
          ["החודש", initialMonth],
          ["החודש הקודם", previousIsoMonth(initialMonth)],
          ["לפני חודשיים", previousIsoMonth(previousIsoMonth(initialMonth))],
        ].map(([label, value]) => (
          <button key={value} type="button" className={dateFilter === value ? "active" : ""} aria-pressed={dateFilter === value} onClick={() => onDateFilterChange(value)}>
            {label}
          </button>
        ))}
      </div>
      <div className="selection-toolbar">
        <label className="checkbox-label"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="בחירת כל ההוצאות המוצגות" /><span>בחירת הכל</span></label>
        {selectedIds.size > 0 && <><span className="small muted">{selectedIds.size} נבחרו</span><button className="danger-button" type="button" onClick={deleteSelected}>מחיקת ההוצאות שנבחרו</button></>}
      </div>
      <div className="expense-list">
        {filtered.map((expense) => <article className={`expense-item ${selectedIds.has(expense.id) ? "selected" : ""}`} key={expense.id}><label className="expense-checkbox"><input type="checkbox" checked={selectedIds.has(expense.id)} onChange={() => toggleSelected(expense.id)} aria-label={`בחירת ${expense.merchant_name || expense.description || "הוצאה"}`} /></label><div className="expense-category-dot" /><div className="expense-main"><strong>{expense.merchant_name || expense.description}</strong><span>{expense.description && expense.merchant_name ? expense.description : expense.category?.name}</span>{scheduleLabel(expense.schedule_type ?? "none", expense.schedule_months) && <small>{scheduleLabel(expense.schedule_type ?? "none", expense.schedule_months)}</small>}</div><div className="expense-category">{expense.category?.name ?? categories.find((category) => category.id === expense.category_id)?.name}</div><div className="expense-date">{formatDate(expense.expense_date)}</div><strong className="expense-amount">{formatCurrency(expense.amount, expense.currency)}</strong><div className="expense-actions"><button className="icon-button" onClick={() => onDuplicate(expense)} aria-label="שכפול הוצאה"><Copy size={16} /></button><button className="icon-button" onClick={() => onEdit(expense)} aria-label="עריכת הוצאה">✎</button><button className="icon-button danger-icon" onClick={() => onDelete(expense.id)} aria-label="מחיקת הוצאה"><Trash2 size={16} /></button></div></article>)}
        {!filtered.length && <div className="empty-state"><Search size={30} /><h3>לא נמצאו הוצאות</h3><p>נסו לשנות את החיפוש או להוסיף הוצאה חדשה.</p></div>}
      </div>
    </section>
  );
}

function SettingsView({
  household,
  categories,
  displayName,
  canManageHousehold,
  sharingAvailable,
  onSave,
  onInvite,
  onToggleCategory,
}: {
  household: Household;
  categories: Category[];
  displayName: string;
  canManageHousehold: boolean;
  sharingAvailable: boolean;
  onSave: (values: { name: string; currency: string; displayName: string }) => Promise<void>;
  onInvite: (email: string) => Promise<void>;
  onToggleCategory: (id: string, isActive: boolean) => Promise<void>;
}) {
  const [name, setName] = useState(household.name);
  const [currency, setCurrency] = useState(household.default_currency);
  const [profileName, setProfileName] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const manageableCategories = categories.filter((category) => !mergedCategoryNames.has(category.name));

  async function save(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const trimmedProfileName = profileName.trim();
    if (!trimmedName) {
      setError("יש להזין שם למשק הבית.");
      return;
    }
    if (!trimmedProfileName) {
      setError("יש להזין שם תצוגה.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await onSave({ name: trimmedName, currency, displayName: trimmedProfileName });
      setMessage("ההגדרות נשמרו בהצלחה.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "שמירת ההגדרות נכשלה.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategory(category: Category) {
    setError("");
    try {
      await onToggleCategory(category.id, !category.is_active);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "עדכון הקטגוריה נכשל.");
    }
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setInviting(true);
    try {
      await onInvite(inviteEmail.trim());
      setInviteEmail("");
      setMessage("ההזמנה נשלחה. היא תהיה בתוקף במשך 7 ימים.");
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : "שליחת ההזמנה נכשלה.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <section className="content-section settings-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">שליטה פשוטה במערכת</p>
          <h1>הגדרות</h1>
          <p className="muted">דברים בסיסיים בלבד, כדי שהמערכת תישאר ברורה ומהירה.</p>
        </div>
        <Settings size={28} className="muted-icon" />
      </div>
      <form className="form-card settings-card" onSubmit={save}>
        <div className="panel-heading"><div><h2>הפרטים שלי</h2><p className="muted">השם שיופיע בתוך האפליקציה.</p></div></div>
        <label>שם תצוגה<input value={profileName} maxLength={80} onChange={(event) => setProfileName(event.target.value)} /></label>
        <div className="panel-heading settings-section-heading"><div><h2>משק הבית</h2><p className="muted">הגדרות אלו משותפות לחברי משק הבית.</p></div></div>
        <label>שם משק הבית<input value={name} maxLength={100} disabled={!canManageHousehold} onChange={(event) => setName(event.target.value)} /></label>
        <label>מטבע ברירת מחדל
          <select value={currency} disabled={!canManageHousehold} onChange={(event) => setCurrency(event.target.value)}>
            <option value="ILS">שקל חדש (₪)</option>
            <option value="USD">דולר ($)</option>
            <option value="EUR">אירו (€)</option>
          </select>
        </label>
        {!canManageHousehold && <p className="small muted">רק מנהל משק הבית יכול לשנות את שם המשק והמטבע.</p>}
        {error && <p className="field-error" role="alert">{error}</p>}
        {message && <div className="notice success-notice"><Check size={18} />{message}</div>}
        <div className="form-actions"><button className="primary-button" disabled={saving}>{saving ? "שומר..." : "שמירת ההגדרות"}</button></div>
      </form>

      <article className="panel settings-card">
        <div className="panel-heading"><div><h2>שיתוף משק הבית</h2><p className="muted">הזמינו אדם נוסף לפי כתובת אימייל. הוא יקבל גישה רק למשק הבית הזה.</p></div></div>
        {canManageHousehold && sharingAvailable ? (
          <form className="invite-form" onSubmit={invite}>
            <label>כתובת אימייל<input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="name@example.com" required /></label>
            <button className="primary-button" disabled={inviting}>{inviting ? "שולח..." : "שליחת הזמנה"}</button>
          </form>
        ) : (
          <p className="small muted">{canManageHousehold ? "שיתוף זמין לאחר חיבור Supabase והפעלת ספק האימייל." : "רק מנהל משק הבית יכול לשלוח הזמנות."}</p>
        )}
      </article>

      <article className="panel settings-card">
        <div className="panel-heading">
          <div><h2>קטגוריות פעילות</h2><p className="muted">הסתרה מוציאה קטגוריה מהטפסים והגרפים, בלי למחוק הוצאות קיימות.</p></div>
          <span className="small muted">{manageableCategories.filter((category) => category.is_active).length} פעילות</span>
        </div>
        <div className="settings-category-list">
          {manageableCategories.map((category) => (
            <div className="settings-category-row" key={category.id}>
              <span><strong>{category.name}</strong><small>{category.is_active ? "מופיעה בטפסים ובסיכומים" : "מוסתרת, הנתונים נשמרו"}</small></span>
              <button type="button" className={`secondary-button category-toggle ${category.is_active ? "active" : ""}`} disabled={!canManageHousehold} onClick={() => void toggleCategory(category)} aria-pressed={category.is_active}>
                {category.is_active ? "הסתרה" : "הפעלה"}
              </button>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

export default function HouseholdApp({ supabaseConfigured, userId, userEmail, displayName, initialDate, initialMonth, loginNext }: HouseholdAppProps) {
  const demoMode = !supabaseConfigured;
  const [view, setView] = useState<View>("dashboard");
  const [household, setHousehold] = useState<Household | null>(demoMode ? demoHousehold : null);
  const [accountDisplayName, setAccountDisplayName] = useState(displayName || displayNameFromEmail(userEmail));
  const [categories, setCategories] = useState<Category[]>(demoMode ? demoCategories : []);
  const [expenses, setExpenses] = useState<Expense[]>(demoMode ? demoExpenses : []);
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [draftMonth, setDraftMonth] = useState(initialMonth);
  const [dashboardMonth, setDashboardMonth] = useState(initialMonth);
  const [dashboardRange, setDashboardRange] = useState<DashboardRange>("month");
  const [yearWindowStart, setYearWindowStart] = useState(Number(initialMonth.slice(0, 4)) - 4);
  const [expensesDateFilter, setExpensesDateFilter] = useState("");
  const [photoDestination, setPhotoDestination] = useState<"monthly" | "expense" | "annual">("monthly");
  const [photoReturnView, setPhotoReturnView] = useState<View>("dashboard");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState(1);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [newExpensePrefill, setNewExpensePrefill] = useState<ExpenseFormValues | null>(null);
  const [expenseFormReturnView, setExpenseFormReturnView] = useState<View>("expenses");
  const [newExpenseDate, setNewExpenseDate] = useState(initialDate);
  const [undoDeleteState, setUndoDeleteState] = useState<{ ids: string[]; expenses: Expense[] } | null>(null);
  const [loading, setLoading] = useState(!demoMode && Boolean(userId));
  const [authError, setAuthError] = useState("");
  const [allTimeTotal, setAllTimeTotal] = useState<number | null | undefined>(demoMode ? undefined : null);
  const [yearlyTotals, setYearlyTotals] = useState<YearlyTotal[] | null | undefined>(demoMode ? undefined : null);
  const [uiStateHydrated, setUiStateHydrated] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const uiStateKey = `household-expenses-ui-${userId ?? (demoMode ? "demo" : "guest")}`;

  useEffect(() => {
    const saved = window.localStorage.getItem(uiStateKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          view?: View;
          draftMonth?: string;
          dashboardMonth?: string;
          dashboardRange?: DashboardRange;
          yearWindowStart?: number;
          expensesDateFilter?: string;
        };
        if (parsed.view && ["dashboard", "expenses", "monthly", "drafts", "settings"].includes(parsed.view)) {
          // Restore the screen context, but never restore an in-progress photo or modal.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setView(parsed.view);
        }
        if (parsed.draftMonth && /^\d{4}-\d{2}$/.test(parsed.draftMonth)) {
          setDraftMonth(parsed.draftMonth);
        }
        if (parsed.dashboardMonth && /^\d{4}-\d{2}$/.test(parsed.dashboardMonth)) {
          // Local storage is the source of the user's navigation context.
          setDashboardMonth(parsed.dashboardMonth);
        }
        if (!parsed.expensesDateFilter || /^\d{4}-\d{2}$/.test(parsed.expensesDateFilter)) {
          setExpensesDateFilter(parsed.expensesDateFilter ?? "");
        }
        if (parsed.dashboardRange === "month" || parsed.dashboardRange === "year") {
          setDashboardRange(parsed.dashboardRange);
        }
        if (typeof parsed.yearWindowStart === "number" && Number.isInteger(parsed.yearWindowStart)) {
          setYearWindowStart(parsed.yearWindowStart);
        }
      } catch {
        window.localStorage.removeItem(uiStateKey);
      }
    }
    // Restore navigation context once, without restoring a modal or an upload in progress.
    setUiStateHydrated(true);
  }, [uiStateKey]);

  useEffect(() => {
    if (!uiStateHydrated) return;
    window.localStorage.setItem(uiStateKey, JSON.stringify({
      view,
      draftMonth,
      dashboardMonth,
      dashboardRange,
      yearWindowStart,
      expensesDateFilter,
    }));
  }, [dashboardMonth, dashboardRange, draftMonth, expensesDateFilter, uiStateKey, uiStateHydrated, view, yearWindowStart]);

  useEffect(() => {
    if (!undoDeleteState) return;
    const timeout = window.setTimeout(() => setUndoDeleteState(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [undoDeleteState]);

  const loadRemoteData = useCallback(async () => {
    if (!supabase || !userId) return;
    setLoading(true);
    const { data: memberships, error: membershipError } = await supabase
      .from("household_members")
      .select("household_id, role, households(id, name, default_currency)")
      .eq("user_id", userId);

    if (membershipError) {
      setAuthError("לא ניתן לטעון את נתוני משק הבית. בדקו את חיבור Supabase.");
      setLoading(false);
      return;
    }

    const membership = memberships?.[0] as unknown as {
      household_id: string;
      role: "admin" | "member";
      households: { id: string; name: string; default_currency: string } | { id: string; name: string; default_currency: string }[] | null;
    } | undefined;
    if (!membership) {
      setHousehold(null);
      setLoading(false);
      return;
    }

    const householdData = Array.isArray(membership.households) ? membership.households[0] : membership.households;
    if (!householdData) {
      setHousehold(null);
      setLoading(false);
      return;
    }

    const remoteHousehold: Household = { ...householdData, role: membership.role };
    const [{ data: remoteCategories }, { data: remoteExpenses }, { data: remoteDrafts }, { data: remoteSummary, error: summaryError }, { data: remoteYearlyTotals, error: yearlyTotalsError }] = await Promise.all([
      supabase.from("categories").select("*").eq("household_id", remoteHousehold.id).order("sort_order"),
      supabase.from("expenses").select("*, category:categories(*)").eq("household_id", remoteHousehold.id).is("deleted_at", null).order("expense_date", { ascending: false }).limit(500),
      supabase.from("monthly_entry_drafts").select("id, draft_data, version, month, year").eq("household_id", remoteHousehold.id).eq("status", "draft").order("updated_at", { ascending: false }).limit(1),
      supabase.rpc("expense_summary", {
        p_household_id: remoteHousehold.id,
        p_from: null,
        p_to: null,
        p_category_id: null,
        p_query: null,
        p_amount: null,
        p_deleted: false,
        p_missing_info: false,
      }),
      supabase.rpc("expense_yearly_totals", { p_household_id: remoteHousehold.id }),
    ]);
    setHousehold(remoteHousehold);
    setCategories((remoteCategories ?? []) as Category[]);
    setExpenses((remoteExpenses ?? []) as Expense[]);
    const summaryRow = Array.isArray(remoteSummary) ? remoteSummary[0] as { total_amount?: number | string } | undefined : undefined;
    setAllTimeTotal(summaryError ? null : Number(summaryRow?.total_amount ?? 0));
    setYearlyTotals(yearlyTotalsError ? null : (remoteYearlyTotals ?? []).map((item: { year: number; total_amount: number | string; item_count: number | string }) => ({
      year: Number(item.year),
      total: Number(item.total_amount),
      count: Number(item.item_count),
    })));
    const activeDraft = remoteDrafts?.[0] as { id: string; version?: number; month?: number; year?: number; draft_data?: { rows?: DraftRow[] } } | undefined;
    setDraftId(activeDraft?.id ?? null);
    setDraftVersion(activeDraft?.version ?? 1);
    if (activeDraft?.year && activeDraft.month) {
      setDraftMonth(`${activeDraft.year}-${String(activeDraft.month).padStart(2, "0")}`);
    }
    setDraftRows(activeDraft?.draft_data?.rows ?? []);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    if (supabaseConfigured) {
      // This effect synchronizes the UI with the authenticated remote session.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadRemoteData();
    }
  }, [loadRemoteData, supabaseConfigured]);

  useEffect(() => {
    if (!demoMode) return;
    const saved = window.localStorage.getItem("household-expenses-demo");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { expenses?: Expense[]; household?: Household; draftRows?: DraftRow[] };
      if (parsed.expenses) {
        // Hydrate the local demo store once from browser storage.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setExpenses(parsed.expenses);
      }
      if (parsed.household) {
        setHousehold(parsed.household);
      }
      if (parsed.draftRows) {
        // Restore the monthly entry draft from browser storage.
        setDraftRows(parsed.draftRows);
      }
    } catch {
      window.localStorage.removeItem("household-expenses-demo");
    }
  }, [demoMode]);

  useEffect(() => {
    if (demoMode && household) {
      window.localStorage.setItem("household-expenses-demo", JSON.stringify({ expenses, household, draftRows }));
    }
  }, [demoMode, expenses, household, draftRows]);

  async function login() {
    if (!supabase) return;
    const callback = new URL("/auth/callback", window.location.origin);
    if (loginNext?.startsWith("/") && !loginNext.startsWith("//")) {
      callback.searchParams.set("next", loginNext);
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) setAuthError("ההתחברות נכשלה. נסו שוב.");
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    window.location.reload();
  }

  function openExpenseForm(returnView: View = view) {
    setEditingExpense(null);
    setNewExpensePrefill(null);
    setExpenseFormReturnView(returnView);
    const contextMonth = returnView === "dashboard" ? dashboardMonth : returnView === "monthly" ? draftMonth : "";
    setNewExpenseDate(contextMonth ? `${contextMonth}-01` : initialDate);
    setShowExpenseForm(true);
  }

  function duplicateExpense(expense: Expense) {
    setEditingExpense(null);
    setExpenseFormReturnView("expenses");
    setNewExpenseDate(expense.expense_date);
    setNewExpensePrefill({
      merchant_name: expense.merchant_name ?? "",
      description: expense.description ?? "",
      amount: String(expense.amount),
      expense_date: expense.expense_date,
      category_id: expense.category_id,
      payment_method: expense.payment_method ?? "",
      notes: expense.notes ?? "",
      schedule_type: "none",
      schedule_months: "",
    });
    setShowExpenseForm(true);
  }

  function openPhoto(destination: "monthly" | "expense" | "annual", returnView: View = view) {
    setPhotoDestination(destination);
    setPhotoReturnView(returnView);
    setView("photo");
  }

  async function inviteMember(email: string) {
    if (!household) return;
    const response = await fetch("/api/household-invitations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ householdId: household.id, email }),
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "שליחת ההזמנה נכשלה.");
  }

  async function saveSettings(values: { name: string; currency: string; displayName: string }) {
    if (!household) return;
    if (demoMode) {
      setHousehold((current) => current ? { ...current, name: values.name, default_currency: values.currency } : current);
      setAccountDisplayName(values.displayName);
      return;
    }
    if (!supabase || !userId) throw new Error("חיבור המשתמש אינו זמין.");
    if (household.role === "admin") {
      const { error } = await supabase
        .from("households")
        .update({ name: values.name, default_currency: values.currency })
        .eq("id", household.id);
      if (error) throw new Error(`עדכון משק הבית נכשל: ${error.message}`);
    }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ display_name: values.displayName })
      .eq("id", userId);
    if (profileError) throw new Error(`עדכון שם התצוגה נכשל: ${profileError.message}`);
    setAccountDisplayName(values.displayName);
    await loadRemoteData();
  }

  async function toggleCategory(id: string, isActive: boolean) {
    if (!household) return;
    if (isActive === false && categories.filter((category) => category.is_active).length <= 1) {
      throw new Error("אי אפשר להסתיר את הקטגוריה הפעילה האחרונה.");
    }
    if (demoMode) {
      setCategories((items) => items.map((category) => category.id === id ? { ...category, is_active: isActive } : category));
      return;
    }
    if (!supabase || household.role !== "admin") throw new Error("רק מנהל משק הבית יכול לשנות קטגוריות.");
    const { error } = await supabase.from("categories").update({ is_active: isActive }).eq("id", id);
    if (error) throw new Error(`עדכון הקטגוריה נכשל: ${error.message}`);
    setCategories((items) => items.map((category) => category.id === id ? { ...category, is_active: isActive } : category));
  }

  async function createHousehold(name: string) {
    if (demoMode) {
      setHousehold({ ...demoHousehold, name });
      return;
    }
    if (!supabase) throw new Error("חיבור Supabase אינו מוגדר");
    const { error } = await supabase.rpc("create_household", { p_name: name, p_currency: "ILS" });
    if (error) throw new Error("יצירת משק הבית נכשלה");
    await loadRemoteData();
  }

  async function saveExpense(values: ExpenseFormValues, id?: string) {
    const scheduleType = values.schedule_type;
    const scheduleMonths = scheduleType === "none" ? null : Number(values.schedule_months);
    const basePayload = {
      merchant_name: values.merchant_name.trim() || null,
      description: values.description.trim() || null,
      category_id: values.category_id,
      payment_method: values.payment_method ? toDatabasePaymentMethod(values.payment_method) : null,
      notes: values.notes || null,
      currency: household?.default_currency ?? "ILS",
      household_id: household?.id,
      created_by: userId ?? "demo-user",
      source: "manual",
    };
    const category = categories.find((item) => item.id === values.category_id);

    if (id) {
      const payload = {
        ...basePayload,
        amount: Number(values.amount),
        expense_date: values.expense_date,
        is_recurring: scheduleType === "fixed",
        schedule_group_id: null,
        schedule_type: scheduleType,
        schedule_months: scheduleMonths,
        schedule_index: scheduleType === "none" ? null : 1,
      };
      if (demoMode) {
        setExpenses((items) => items.map((expense) => expense.id === id ? { ...expense, ...payload, category } as Expense : expense));
      } else if (supabase) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", id);
        if (error) throw new Error(`עדכון ההוצאה נכשל: ${error.message}`);
        await loadRemoteData();
      }
    } else {
      const months = scheduleMonths ?? 1;
      const scheduleGroupId = scheduleType === "none" ? null : crypto.randomUUID();
      const amounts = scheduleType === "installment"
        ? splitMoney(values.amount, months)
        : Array.from({ length: months }, () => Number(values.amount));
      const payloads = amounts.map((amount, index) => ({
        ...basePayload,
        amount,
        expense_date: addMonthsToIsoDate(values.expense_date, index),
        is_recurring: scheduleType === "fixed",
        schedule_group_id: scheduleGroupId,
        schedule_type: scheduleType,
        schedule_months: scheduleType === "none" ? null : months,
        schedule_index: scheduleType === "none" ? null : index + 1,
        client_key: crypto.randomUUID(),
      }));

      if (demoMode) {
        const createdAt = new Date().toISOString();
        const created = payloads.map((payload) => ({
          ...payload,
          id: crypto.randomUUID(),
          is_historical: false,
          created_at: createdAt,
          category,
        } as Expense));
        setExpenses((items) => [...created, ...items]);
      } else if (supabase) {
        const { error } = await supabase.from("expenses").insert(payloads);
        if (error) throw new Error(`שמירת ההוצאה נכשלה: ${error.message}`);
        await loadRemoteData();
      }
    }
    setShowExpenseForm(false);
    setEditingExpense(null);
    setNewExpensePrefill(null);
    setView(expenseFormReturnView);
  }

  async function deleteExpense(id: string) {
    if (!window.confirm("למחוק את ההוצאה? היא תוסר מהרשימה ומהסטטיסטיקות.")) return;
    setAuthError("");
    const removedExpense = expenses.find((expense) => expense.id === id);
    if (demoMode) {
      setExpenses((items) => items.filter((expense) => expense.id !== id));
    } else if (supabase) {
      const { error } = await supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) {
        setAuthError("מחיקת ההוצאה נכשלה. נסו שוב.");
        return;
      }
      await loadRemoteData();
    }
    if (removedExpense) setUndoDeleteState({ ids: [id], expenses: [removedExpense] });
  }

  async function deleteExpenses(ids: string[]) {
    setAuthError("");
    const removedExpenses = expenses.filter((expense) => ids.includes(expense.id));
    if (demoMode) {
      setExpenses((items) => items.filter((expense) => !ids.includes(expense.id)));
    } else if (supabase) {
      const { error } = await supabase.from("expenses").update({ deleted_at: new Date().toISOString() }).in("id", ids);
      if (error) {
        setAuthError("מחיקת ההוצאות נכשלה. נסו שוב.");
        return;
      }
      await loadRemoteData();
    }
    if (removedExpenses.length) setUndoDeleteState({ ids, expenses: removedExpenses });
  }

  async function restoreDeletedExpenses() {
    if (!undoDeleteState) return;
    const state = undoDeleteState;
    setAuthError("");
    if (demoMode) {
      setExpenses((items) => [...state.expenses, ...items]);
    } else if (supabase) {
      const { error } = await supabase.from("expenses").update({ deleted_at: null }).in("id", state.ids);
      if (error) {
        setAuthError("שחזור ההוצאות נכשל. נסו שוב.");
        return;
      }
      await loadRemoteData();
    }
    setUndoDeleteState(null);
  }

  function updateRow(id: string, field: keyof DraftRow, value: string) {
    setDraftRows((rows) => rows.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  async function acceptNotebookRows(rows: DraftRow[], month: string, file: File, extractedText: string) {
    if (!demoMode && (!supabase || !userId || !household)) {
      throw new Error("יש להתחבר לפני שמירת תמונה.");
    }

    const annualYear = Number(month.split("-")[0]);
    const annualMarker = `סיכום שנתי ${annualYear}`;
    const positiveAnnualRows = rows.filter((row) => Number(row.amount) > 0);
    if (photoDestination === "annual") {
      if (!positiveAnnualRows.length) throw new Error("יש להזין לפחות חודש אחד עם סכום גדול מאפס.");
      if (demoMode && expenses.some((expense) => expense.merchant_name === annualMarker && expense.is_historical)) {
        throw new Error(`כבר קיים סיכום שנתי עבור ${annualYear}. מחקו אותו לפני העלאה מחדש.`);
      }
      if (!demoMode && supabase && household) {
        const { data: existing, error: existingError } = await supabase
          .from("expenses")
          .select("id")
          .eq("household_id", household.id)
          .eq("merchant_name", annualMarker)
          .eq("is_historical", true)
          .is("deleted_at", null)
          .limit(1);
        if (existingError) throw new Error(existingError.message || "בדיקת סיכום שנתי קיים נכשלה.");
        if (existing?.length) throw new Error(`כבר קיים סיכום שנתי עבור ${annualYear}. מחקו אותו לפני העלאה מחדש.`);
      }
    }

    let annualImportId = "";
    let annualStoragePath = "";
    if (!demoMode && supabase && userId && household) {
      const importId = crypto.randomUUID();
      const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") || "bin";
      const storagePath = `${household.id}/${userId}/${importId}.${extension}`;
      annualImportId = importId;
      annualStoragePath = storagePath;
      const { error: uploadError } = await supabase.storage
        .from("expense-images")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error("העלאת התמונה נכשלה. נסו שוב.");

      const [year, monthNumber] = month.split("-").map(Number);
      const { error: importError } = await supabase.from("notebook_imports").insert({
        id: importId,
        household_id: household.id,
        created_by: userId,
        storage_path: storagePath,
        original_filename: file.name.slice(0, 255),
        mime_type: file.type,
        file_size: file.size,
        year,
        month: monthNumber,
        extracted_text: extractedText,
        status: "reviewed",
      });
      if (importError) {
        await supabase.storage.from("expense-images").remove([storagePath]);
        throw new Error("שמירת פרטי התמונה נכשלה.");
      }
    }

    if (photoDestination === "annual") {
      const year = annualYear;

      if (demoMode) {
        const created = positiveAnnualRows.map((row) => ({
          id: crypto.randomUUID(),
          household_id: household?.id ?? demoHousehold.id,
          created_by: "demo-user",
          merchant_name: annualMarker,
          description: row.description,
          amount: Number(row.amount),
          currency: household?.default_currency ?? "ILS",
          expense_date: row.expense_date,
          category_id: row.category_id,
          payment_method: null,
          notes: row.notes,
          source: "monthly_entry",
          is_historical: true,
          is_recurring: false,
          created_at: new Date().toISOString(),
          category: categories.find((category) => category.id === row.category_id),
        } as Expense));
        setExpenses((items) => [...created, ...items]);
      } else if (supabase && household && userId) {
        const { error } = await supabase.from("expenses").insert(positiveAnnualRows.map((row) => ({
          household_id: household.id,
          created_by: userId,
          merchant_name: annualMarker,
          description: row.description,
          amount: Number(row.amount),
          currency: household.default_currency,
          expense_date: row.expense_date,
          category_id: row.category_id,
          payment_method: null,
          notes: row.notes,
          source: "monthly_entry",
          is_historical: true,
          is_recurring: false,
        })));
        if (error) {
          if (annualStoragePath) {
            await supabase.storage.from("expense-images").remove([annualStoragePath]);
            await supabase.from("notebook_imports").delete().eq("id", annualImportId);
          }
          throw new Error(error.message || "שמירת הסיכום השנתי נכשלה.");
        }
        await loadRemoteData();
      }
      setDashboardMonth(`${year}-01`);
      setView("dashboard");
      return;
    }

    if (photoDestination === "expense") {
      if (demoMode) {
        const created = rows.map((row) => ({
          id: crypto.randomUUID(),
          household_id: household?.id ?? demoHousehold.id,
          created_by: "demo-user",
          merchant_name: row.merchant_name || null,
          description: row.description || null,
          amount: Number(row.amount),
          currency: household?.default_currency ?? "ILS",
          expense_date: row.expense_date,
          category_id: row.category_id,
          payment_method: row.payment_method ? toDatabasePaymentMethod(row.payment_method) : null,
          notes: row.notes || "נוצר מהזנת תמונה",
          source: "manual",
          is_historical: false,
          is_recurring: false,
          created_at: new Date().toISOString(),
          category: categories.find((category) => category.id === row.category_id),
        } as Expense));
        setExpenses((items) => [...created, ...items]);
      } else if (supabase && household && userId) {
        const { error } = await supabase.from("expenses").insert(rows.map((row) => ({
          household_id: household.id,
          created_by: userId,
          merchant_name: row.merchant_name || null,
          description: row.description || null,
          amount: Number(row.amount),
          currency: household.default_currency,
          expense_date: row.expense_date,
          category_id: row.category_id,
          payment_method: row.payment_method ? toDatabasePaymentMethod(row.payment_method) : null,
          notes: row.notes || "נוצר מהזנת תמונה",
          source: "manual",
          is_historical: false,
          is_recurring: false,
        })));
        if (error) throw new Error("שמירת ההוצאות מהתמונה נכשלה.");
        await loadRemoteData();
      }
      setView(photoReturnView);
      return;
    }

    setDraftRows((current) => [...current.filter((row) => row.amount || row.description || row.merchant_name), ...rows]);
    setDraftMonth(month);
    setView("monthly");
  }

  async function saveDraft() {
    if (!household) return;
    if (demoMode) {
      window.localStorage.setItem("household-expenses-demo-draft", JSON.stringify({ rows: draftRows }));
      return;
    }
    if (!supabase || !userId) return;
    const payload = {
      household_id: household.id,
      created_by: userId,
      month: Number(draftMonth.split("-")[1]),
      year: Number(draftMonth.split("-")[0]),
      draft_data: { rows: draftRows },
      version: draftVersion,
    };
    if (draftId) {
      const { error } = await supabase.from("monthly_entry_drafts").update(payload).eq("id", draftId);
      if (error) throw new Error("שמירת הטיוטה נכשלה");
    } else {
      const { data, error } = await supabase.from("monthly_entry_drafts").insert(payload).select("id").single();
      if (error) throw new Error("שמירת הטיוטה נכשלה");
      setDraftId(data.id);
      setDraftVersion(1);
    }
  }

  async function commitDraft() {
    if (!household) return;
    const validRows = draftRows.filter((row) => draftRowSchema.safeParse(row).success);
    const invalidRows = draftRows.filter((row) => !draftRowSchema.safeParse(row).success);
    if (!validRows.length) throw new Error("אין שורות תקינות לשמירה. יש להשלים סכום, תאריך וקטגוריה.");
    if (demoMode) {
      const created = validRows.map((row) => ({
        id: crypto.randomUUID(),
        household_id: household.id,
        created_by: "demo-user",
        merchant_name: row.merchant_name || null,
        description: row.description || null,
        amount: Number(row.amount),
        currency: household.default_currency,
        expense_date: row.expense_date,
        category_id: row.category_id,
        payment_method: row.payment_method ? toDatabasePaymentMethod(row.payment_method) : null,
        notes: row.notes || null,
        source: "monthly_entry",
        is_historical: true,
        is_recurring: false,
        created_at: new Date().toISOString(),
        category: categories.find((category) => category.id === row.category_id),
      } as Expense));
      setExpenses((items) => [...created, ...items]);
      setDraftRows(invalidRows);
      if (invalidRows.length) {
        window.localStorage.setItem("household-expenses-demo-draft", JSON.stringify({ rows: invalidRows }));
      } else {
        window.localStorage.removeItem("household-expenses-demo-draft");
      }
      return invalidRows.length;
    }
    if (!supabase) throw new Error("חיבור Supabase אינו מוגדר");
    let currentDraftId = draftId;
    let expectedVersion = draftVersion;
    if (!currentDraftId) {
      const { data, error: draftError } = await supabase
        .from("monthly_entry_drafts")
        .insert({
          household_id: household.id,
          created_by: userId,
          month: Number(draftMonth.split("-")[1]),
          year: Number(draftMonth.split("-")[0]),
          draft_data: { rows: draftRows },
          version: 1,
        })
        .select("id")
        .single();
      if (draftError) throw new Error("שמירת הטיוטה נכשלה");
      currentDraftId = data.id;
      expectedVersion = 1;
    }
    const { error } = await supabase.rpc("commit_monthly_entry", {
      p_household_id: household.id,
      p_draft_id: currentDraftId,
      p_batch_key: crypto.randomUUID(),
      p_expected_version: expectedVersion,
      p_rows: validRows,
      p_remaining_draft: { rows: invalidRows },
      p_currency: household.default_currency,
    });
    if (error) throw new Error(error.message || "שמירת ההוצאות נכשלה");
    setDraftRows(invalidRows);
    setDraftId(invalidRows.length ? currentDraftId : null);
    setDraftVersion(invalidRows.length ? expectedVersion + 1 : 1);
    await loadRemoteData();
    return invalidRows.length;
  }

  if (supabaseConfigured && !userId) return <LoginScreen onLogin={login} configured />;
  if (loading) return <main className="login-page"><div className="loading-state"><div className="spinner" /><p>טוען את נתוני משק הבית...</p></div></main>;
  if (!household) return <Onboarding onCreate={createHousehold} displayName={displayName || displayNameFromEmail(userEmail)} demoMode={demoMode} />;

  const currentView = view === "dashboard" ? <Dashboard expenses={expenses} categories={categories} selectedMonth={dashboardMonth} onMonthChange={setDashboardMonth} range={dashboardRange} onRangeChange={setDashboardRange} yearWindowStart={yearWindowStart} onYearWindowStart={setYearWindowStart} onAdd={() => openExpenseForm("dashboard")} onNavigate={setView} onAnnualPhoto={() => openPhoto("annual", "dashboard")} allTimeTotal={allTimeTotal} yearlyTotals={yearlyTotals} /> :
    view === "expenses" ? <ExpensesView expenses={expenses} categories={categories} initialMonth={initialMonth} dateFilter={expensesDateFilter} onDateFilterChange={setExpensesDateFilter} onAdd={() => openExpenseForm("expenses")} onEdit={(expense) => { setEditingExpense(expense); setNewExpensePrefill(null); setExpenseFormReturnView("expenses"); setShowExpenseForm(true); }} onDuplicate={duplicateExpense} onDelete={deleteExpense} onDeleteMany={deleteExpenses} /> :
    view === "monthly" ? <MonthlyEntry rows={draftRows} categories={categories} expenses={expenses} month={draftMonth} onMonthChange={setDraftMonth} onChange={updateRow} onSaveDraft={saveDraft} onCommit={commitDraft} onAddRow={() => setDraftRows((rows) => [...rows, makeNewRow(categories[0]?.id, `${draftMonth}-01`)])} onDeleteRow={(id) => setDraftRows((rows) => rows.filter((row) => row.id !== id))} /> :
    view === "photo" ? <NotebookImport categories={categories} initialMonth={photoReturnView === "monthly" ? draftMonth : dashboardMonth} destination={photoDestination} onConfirm={acceptNotebookRows} onSwitchMode={(destination) => setPhotoDestination(destination)} onCancel={() => setView(photoReturnView)} /> :
    view === "settings" ? <SettingsView household={household} categories={categories} displayName={accountDisplayName} canManageHousehold={household.role === "admin"} sharingAvailable={supabaseConfigured} onSave={saveSettings} onInvite={inviteMember} onToggleCategory={toggleCategory} /> :
    <section className="content-section"><div className="section-heading"><div><p className="eyebrow">שמירה להמשך</p><h1>טיוטות חודשיות</h1><p className="muted">הטיוטות נשמרות כדי שאפשר יהיה להמשיך מאוחר יותר.</p></div></div><div className="empty-state"><FileText size={30} /><h3>טיוטה חדשה מתחילה במסך הזנת חודש</h3><button className="primary-button" onClick={() => setView("monthly")}>פתיחת הזנה חודשית</button></div></section>;
  const expenseFormInitial = editingExpense
    ? {
        merchant_name: editingExpense.merchant_name ?? "",
        description: editingExpense.description ?? "",
        amount: String(editingExpense.amount),
        expense_date: editingExpense.expense_date,
        category_id: editingExpense.category_id,
        payment_method: editingExpense.payment_method ?? "",
        notes: editingExpense.notes ?? "",
        schedule_type: editingExpense.schedule_type ?? (editingExpense.is_recurring ? "fixed" : "none"),
        schedule_months: editingExpense.schedule_months ? String(editingExpense.schedule_months) : "",
      }
    : newExpensePrefill ?? emptyExpenseForm("", newExpenseDate);

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand"><BrandLogo small /><strong>הוצאות הבית</strong></div>
        <div className="household-switcher"><span className="household-avatar">{household.name.slice(0, 1)}</span><span><small>משק הבית</small><strong>{household.name}</strong></span><ChevronLeft size={16} /></div>
        <nav className="main-nav">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}><Home size={18} /> בית</button>
          <button className={view === "expenses" ? "active" : ""} onClick={() => setView("expenses")}><Receipt size={18} /> הוצאות</button>
          <button className={view === "monthly" ? "active" : ""} onClick={() => setView("monthly")}><FileText size={18} /> הזנת חודש שלם</button>
          <button className={view === "photo" ? "active" : ""} onClick={() => openPhoto("monthly")}><ImagePlus size={18} /> הזנה מתמונה</button>
          <button className={view === "drafts" ? "active" : ""} onClick={() => setView("drafts")}><CalendarDays size={18} /> טיוטות</button>
          <button className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><Settings size={18} /> הגדרות</button>
        </nav>
        {supabaseConfigured && (
          <div className="sidebar-bottom">
            <button onClick={logout}><LogOut size={18} /> התנתקות</button>
          </div>
        )}
      </aside>
      <main className="main-area">
        <header className="mobile-header">
          <strong>הוצאות הבית</strong>
          <div className="mobile-header-actions">
            {supabaseConfigured && <button className="icon-button" onClick={logout} aria-label="התנתקות"><LogOut size={18} /></button>}
            <button className="icon-button" onClick={() => setView("settings")} aria-label="הגדרות"><Settings size={19} /></button>
            <button className="primary-icon-button" onClick={() => openExpenseForm(view)} aria-label="הוספת הוצאה"><Plus size={19} /></button>
          </div>
        </header>
        <nav className="mobile-nav" aria-label="ניווט ראשי">
          {mobileNavItems.map(({ id, label, Icon }) => (
            <button key={id} className={view === id ? "active" : ""} onClick={() => { if (id === "photo") openPhoto("monthly"); else setView(id); }} aria-current={view === id ? "page" : undefined}>
              <Icon size={20} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="top-banner">{demoMode ? <><CircleHelp size={16} /><span>מצב הדגמה פעיל. הנתונים נשמרים בדפדפן הזה בלבד.</span></> : <><Check size={16} /><span>הנתונים מחוברים למסד הנתונים המאובטח של משק הבית.</span></>}</div>
        {authError && <div className="notice danger-notice"><X size={18} />{authError}</div>}
        {currentView}
        {undoDeleteState && (
          <div className="undo-toast" role="status">
            <span>{undoDeleteState.ids.length === 1 ? "ההוצאה נמחקה." : `${undoDeleteState.ids.length} הוצאות נמחקו.`}</span>
            <button type="button" onClick={restoreDeletedExpenses}>ביטול</button>
          </div>
        )}
        <footer className="app-footer">© כל הזכויות שמורות למני בוגנים</footer>
      </main>
      {showExpenseForm && <div className="modal-backdrop"><div className="modal-card"><ExpenseForm key={editingExpense?.id ?? "new"} categories={categories} initial={expenseFormInitial} editingId={editingExpense?.id} onCancel={() => { setShowExpenseForm(false); setEditingExpense(null); setNewExpensePrefill(null); }} onPhoto={() => { setShowExpenseForm(false); setEditingExpense(null); setNewExpensePrefill(null); openPhoto("expense", expenseFormReturnView); }} onSave={saveExpense} /></div></div>}
    </div>
  );
}
