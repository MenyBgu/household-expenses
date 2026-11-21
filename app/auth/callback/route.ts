import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/";
  let authenticationFailed = false;

  if (code) {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      authenticationFailed = Boolean(error);
    } else {
      authenticationFailed = true;
    }
  } else {
    authenticationFailed = true;
  }

  const destination = new URL(next, requestUrl.origin);
  if (authenticationFailed) destination.searchParams.set("auth", "failed");
  return NextResponse.redirect(destination);
}
