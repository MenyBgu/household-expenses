-- =====================================================================
-- הוצאות הבית: סכמת MVP
-- כל הנתונים מופרדים לפי household_id ומוגנים ב-Row Level Security.
-- סכומים נשמרים כ-numeric (ולא float). הוצאות נמחקות במחיקה רכה בלבד.
-- =====================================================================

create type public.household_role as enum ('admin', 'member');
create type public.draft_status as enum ('draft', 'committed');

-- ---------------------------------------------------------------------
-- טבלאות
-- ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text check (display_name is null or char_length(display_name) <= 80),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  default_currency text not null default 'ILS' check (default_currency in ('ILS', 'USD', 'EUR')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.household_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create index household_members_user_idx on public.household_members (user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  icon text not null default 'tag' check (char_length(icon) <= 40),
  color text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create index categories_household_sort_idx on public.categories (household_id, sort_order);

create table public.monthly_entry_drafts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  status public.draft_status not null default 'draft',
  draft_data jsonb not null default '{"rows": []}'::jsonb
    check (jsonb_typeof(draft_data) = 'object' and length(draft_data::text) <= 300000),
  version integer not null default 1 check (version >= 1),
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- טיוטה פתוחה אחת לכל משתמש ולכל חודש במשק בית
create unique index monthly_entry_drafts_one_open_per_month
  on public.monthly_entry_drafts (household_id, created_by, year, month)
  where status = 'draft';

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  -- מפתח שנוצר בדפדפן לכל ניסיון שמירה: ניסיון חוזר לא יוצר הוצאה כפולה
  client_key uuid unique,
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete restrict,
  paid_by uuid references auth.users (id) on delete set null,
  merchant_name text check (merchant_name is null or char_length(merchant_name) between 1 and 120),
  description text check (description is null or char_length(description) between 1 and 240),
  amount numeric(12, 2) not null check (amount > 0 and amount <= 10000000),
  currency text not null default 'ILS' check (currency in ('ILS', 'USD', 'EUR')),
  expense_date date not null check (expense_date between date '2000-01-01' and date '2100-12-31'),
  category_id uuid not null references public.categories (id) on delete restrict,
  payment_method text check (
    payment_method is null or payment_method in (
      'cash', 'credit_card', 'bank_transfer', 'direct_debit', 'check', 'bit_paybox', 'other'
    )
  ),
  notes text check (notes is null or char_length(notes) <= 500),
  source text not null default 'manual' check (source in ('manual', 'monthly_entry')),
  is_historical boolean not null default false,
  is_recurring boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (merchant_name is not null or description is not null)
);

create index expenses_household_date_idx
  on public.expenses (household_id, expense_date desc) where deleted_at is null;
create index expenses_household_category_idx on public.expenses (household_id, category_id);
create index expenses_created_by_idx on public.expenses (created_by);
create index expenses_household_deleted_idx
  on public.expenses (household_id, deleted_at) where deleted_at is not null;

-- מעקב אידמפוטנטיות לשמירה חודשית: מפתח שנשמר פעם אחת לא ייכתב שוב
create table public.monthly_commit_batches (
  batch_key uuid primary key,
  draft_id uuid not null references public.monthly_entry_drafts (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  inserted_count integer not null check (inserted_count >= 0),
  inserted_total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  household_id uuid references public.households (id) on delete cascade,
  user_id uuid,
  action text not null check (char_length(action) <= 80),
  entity_type text not null check (char_length(entity_type) <= 40),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_household_created_idx on public.audit_log (household_id, created_at desc);

create table public.notebook_imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  file_size integer not null check (file_size between 1 and 10485760),
  year integer not null check (year between 2000 and 2100),
  month integer not null check (month between 1 and 12),
  extracted_text text,
  status text not null default 'uploaded' check (status in ('uploaded', 'reviewed', 'committed')),
  created_at timestamptz not null default now()
);

create index notebook_imports_household_created_idx
  on public.notebook_imports (household_id, created_at desc);

-- תמונות פרטיות: הנתיב מתחיל ב-household_id וממשיך ב-user_id/import_id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-images',
  'expense-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- פונקציות עזר
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_admin(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  );
$$;

create or replace function public.shares_household_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members other on other.household_id = me.household_id
    where me.user_id = auth.uid()
      and other.user_id = p_user_id
  );
$$;

-- בודק שורה אחת משמירה חודשית. מחזיר קוד סיבה, או null אם השורה תקינה.
create or replace function public.monthly_row_error(p_row jsonb, p_household_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_amount_text text := coalesce(p_row ->> 'amount', '');
  v_amount numeric;
  v_date_text text := coalesce(p_row ->> 'expense_date', '');
  v_category_id uuid;
  v_paid_text text := nullif(p_row ->> 'paid_by', '');
  v_paid_by uuid;
begin
  if v_amount_text !~ '^[0-9]{1,9}(\.[0-9]{1,2})?$' then
    return 'amount';
  end if;
  v_amount := v_amount_text::numeric;
  if v_amount <= 0 or v_amount > 10000000 then
    return 'amount';
  end if;

  if v_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return 'date';
  end if;
  begin
    perform v_date_text::date;
  exception when others then
    return 'date';
  end;

  if nullif(btrim(coalesce(p_row ->> 'merchant_name', '')), '') is null
     and nullif(btrim(coalesce(p_row ->> 'description', '')), '') is null then
    return 'label';
  end if;

  begin
    v_category_id := (p_row ->> 'category_id')::uuid;
  exception when others then
    return 'category';
  end;
  if not exists (
    select 1
    from public.categories c
    where c.id = v_category_id
      and c.household_id = p_household_id
      and c.is_active
  ) then
    return 'category';
  end if;

  if v_paid_text is not null then
    begin
      v_paid_by := v_paid_text::uuid;
    exception when others then
      return 'paid_by';
    end;
    if not exists (
      select 1
      from public.household_members m
      where m.household_id = p_household_id
        and m.user_id = v_paid_by
    ) then
      return 'paid_by';
    end if;
  end if;

  if nullif(p_row ->> 'payment_method', '') is not null
     and p_row ->> 'payment_method' not in (
       'cash', 'credit_card', 'bank_transfer', 'direct_debit', 'check', 'bit_paybox', 'other'
     ) then
    return 'payment_method';
  end if;

  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- טריגרים
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 80),
    left(new.raw_user_meta_data ->> 'avatar_url', 500)
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.profiles.display_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- קטגוריות ברירת המחדל לפי מסמך הדרישות (סעיף 11), בתוספת "אירועים"
create or replace function public.seed_default_categories()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (household_id, name, icon, color, is_default, sort_order)
  values
    (new.id, 'מזון וסופר', 'shopping-cart', '#2563eb', true, 10),
    (new.id, 'מסעדות ומשלוחים', 'utensils', '#16a34a', true, 20),
    (new.id, 'צרכנות וקניות', 'shopping-bag', '#f59e0b', true, 30),
    (new.id, 'דיור', 'house', '#dc2626', true, 40),
    (new.id, 'שכירות או משכנתה', 'key-round', '#7c3aed', true, 50),
    (new.id, 'חשמל', 'zap', '#0891b2', true, 60),
    (new.id, 'מים', 'droplet', '#db2777', true, 70),
    (new.id, 'ארנונה', 'landmark', '#65a30d', true, 80),
    (new.id, 'גז', 'flame', '#ea580c', true, 90),
    (new.id, 'תקשורת ואינטרנט', 'wifi', '#4f46e5', true, 100),
    (new.id, 'סלולר', 'smartphone', '#0d9488', true, 110),
    (new.id, 'בנק ועמלות', 'banknote', '#64748b', true, 120),
    (new.id, 'הלוואות', 'hand-coins', '#2563eb', true, 130),
    (new.id, 'ביטוחים', 'shield', '#16a34a', true, 140),
    (new.id, 'תחבורה', 'bus', '#f59e0b', true, 150),
    (new.id, 'דלק', 'fuel', '#dc2626', true, 160),
    (new.id, 'רכב', 'car', '#7c3aed', true, 170),
    (new.id, 'בריאות', 'heart-pulse', '#0891b2', true, 180),
    (new.id, 'תרופות', 'pill', '#db2777', true, 190),
    (new.id, 'חינוך', 'graduation-cap', '#65a30d', true, 200),
    (new.id, 'ילדים', 'baby', '#ea580c', true, 210),
    (new.id, 'ביגוד ואופנה', 'shirt', '#4f46e5', true, 220),
    (new.id, 'בילויים ופנאי', 'party-popper', '#0d9488', true, 230),
    (new.id, 'חופשות ונסיעות', 'plane', '#64748b', true, 240),
    (new.id, 'אחזקת הבית', 'wrench', '#2563eb', true, 250),
    (new.id, 'בעלי מקצוע', 'briefcase', '#16a34a', true, 260),
    (new.id, 'מנויים ושירותים דיגיטליים', 'tv', '#f59e0b', true, 270),
    (new.id, 'אירועים', 'calendar-heart', '#db2777', true, 280),
    (new.id, 'מתנות ותרומות', 'gift', '#dc2626', true, 290),
    (new.id, 'חיות מחמד', 'paw-print', '#7c3aed', true, 300),
    (new.id, 'הוצאות חד-פעמיות', 'receipt', '#0891b2', true, 310),
    (new.id, 'אחר', 'ellipsis', '#db2777', true, 320)
  on conflict (household_id, name) do nothing;
  return new;
end;
$$;

create trigger households_seed_categories
after insert on public.households
for each row execute function public.seed_default_categories();

create or replace function public.audit_household_rename()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    insert into public.audit_log (household_id, user_id, action, entity_type, entity_id)
    values (new.id, auth.uid(), 'household.rename', 'household', new.id);
  end if;
  return new;
end;
$$;

create trigger households_audit_rename
after update of name on public.households
for each row execute function public.audit_household_rename();

create or replace function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'admin' and not exists (
      select 1 from public.household_members
      where household_id = old.household_id and role = 'admin' and id <> old.id
    ) then
      raise exception 'לא ניתן להסיר את המנהל האחרון של משק הבית';
    end if;
    insert into public.audit_log (household_id, user_id, action, entity_type, entity_id)
    values (old.household_id, auth.uid(), 'member.remove', 'member', old.user_id);
    return old;
  end if;

  if old.role = 'admin' and new.role <> 'admin' and not exists (
    select 1 from public.household_members
    where household_id = old.household_id and role = 'admin' and id <> old.id
  ) then
    raise exception 'לא ניתן להסיר את ההרשאה מהמנהל האחרון של משק הבית';
  end if;
  if new.role is distinct from old.role then
    insert into public.audit_log (household_id, user_id, action, entity_type, entity_id, metadata)
    values (new.household_id, auth.uid(), 'member.role_change', 'member', new.user_id,
            jsonb_build_object('role', new.role));
  end if;
  return new;
end;
$$;

create trigger household_members_protect_admin
before update or delete on public.household_members
for each row execute function public.protect_last_admin();

create or replace function public.validate_expense_refs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by then
      raise exception 'לא ניתן לשנות את מי שהוסיף את ההוצאה';
    end if;
    if new.household_id is distinct from old.household_id then
      raise exception 'לא ניתן להעביר הוצאה בין משקי בית';
    end if;
  end if;

  if tg_op = 'INSERT' or new.category_id is distinct from old.category_id then
    if not exists (
      select 1 from public.categories c
      where c.id = new.category_id
        and c.household_id = new.household_id
        and c.is_active
    ) then
      raise exception 'הקטגוריה שנבחרה אינה זמינה למשק הבית';
    end if;
  end if;

  if new.paid_by is not null and not exists (
    select 1 from public.household_members m
    where m.household_id = new.household_id and m.user_id = new.paid_by
  ) then
    raise exception 'מי ששילם חייב להיות חבר במשק הבית';
  end if;

  return new;
end;
$$;

create trigger expenses_validate_refs
before insert or update on public.expenses
for each row execute function public.validate_expense_refs();

create or replace function public.audit_expense_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'expense.create';
  elsif new.deleted_at is not null and old.deleted_at is null then
    v_action := 'expense.delete';
  elsif new.deleted_at is null and old.deleted_at is not null then
    v_action := 'expense.restore';
  else
    v_action := 'expense.update';
  end if;

  insert into public.audit_log (household_id, user_id, action, entity_type, entity_id)
  values (new.household_id, auth.uid(), v_action, 'expense', new.id);
  return new;
end;
$$;

create trigger expenses_audit
after insert or update on public.expenses
for each row execute function public.audit_expense_change();

create trigger categories_touch before update on public.categories
for each row execute function public.touch_updated_at();
create trigger households_touch before update on public.households
for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger drafts_touch before update on public.monthly_entry_drafts
for each row execute function public.touch_updated_at();
create trigger expenses_touch before update on public.expenses
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- פונקציות שנקראות מהאפליקציה (RPC)
-- ---------------------------------------------------------------------

create or replace function public.create_household(p_name text, p_currency text default 'ILS')
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_household public.households;
begin
  if v_user is null then
    raise exception 'יש להתחבר כדי ליצור משק בית';
  end if;
  if char_length(v_name) < 1 then
    raise exception 'יש להזין שם למשק הבית';
  end if;
  if char_length(v_name) > 100 then
    raise exception 'שם משק הבית ארוך מדי (עד 100 תווים)';
  end if;
  if p_currency not in ('ILS', 'USD', 'EUR') then
    raise exception 'המטבע שנבחר אינו נתמך';
  end if;

  insert into public.households (name, default_currency, created_by)
  values (v_name, p_currency, v_user)
  returning * into v_household;

  insert into public.household_members (household_id, user_id, role)
  values (v_household.id, v_user, 'admin');

  insert into public.audit_log (household_id, user_id, action, entity_type, entity_id)
  values (v_household.id, v_user, 'household.create', 'household', v_household.id);

  return v_household;
end;
$$;

-- שמירה חודשית אטומית:
-- 1. מפתח אידמפוטנטיות (batch key) מונע הכפלה בניסיון חוזר.
-- 2. בדיקת גרסה (optimistic locking) מונעת דריסה של טיוטה שעודכנה במקום אחר.
-- 3. כל השורות נבדקות לפני ההוספה: או שכולן נשמרות, או שאף אחת לא נשמרת.
-- 4. השורות שלא נשמרו נשארות בטיוטה.
create or replace function public.commit_monthly_entry(
  p_household_id uuid,
  p_draft_id uuid,
  p_batch_key uuid,
  p_expected_version integer,
  p_rows jsonb,
  p_remaining_draft jsonb,
  p_currency text default 'ILS'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_draft public.monthly_entry_drafts%rowtype;
  v_batch public.monthly_commit_batches%rowtype;
  v_row jsonb;
  v_error text;
  v_bad_rows integer := 0;
  v_count integer := 0;
  v_total numeric(14, 2) := 0;
  v_remaining integer;
  v_remaining_draft jsonb := coalesce(p_remaining_draft, '{"rows": []}'::jsonb);
begin
  if v_user is null then
    raise exception 'יש להתחבר כדי לשמור הוצאות';
  end if;
  if p_household_id is null or p_draft_id is null or p_batch_key is null then
    raise exception 'חסרים פרטים לשמירה';
  end if;
  if not public.is_household_member(p_household_id) then
    raise exception 'אין הרשאה למשק הבית הזה';
  end if;

  -- שמירה חוזרת עם אותו מפתח: לא כותבים שוב
  select * into v_batch from public.monthly_commit_batches where batch_key = p_batch_key;
  if found then
    if v_batch.household_id <> p_household_id or v_batch.created_by <> v_user then
      raise exception 'מזהה השמירה כבר בשימוש';
    end if;
    return jsonb_build_object(
      'status', 'already_saved',
      'inserted_count', v_batch.inserted_count,
      'inserted_total', v_batch.inserted_total
    );
  end if;

  select * into v_draft
  from public.monthly_entry_drafts
  where id = p_draft_id
    and household_id = p_household_id
    and created_by = v_user
  for update;

  if not found then
    raise exception 'הטיוטה לא נמצאה';
  end if;
  if v_draft.status <> 'draft' then
    raise exception 'הטיוטה כבר נסגרה. פתחו טיוטה חדשה לחודש הזה';
  end if;
  if v_draft.version <> p_expected_version then
    raise exception 'הטיוטה עודכנה במקום אחר. רעננו את המסך ונסו שוב';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'אין שורות לשמירה';
  end if;
  if jsonb_array_length(p_rows) > 300 then
    raise exception 'ניתן לשמור עד 300 שורות בכל פעם';
  end if;
  if p_currency not in ('ILS', 'USD', 'EUR') then
    raise exception 'המטבע שנבחר אינו נתמך';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_error := public.monthly_row_error(v_row, p_household_id);
    if v_error is not null then
      v_bad_rows := v_bad_rows + 1;
    end if;
  end loop;

  if v_bad_rows = 1 then
    raise exception 'שורה אחת אינה תקינה. לא נשמרה אף שורה';
  elsif v_bad_rows > 1 then
    raise exception '% שורות אינן תקינות. לא נשמרה אף שורה', v_bad_rows;
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    insert into public.expenses (
      household_id, created_by, paid_by, merchant_name, description, amount, currency,
      expense_date, category_id, payment_method, notes, source, is_historical, is_recurring
    )
    values (
      p_household_id,
      v_user,
      nullif(v_row ->> 'paid_by', '')::uuid,
      nullif(btrim(v_row ->> 'merchant_name'), ''),
      nullif(btrim(v_row ->> 'description'), ''),
      round((v_row ->> 'amount')::numeric, 2),
      p_currency,
      (v_row ->> 'expense_date')::date,
      (v_row ->> 'category_id')::uuid,
      nullif(v_row ->> 'payment_method', ''),
      nullif(btrim(v_row ->> 'notes'), ''),
      'monthly_entry',
      coalesce((v_row ->> 'is_historical')::boolean, false),
      coalesce((v_row ->> 'is_recurring')::boolean, false)
    );
    v_count := v_count + 1;
    v_total := v_total + round((v_row ->> 'amount')::numeric, 2);
  end loop;

  v_remaining := case
    when jsonb_typeof(v_remaining_draft -> 'rows') = 'array' then jsonb_array_length(v_remaining_draft -> 'rows')
    else 0
  end;

  update public.monthly_entry_drafts
  set draft_data = v_remaining_draft,
      version = v_draft.version + 1,
      status = case when v_remaining = 0 then 'committed'::public.draft_status else 'draft'::public.draft_status end,
      committed_at = case when v_remaining = 0 then now() else null end
  where id = v_draft.id;

  insert into public.monthly_commit_batches (batch_key, draft_id, household_id, created_by, inserted_count, inserted_total)
  values (p_batch_key, v_draft.id, p_household_id, v_user, v_count, v_total);

  insert into public.audit_log (household_id, user_id, action, entity_type, entity_id, metadata)
  values (p_household_id, v_user, 'monthly.commit', 'monthly_entry_draft', v_draft.id,
          jsonb_build_object('inserted_count', v_count, 'remaining_count', v_remaining));

  return jsonb_build_object(
    'status', 'saved',
    'inserted_count', v_count,
    'inserted_total', v_total,
    'remaining_count', v_remaining
  );
end;
$$;

-- ---------------------------------------------------------------------
-- שאילתות חיפוש, סינון וצבירה
-- הפונקציות רצות בהרשאות המשתמש (security invoker), לכן RLS חל עליהן.
-- ---------------------------------------------------------------------

create or replace function public.escape_like(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_');
$$;

create or replace function public.expense_search(
  p_household_id uuid,
  p_from date default null,
  p_to date default null,
  p_category_id uuid default null,
  p_query text default null,
  p_amount numeric default null,
  p_sort text default 'date_desc',
  p_deleted boolean default false,
  p_limit integer default 30,
  p_offset integer default 0
)
returns setof public.expenses
language sql
stable
security invoker
set search_path = public
as $$
  select e.*
  from public.expenses e
  left join public.categories c on c.id = e.category_id
  where e.household_id = p_household_id
    and (e.deleted_at is not null) = coalesce(p_deleted, false)
    and (p_from is null or e.expense_date >= p_from)
    and (p_to is null or e.expense_date <= p_to)
    and (p_category_id is null or e.category_id = p_category_id)
    and (
      coalesce(btrim(p_query), '') = ''
      or e.merchant_name ilike '%' || public.escape_like(btrim(p_query)) || '%' escape '\'
      or e.description ilike '%' || public.escape_like(btrim(p_query)) || '%' escape '\'
      or e.notes ilike '%' || public.escape_like(btrim(p_query)) || '%' escape '\'
      or c.name ilike '%' || public.escape_like(btrim(p_query)) || '%' escape '\'
      or (p_amount is not null and e.amount = p_amount)
    )
  order by
    case when p_sort = 'date_asc' then e.expense_date end asc,
    case when p_sort = 'amount_desc' then e.amount end desc,
    case when p_sort = 'amount_asc' then e.amount end asc,
    case when p_sort = 'merchant' then lower(coalesce(e.merchant_name, e.description)) end asc,
    case when p_sort = 'category' then c.name end asc,
    e.expense_date desc,
    e.created_at desc,
    e.id
  limit least(greatest(coalesce(p_limit, 30), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.expense_summary(
  p_household_id uuid,
  p_from date default null,
  p_to date default null,
  p_category_id uuid default null,
  p_query text default null,
  p_amount numeric default null,
  p_deleted boolean default false,
  p_missing_info boolean default false
)
returns table (item_count bigint, total_amount numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*), coalesce(sum(e.amount), 0)::numeric(14, 2)
  from public.expenses e
  left join public.categories c on c.id = e.category_id
  where e.household_id = p_household_id
    and (e.deleted_at is not null) = coalesce(p_deleted, false)
    and (p_from is null or e.expense_date >= p_from)
    and (p_to is null or e.expense_date <= p_to)
    and (p_category_id is null or e.category_id = p_category_id)
    and (not coalesce(p_missing_info, false) or e.merchant_name is null)
    and (
      coalesce(btrim(p_query), '') = ''
      or e.merchant_name ilike '%' || public.escape_like(btrim(p_query)) || '%' escape '\'
      or e.description ilike '%' || public.escape_like(btrim(p_query)) || '%' escape '\'
      or e.notes ilike '%' || public.escape_like(btrim(p_query)) || '%' escape '\'
      or c.name ilike '%' || public.escape_like(btrim(p_query)) || '%' escape '\'
      or (p_amount is not null and e.amount = p_amount)
    );
$$;

create or replace function public.expense_daily_totals(p_household_id uuid, p_from date, p_to date)
returns table (day date, total_amount numeric, item_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select e.expense_date, sum(e.amount)::numeric(14, 2), count(*)
  from public.expenses e
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_from and p_to
  group by e.expense_date
  order by e.expense_date;
$$;

create or replace function public.expense_category_totals(p_household_id uuid, p_from date, p_to date)
returns table (category_id uuid, total_amount numeric, item_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select e.category_id, sum(e.amount)::numeric(14, 2), count(*)
  from public.expenses e
  where e.household_id = p_household_id
    and e.deleted_at is null
    and e.expense_date between p_from and p_to
  group by e.category_id
  order by sum(e.amount) desc, e.category_id;
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.monthly_entry_drafts enable row level security;
alter table public.monthly_commit_batches enable row level security;
alter table public.audit_log enable row level security;
alter table public.notebook_imports enable row level security;

-- פרופילים: כל משתמש רואה את עצמו ואת חברי משקי הבית המשותפים לו
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_household_with(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- משקי בית: רק חברים רואים; רק מנהל מעדכן. יצירה רק דרך create_household.
create policy households_select on public.households for select to authenticated
  using (public.is_household_member(id));
create policy households_update_admin on public.households for update to authenticated
  using (public.is_household_admin(id)) with check (public.is_household_admin(id));

-- חברות: חברים רואים את כל החברים; מנהל בלבד מוסיף/משנה תפקידים; חבר יכול לעזוב.
create policy members_select on public.household_members for select to authenticated
  using (public.is_household_member(household_id));
create policy members_insert_admin on public.household_members for insert to authenticated
  with check (public.is_household_admin(household_id));
create policy members_update_admin on public.household_members for update to authenticated
  using (public.is_household_admin(household_id)) with check (public.is_household_admin(household_id));
create policy members_delete on public.household_members for delete to authenticated
  using (public.is_household_admin(household_id) or user_id = auth.uid());

-- קטגוריות: כל החברים קוראים; מנהל בלבד יוצר ומעדכן. אין מחיקה פיזית.
create policy categories_select on public.categories for select to authenticated
  using (public.is_household_member(household_id));
create policy categories_insert_admin on public.categories for insert to authenticated
  with check (public.is_household_admin(household_id));
create policy categories_update_admin on public.categories for update to authenticated
  using (public.is_household_admin(household_id)) with check (public.is_household_admin(household_id));

-- הוצאות:
-- קריאה: חברים רואים הוצאות פעילות; מנהל ויוצר ההוצאה רואים גם מחוקות (סל מחזור).
-- הוספה: חבר בלבד, בשם עצמו.
-- עדכון: יוצר ההוצאה או מנהל. אין מדיניות מחיקה פיזית (מחיקה רכה בלבד).
create policy expenses_select on public.expenses for select to authenticated
  using (
    public.is_household_member(household_id)
    and (deleted_at is null or created_by = auth.uid() or public.is_household_admin(household_id))
  );
create policy expenses_insert_member on public.expenses for insert to authenticated
  with check (public.is_household_member(household_id) and created_by = auth.uid());
create policy expenses_update on public.expenses for update to authenticated
  using (
    public.is_household_member(household_id)
    and (created_by = auth.uid() or public.is_household_admin(household_id))
  )
  with check (public.is_household_member(household_id));

-- טיוטות: רק היוצר רואה ומעדכן את הטיוטה שלו
create policy drafts_select_owner on public.monthly_entry_drafts for select to authenticated
  using (created_by = auth.uid() and public.is_household_member(household_id));
create policy drafts_insert_owner on public.monthly_entry_drafts for insert to authenticated
  with check (created_by = auth.uid() and public.is_household_member(household_id));
create policy drafts_update_owner on public.monthly_entry_drafts for update to authenticated
  using (created_by = auth.uid() and public.is_household_member(household_id))
  with check (created_by = auth.uid() and public.is_household_member(household_id));
create policy drafts_delete_owner on public.monthly_entry_drafts for delete to authenticated
  using (created_by = auth.uid());

-- יומן פעולות: מנהל בלבד קורא. הכתיבה נעשית רק בטריגרים ובפונקציות.
create policy audit_select_admin on public.audit_log for select to authenticated
  using (public.is_household_admin(household_id));

-- monthly_commit_batches: ללא מדיניות וללא הרשאות לדפדפן. נכתב רק על ידי commit_monthly_entry.

create policy notebook_imports_select on public.notebook_imports for select to authenticated
  using (public.is_household_member(household_id));
create policy notebook_imports_insert on public.notebook_imports for insert to authenticated
  with check (created_by = auth.uid() and public.is_household_member(household_id));
create policy notebook_imports_update on public.notebook_imports for update to authenticated
  using (created_by = auth.uid() and public.is_household_member(household_id))
  with check (created_by = auth.uid() and public.is_household_member(household_id));

-- רק חברי משק הבית יכולים לקרוא תמונות. הנתיב נבדק מול household_id.
create policy expense_images_select on storage.objects for select to authenticated
  using (
    bucket_id = 'expense-images'
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  );
create policy expense_images_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expense-images'
    and owner_id = auth.uid()::text
    and public.is_household_member((storage.foldername(name))[1]::uuid)
  );
create policy expense_images_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'expense-images'
    and (owner_id = auth.uid()::text or public.is_household_admin((storage.foldername(name))[1]::uuid))
  );

-- ---------------------------------------------------------------------
-- הרשאות (Grants): ברירת מחדל - אין הרשאה, ואז מעניקים רק את הנדרש
-- ---------------------------------------------------------------------

-- Supabase מעניקה ברירת מחדל הרחבה לכל הטבלאות והפונקציות; מבטלים הכול ומעניקים רק את הנדרש.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant usage on schema public to authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant select on public.households to authenticated;
grant update (name) on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update on public.categories to authenticated;
grant select, insert, update on public.expenses to authenticated;
grant select, insert, update, delete on public.monthly_entry_drafts to authenticated;
grant select on public.audit_log to authenticated;
grant select, insert, update on public.notebook_imports to authenticated;

grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_admin(uuid) to authenticated;
grant execute on function public.shares_household_with(uuid) to authenticated;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.commit_monthly_entry(uuid, uuid, uuid, integer, jsonb, jsonb, text) to authenticated;
grant execute on function public.escape_like(text) to authenticated;
grant execute on function public.expense_search(uuid, date, date, uuid, text, numeric, text, boolean, integer, integer) to authenticated;
grant execute on function public.expense_summary(uuid, date, date, uuid, text, numeric, boolean, boolean) to authenticated;
grant execute on function public.expense_daily_totals(uuid, date, date) to authenticated;
grant execute on function public.expense_category_totals(uuid, date, date) to authenticated;
