-- איחוד קטגוריות דיור:
-- ההוצאות הקיימות עוברות ל"דיור", והקטגוריות הישנות נשארות לא פעילות
-- כדי לשמור על היסטוריית הנתונים ועל קשרי המפתח הזר.
begin;

update public.expenses as expense
set category_id = target.id,
    updated_at = now()
from public.categories as source
join public.categories as target
  on target.household_id = source.household_id
 and target.name = 'דיור'
where expense.category_id = source.id
  and source.name in ('שכירות או משכנתה', 'חשמל', 'מים', 'ארנונה', 'גז')
  and source.id <> target.id;

update public.categories
set is_active = false,
    updated_at = now()
where name in ('שכירות או משכנתה', 'חשמל', 'מים', 'ארנונה', 'גז');

commit;
