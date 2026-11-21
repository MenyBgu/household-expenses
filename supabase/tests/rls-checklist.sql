-- בדיקות ידניות להרצה בסביבת Supabase ייעודית.
-- יש להריץ כאשר מחוברים פעם כמשתמש א' ופעם כמשתמש ב'.

-- 1. משתמש א' רואה רק את משקי הבית שבהם הוא חבר:
select id, name from public.households;

-- 2. משתמש א' אינו יכול לקרוא הוצאה של משק בית שאינו שלו:
select *
from public.expenses
where household_id = '<household-id-of-user-b>';

-- 3. חבר אינו יכול לשנות הוצאה של משתמש אחר:
update public.expenses
set description = 'ניסיון לא מורשה'
where id = '<expense-created-by-user-b>';

-- 4. משתמש אינו יכול להצטרף ישירות למשק בית באמצעות insert:
insert into public.household_members (household_id, user_id)
values ('<household-id-of-user-b>', auth.uid());

-- 5. מנהל יכול ליצור משק בית דרך ה-RPC:
select public.create_household('משק בית בדיקה', 'ILS');

-- את בדיקות 2–4 יש לצפות לראות נכשלות או מחזירות אפס שורות.
