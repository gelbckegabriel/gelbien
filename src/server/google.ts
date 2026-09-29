import "server-only";
import { GOOGLE_SCOPES, googleConfig } from "./config";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export class GoogleApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Google's machine-readable cause, e.g. "storageQuotaExceeded" or "SERVICE_DISABLED". */
    public reason?: string,
  ) {
    super(message);
  }
}

/** The user's Google storage is full: Drive refuses to create (or edit) files until they free space. */
export function isStorageFull(err: unknown): boolean {
  return err instanceof GoogleApiError && (err.reason === "storageQuotaExceeded" || /storage quota/i.test(err.message));
}

/** The Sheets or Drive API is switched off in the Cloud project — a deployment problem, not the user's. */
export function isApiDisabled(err: unknown): boolean {
  return err instanceof GoogleApiError && (err.reason === "SERVICE_DISABLED" || err.reason === "accessNotConfigured");
}

/** Why a Sheets/Drive call failed, in terms the app can explain to the user (see errorReason on the client). */
export type GoogleErrorCode = "storage" | "rateLimit" | "unavailable" | "api" | "lost" | "access" | "sheet" | "google";

export function googleErrorCode(err: GoogleApiError): GoogleErrorCode {
  if (isStorageFull(err)) return "storage";
  if (isApiDisabled(err)) return "api";
  // set by explainRefusal: the spreadsheet is out of reach (deleted for good, or the app's access removed)
  if (err.reason === "fileNotAccessible") return "lost";
  // Sheets answers 429; Drive uses 403 with a rate-limit reason.
  if (err.status === 429 || /rate_?limit|quota/i.test(err.reason ?? "")) return "rateLimit";
  if (err.status >= 500) return "unavailable";
  if (err.status === 403) return "access";
  // e.g. "Unable to parse range" after a tab was renamed or deleted by hand
  if (err.status === 400 || err.status === 404) return "sheet";
  return "google";
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function buildAuthUrl(opts: { redirectUri: string; state: string; challenge: string; loginHint?: string }): string {
  const cfg = googleConfig();
  if (!cfg) throw new Error("Google OAuth is not configured");
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    // consent is required for Google to hand out a refresh token every time
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state: opts.state,
    code_challenge: opts.challenge,
    code_challenge_method: "S256",
  });
  if (opts.loginHint) params.set("login_hint", opts.loginHint);
  return `${AUTH_URL}?${params}`;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope: string;
  token_type: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleApiError(res.status, json.error_description || json.error || "Token request failed");
  return json as TokenResponse;
}

export async function exchangeCode(code: string, verifier: string, redirectUri: string) {
  const cfg = googleConfig()!;
  return tokenRequest({
    code,
    code_verifier: verifier,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

export async function refreshAccessToken(refreshToken: string) {
  const cfg = googleConfig()!;
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });
}

export async function revokeToken(token: string) {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => undefined);
}

/**
 * Decode the id_token payload. It came straight from Google's token endpoint
 * over TLS in exchange for our client secret, so signature verification is not required.
 */
export function decodeIdToken(idToken: string): { sub: string; email: string; name?: string; picture?: string } {
  const payload = idToken.split(".")[1];
  const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json);
}

/** Authenticated JSON fetch against a Google API. */
export async function gfetch<T>(accessToken: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body && !(init.body instanceof FormData) && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    // Drive v3 puts the cause in errors[].reason; Sheets v4 in an ErrorInfo entry of details[].
    const reason = json?.error?.errors?.[0]?.reason ?? json?.error?.details?.find((d: { reason?: string }) => d?.reason)?.reason;
    throw new GoogleApiError(res.status, json?.error?.message || `Google API error ${res.status}`, reason);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
