import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "חיבור Supabase אינו מוגדר." }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "יש להתחבר לפני שליחת הזמנה." }, { status: 401 });
  }

  let body: { householdId?: unknown; email?: unknown };
  try {
    body = await request.json() as { householdId?: unknown; email?: unknown };
  } catch {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  const householdId = typeof body.householdId === "string" ? body.householdId : "";
  const email = normalizeEmail(body.email);
  if (!householdId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "יש להזין כתובת אימייל תקינה." }, { status: 400 });
  }
  if (email === user.email.toLowerCase()) {
    return NextResponse.json({ error: "אי אפשר להזמין את עצמך." }, { status: 400 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError || membership?.role !== "admin") {
    return NextResponse.json({ error: "רק מנהל משק הבית יכול לשלוח הזמנות." }, { status: 403 });
  }

  const { data: existingInvitation } = await supabase
    .from("household_invitations")
    .select("id")
    .eq("household_id", householdId)
    .eq("invited_email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (existingInvitation) {
    return NextResponse.json({ error: "כבר קיימת הזמנה ממתינה לכתובת הזו." }, { status: 409 });
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error: invitationError } = await supabase.from("household_invitations").insert({
    household_id: householdId,
    invited_email: email,
    invited_by: user.id,
    token_hash: tokenHash,
  });
  if (invitationError) {
    return NextResponse.json({ error: "שמירת ההזמנה נכשלה. נסו שוב." }, { status: 500 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "חיבור Supabase אינו מוגדר." }, { status: 503 });
  }
  const authClient = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const callback = new URL("/auth/callback", request.url);
  callback.searchParams.set("next", `/invite/${token}`);
  const { error: emailError } = await authClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: callback.toString(),
    },
  });
  if (emailError) {
    return NextResponse.json({ error: "שליחת האימייל נכשלה. בדקו את הגדרות האימייל ב-Supabase." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
