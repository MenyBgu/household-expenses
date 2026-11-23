import HouseholdApp from "@/components/household-app";
import { getCurrentUser } from "@/lib/supabase/server";
import { connection } from "next/server";

export const instant = false;

export default async function Home({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await connection();
  const user = await getCurrentUser();
  const params = await searchParams;
  const loginNext = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : undefined;
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const dateValues = Object.fromEntries(dateParts.map((part) => [part.type, part.value]));
  const today = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
  const initialMonth = today.slice(0, 7);

  return (
    <HouseholdApp
      supabaseConfigured={Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)}
      userId={user?.id}
      userEmail={user?.email}
      displayName={user?.user_metadata?.full_name ?? user?.user_metadata?.name}
      initialDate={today}
      initialMonth={initialMonth}
      loginNext={loginNext}
    />
  );
}
