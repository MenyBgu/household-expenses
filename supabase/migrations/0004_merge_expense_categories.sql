-- איחוד קטגוריות נוסף:
-- ההוצאות עוברות לקטגוריות היעד והקטגוריות המפורטות נשארות לא פעילות.
begin;

-- שינוי השם בטוח להרצה חוזרת; אם כבר קיימת קטגוריית היעד, נשאיר את
-- הקטגוריה הישנה כדי שהשלב הבא יוכל להעביר ממנה את ההוצאות.
update public.categories as old_category
set name = 'תחבורה ורכב',
    updated_at = now()
where old_category.name = 'תחבורה'
  and not exists (
    select 1
    from public.categories as target
    where target.household_id = old_category.household_id
      and target.name = 'תחבורה ורכב'
  );

update public.expenses as expense
set category_id = target.id,
    updated_at = now()
from public.categories as source
join public.categories as target
  on target.household_id = source.household_id
 and target.name = case
   when source.name = 'מזון וסופר' then 'צרכנות וקניות'
   when source.name in ('שכירות או משכנתה', 'חשמל', 'מים', 'ארנונה', 'גז', 'אחזקת הבית') then 'דיור'
   when source.name in ('תחבורה', 'דלק', 'רכב') then 'תחבורה ורכב'
   when source.name = 'הלוואות' then 'בנק ועמלות'
   when source.name = 'סלולר' then 'תקשורת ואינטרנט'
 end
where expense.category_id = source.id
  and source.name in (
    'מזון וסופר',
    'שכירות או משכנתה',
    'חשמל',
    'מים',
    'ארנונה',
    'גז',
    'אחזקת הבית',
    'תחבורה',
    'דלק',
    'רכב',
    'הלוואות',
    'סלולר'
  )
  and source.id <> target.id;

update public.categories
set is_active = false,
    updated_at = now()
where name in (
  'מזון וסופר',
  'שכירות או משכנתה',
  'חשמל',
  'מים',
  'ארנונה',
  'גז',
  'אחזקת הבית',
  'תחבורה',
  'דלק',
  'רכב',
  'הלוואות',
  'סלולר'
);

update public.categories
set is_active = true,
    updated_at = now()
where name in ('צרכנות וקניות', 'דיור', 'תחבורה ורכב', 'בנק ועמלות', 'תקשורת ואינטרנט');

commit;
