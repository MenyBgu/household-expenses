-- תמיכה בהוצאות קבועות ובתשלומים חודשיים.
alter table public.expenses
  add column if not exists schedule_group_id uuid,
  add column if not exists schedule_type text not null default 'none',
  add column if not exists schedule_months integer,
  add column if not exists schedule_index integer;

alter table public.expenses
  drop constraint if exists expenses_schedule_type_check;

alter table public.expenses
  add constraint expenses_schedule_type_check
  check (schedule_type in ('none', 'fixed', 'installment'));

alter table public.expenses
  drop constraint if exists expenses_schedule_months_check;

alter table public.expenses
  add constraint expenses_schedule_months_check
  check (schedule_months is null or schedule_months between 1 and 120);

alter table public.expenses
  drop constraint if exists expenses_schedule_index_check;

alter table public.expenses
  add constraint expenses_schedule_index_check
  check (schedule_index is null or schedule_index between 1 and 120);

create index if not exists expenses_schedule_group_idx
  on public.expenses (household_id, schedule_group_id)
  where schedule_group_id is not null and deleted_at is null;
