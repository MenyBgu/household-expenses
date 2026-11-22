-- סיכום שנתי מדויק להצגת השוואה בין שנים, בלי לטעון את כל ההוצאות לדפדפן.
create or replace function public.expense_yearly_totals(p_household_id uuid)
returns table (year integer, total_amount numeric, item_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select extract(year from e.expense_date)::integer,
         sum(e.amount)::numeric(14, 2),
         count(*)
  from public.expenses e
  where e.household_id = p_household_id
    and e.deleted_at is null
  group by extract(year from e.expense_date)::integer
  order by extract(year from e.expense_date)::integer;
$$;

grant execute on function public.expense_yearly_totals(uuid) to authenticated;
