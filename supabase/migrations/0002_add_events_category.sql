-- הוספת קטגוריית "אירועים" למשקי בית שכבר נוצרו.
-- ההוספה בטוחה להרצה חוזרת.
insert into public.categories (household_id, name, icon, color, is_default, sort_order)
select
  h.id,
  'אירועים',
  'calendar-heart',
  '#db2777',
  true,
  280
from public.households h
where not exists (
  select 1
  from public.categories c
  where c.household_id = h.id
    and c.name = 'אירועים'
);
