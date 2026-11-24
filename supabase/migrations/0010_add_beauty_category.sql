-- קטגוריה חדשה להוצאות טיפוח ויופי.
insert into public.categories (
  household_id,
  name,
  icon,
  color,
  is_default,
  is_active,
  sort_order
)
select
  households.id,
  'טיפוח ויופי',
  'sparkles',
  '#db2777',
  true,
  true,
  330
from public.households
where not exists (
  select 1
  from public.categories
  where categories.household_id = households.id
    and categories.name = 'טיפוח ויופי'
);
