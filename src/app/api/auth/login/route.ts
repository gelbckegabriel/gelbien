import { NextResponse } from "next/server";
import { appOrigin, googleConfig, isProd, OAUTH_COOKIE } from "@/server/config";
import { buildAuthUrl, pkceChallenge, randomToken } from "@/server/google";
import { seal } from "@/server/session";

/** Only same-origin paths — rejects "//host", "/\\host" and absolute URLs. */
function safeReturnTo(value: string | null, origin: string): string {
  if (!value || !value.startsWith("/")) return "/dashboard";
  try {
    const url = new URL(value, origin);
    return url.origin === origin ? `${url.pathname}${url.search}` : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export async function GET(request: Request) {
  const origin = appOrigin(request);
  if (!googleConfig()) return NextResponse.redirect(`${origin}/login?error=config`);

  const url = new URL(request.url);
  const locale = url.searchParams.get("locale");
  const state = randomToken();
  const verifier = randomToken(48);
  const flow = await seal(
    {
      state,
      verifier,
      returnTo: safeReturnTo(url.searchParams.get("returnTo"), origin),
      locale: locale === "pt" || locale === "fr" ? locale : "en",
    },
    600,
  );

  const res = NextResponse.redirect(
    buildAuthUrl({ redirectUri: `${origin}/api/auth/callback`, state, challenge: await pkceChallenge(verifier) }),
  );
  res.cookies.set(OAUTH_COOKIE, flow, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/api/auth", maxAge: 600 });
  return res;
}
