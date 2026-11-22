-- איחוד קטגוריות פנאי, בריאות, קניות ודיור.
begin;

-- שינוי שם היעד בטוח להרצה חוזרת; אם היעד כבר קיים, שלב ההעברה
-- יטפל בקטגוריה הישנה בנפרד.
update public.categories as old_category
set name = 'בריאות ותרופות',
    updated_at = now()
where old_category.name = 'בריאות'
  and not exists (
    select 1
    from public.categories as target
    where target.household_id = old_category.household_id
      and target.name = 'בריאות ותרופות'
  );

update public.expenses as expense
set category_id = target.id,
    updated_at = now()
from public.categories as source
join public.categories as target
  on target.household_id = source.household_id
 and target.name = case
   when source.name = 'חופשות ונסיעות' then 'בילויים ופנאי'
   when source.name in ('בריאות', 'תרופות') then 'בריאות ותרופות'
   when source.name = 'ביגוד ואופנה' then 'צרכנות וקניות'
   when source.name = 'בעלי מקצוע' then 'דיור'
 end
where expense.category_id = source.id
  and source.name in ('חופשות ונסיעות', 'בריאות', 'תרופות', 'ביגוד ואופנה', 'בעלי מקצוע')
  and source.id <> target.id;

update public.categories
set is_active = false,
    updated_at = now()
where name in ('חופשות ונסיעות', 'בריאות', 'תרופות', 'ביגוד ואופנה', 'בעלי מקצוע');

update public.categories
set is_active = true,
    updated_at = now()
where name in ('בילויים ופנאי', 'בריאות ותרופות', 'צרכנות וקניות', 'דיור');

commit;
