# הוצאות הבית

אפליקציית Web בעברית ובכיוון RTL לניהול הוצאות משק הבית.

## מה עובד ב-MVP

- מצב הדגמה מקומי ללא חשבונות חיצוניים.
- התחברות Google באמצעות Supabase Auth כאשר משתני הסביבה מוגדרים.
- יצירת משק בית.
- קטגוריות ברירת מחדל.
- הוספת הוצאה, עריכה ומחיקה רכה.
- רשימת הוצאות עם חיפוש וסינון לפי חודש וקטגוריה.
- הזנת חודש שלם עם טיוטה, בדיקת תקינות ואישור לפני שמירה.
- העלאת תמונת דף הוצאות, קריאת OCR מקומית והצעת קטגוריות לפי הטקסט.
- לוח בקרה חודשי עם גרף לפי קטגוריה והשוואה לחודש קודם.
- ממשק רספונסיבי, בעברית וב-RTL.

הזיהוי מהתמונה הוא הצעה בלבד: המשתמש חייב לבדוק ולאשר את השורות לפני שמירה.
קבלות, ייבוא CSV/Excel, הזמנות, תקציבים ודוחות מתקדמים נמצאים בשלבים הבאים.

## הפעלה מקומית במצב הדגמה

דרישות:

- Node.js 20 ומעלה
- npm

```bash
npm install
npm run dev
```

פתחו בדפדפן את `http://localhost:3000`.

ללא `.env.local` האפליקציה פועלת במצב הדגמה. הנתונים נשמרים ב-Local Storage של הדפדפן ואינם מהווים סביבת Production.

## הפעלה עם Supabase

1. צרו פרויקט חדש ב-Supabase.
2. העתיקו את `.env.example` ל-`.env.local`.
3. הגדירו:

```text
NEXT_PUBLIC_SUPABASE_URL=כתובת-הפרויקט
NEXT_PUBLIC_SUPABASE_ANON_KEY=המפתח-הציבורי
```

4. הפעילו את הקובץ:

```text
supabase/migrations/0001_initial_schema.sql
```

אפשר להריץ אותו דרך SQL Editor של Supabase או באמצעות Supabase CLI.
אם הסכימה כבר הופעלה בעבר, יש להריץ גם את `supabase/migrations/0002_add_events_category.sql`, את `supabase/migrations/0003_merge_housing_categories.sql`, את `supabase/migrations/0004_merge_expense_categories.sql` ואת `supabase/migrations/0005_add_yearly_totals.sql`.

5. ב-Supabase פתחו את Authentication → Providers והפעילו Google.
6. הגדירו ב-Google Cloud OAuth Client:
   - כתובת האתר המקומית: `http://localhost:3000`
   - כתובת callback של Supabase:
     `https://<project-ref>.supabase.co/auth/v1/callback`
7. הגדירו ב-Supabase את כתובת ה-Redirect:
   - `http://localhost:3000/auth/callback`
   - כתובת Production שתשמש בעתיד ב-Vercel

אין להכניס `.env.local` או סודות ל-GitHub.

## בדיקות מקומיות

```bash
npm run lint
npm test
npm run test:e2e
# בדיקת קריאה על תמונה אמיתית (אופציונלי):
OCR_IMAGE=/path/to/image.png npx vitest run tests/ocr --silent=false
npm run build
```

## פריסה ב-Vercel

1. העלו את התיקייה למאגר GitHub פרטי.
2. ב-Vercel בחרו Import Project.
3. הגדירו את שני משתני הסביבה של Supabase.
4. הוסיפו את כתובת ה-Production של Vercel לכתובות ה-Redirect ב-Supabase וב-Google.
5. הריצו Deploy.

אין לטעון service-role key ל-Vercel כמשתנה ציבורי או לקוד הדפדפן.

## אבטחה

- כל טבלה מוגנת ב-Row Level Security.
- גישה מסוננת לפי חברות במשק הבית.
- מנהל וחבר מקבלים הרשאות שונות.
- הוצאות נמחקות במחיקה רכה.
- שמירת הזנה חודשית מתבצעת דרך RPC טרנזקציוני.
- `batch_key` מונע שמירה כפולה של הזנה חודשית.
- תמונות נשמרות ב-Supabase Storage פרטי, עם הרשאות לפי משק הבית.
- המפתח הציבורי של Supabase אינו סוד; service-role key לא נדרש בצד הלקוח.

יש לבדוק את מדיניות ה-RLS ב-Supabase עם שני משתמשים ושני משקי בית לפני Production.

## מבנה נתונים

הסכמה נמצאת ב-`supabase/migrations/0001_initial_schema.sql`.

ישויות ה-MVP:

- `profiles`
- `households`
- `household_members`
- `categories`
- `expenses`
- `monthly_entry_drafts`
- `monthly_commit_batches`
- `notebook_imports`

## מגבלות ידועות

- במצב הדגמה הנתונים מקומיים לדפדפן בלבד.
- OCR מקומי בעברית תלוי באיכות התמונה; כתב יד עלול לדרוש תיקון מלא.
- במצב הדגמה התמונה אינה נשמרת בשרת, אלא נקראת מקומית בלבד.
- ייבוא CSV/Excel עדיין אינו זמין.
- אין עדיין הזמנת בני משפחה.
- אין עדיין תקציבים, הוצאות קבועות או עסקאות בתשלומים.
- יש להגדיר OAuth ו-Supabase לפני שימוש אמיתי.
- מסלולים חינמיים של Supabase, Vercel ו-Google כפופים למכסות ולתנאי שימוש.

## העברת מידע מהמחברת

ב-MVP:

1. פתחו "הזנת חודש שלם".
2. בחרו חודש ושנה.
3. הזינו תאריך, עסק, סכום וקטגוריה.
4. אפשר להדביק שורות שהועתקו מ-Excel או Google Sheets.
5. שמרו טיוטה אם צריך להמשיך מאוחר יותר.
6. בדקו את הסיכום והכפילויות האפשריות.
7. אשרו את שמירת ההוצאות.

צילום דפי מחברת וזיהוי כתב יד זמינים כקריאת תמונה מקומית, אך התוצאה תמיד דורשת בדיקה ידנית.

### תהליך קריאת תמונה

1. פתחו את "הזנה מתמונה".
2. בחרו את החודש והשנה.
3. צלמו דף או בחרו תמונה מהגלריה.
4. הפעילו "קריאת התמונה".
5. בדקו את הסכומים, התיאורים והקטגוריות שהוצעו.
6. אשרו כדי להעביר את השורות למסך ההזנה החודשית.

כאשר בתמונה מופיעים רק חודש ושנה, המערכת אינה ממציאה יום. השורה מקבלת את היום הראשון בחודש ומסומנת לעריכה.
הפעלת הפרויקט מתבצעת באמצעות `npm run dev`. אין לשמור מפתחות או פרטי התחברות בקוד.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

הגופן והממשק מותאמים לעברית ולכיוון כתיבה מימין לשמאל.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
