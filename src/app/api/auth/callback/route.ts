import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/types";
import { appOrigin, googleConfig, OAUTH_COOKIE } from "@/server/config";
import { decodeIdToken, exchangeCode } from "@/server/google";
import { unseal, writeSession } from "@/server/session";
import { ensureSpreadsheet } from "@/server/sheets";

interface Flow {
  state: string;
  verifier: string;
  returnTo: string;
  locale: Locale;
}

export async function GET(request: Request) {
  const origin = appOrigin(request);
  const fail = (code: string) => NextResponse.redirect(`${origin}/login?error=${code}`);
  if (!googleConfig()) return fail("config");

  const url = new URL(request.url);
  const store = await cookies();
  const flow = await unseal<Flow>(store.get(OAUTH_COOKIE)?.value);
  store.delete({ name: OAUTH_COOKIE, path: "/api/auth" });

  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code || !flow || flow.state !== url.searchParams.get("state")) {
    return fail("generic");
  }

  try {
    const tok = await exchangeCode(code, flow.verifier, `${origin}/api/auth/callback`);
    // Google's granular consent lets people untick Drive access — without it there's no database.
    if (!tok.scope.split(" ").includes("https://www.googleapis.com/auth/drive.file")) return fail("scope");
    if (!tok.refresh_token || !tok.id_token) return fail("generic");

    const profile = decodeIdToken(tok.id_token);
    const sid = await ensureSpreadsheet(tok.access_token, flow.locale, profile.name ?? "");
    await writeSession({
      sub: profile.sub,
      email: profile.email,
      name: profile.name ?? profile.email,
      picture: profile.picture ?? "",
      rt: tok.refresh_token,
      at: tok.access_token,
      atExp: Math.floor(Date.now() / 1000) + tok.expires_in,
      sid,
    });
    return NextResponse.redirect(`${origin}${flow.returnTo}`);
  } catch (err) {
    console.error("OAuth callback failed", err);
    return fail("generic");
  }
}
