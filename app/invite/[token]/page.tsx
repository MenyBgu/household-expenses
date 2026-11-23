import { createHash } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return <InvitationError message="קישור ההזמנה אינו תקין." />;
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return <InvitationError message="חיבור Supabase אינו מוגדר." />;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/?next=/invite/${token}`);
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.rpc("accept_household_invitation", { p_token_hash: tokenHash });
  if (error) {
    return <InvitationError message="ההזמנה אינה זמינה, פגה או נשלחה לכתובת אימייל אחרת." />;
  }
  redirect("/");
}

function InvitationError({ message }: { message: string }) {
  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">הצטרפות למשק בית</p>
        <h1>לא ניתן להשלים את ההזמנה</h1>
        <p className="muted">{message}</p>
        <Link className="primary-button wide-button" href="/">חזרה לאפליקציה</Link>
      </section>
    </main>
  );
}
