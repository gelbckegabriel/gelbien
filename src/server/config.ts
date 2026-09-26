import "server-only";

export const SESSION_COOKIE = "gelbien_session";
export const OAUTH_COOKIE = "gelbien_oauth";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  // Non-sensitive: only files this app creates (or the user opens with it). No Google verification needed.
  "https://www.googleapis.com/auth/drive.file",
];

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  authSecret: string;
}

export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const authSecret = process.env.AUTH_SECRET;
  if (!clientId || !clientSecret || !authSecret || authSecret.length < 32) return null;
  return { clientId, clientSecret, authSecret };
}

/** Public origin of the app — APP_URL wins (needed behind proxies), else the request's own origin. */
export function appOrigin(request: Request): string {
  const fromEnv = process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  return `${proto}://${host}`;
}

export const isProd = process.env.NODE_ENV === "production";
