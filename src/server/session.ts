import "server-only";
import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import { googleConfig, isProd, SESSION_COOKIE, SESSION_MAX_AGE } from "./config";

export interface Session {
  sub: string;
  email: string;
  name: string;
  picture: string;
  /** Google refresh token */
  rt: string;
  /** Google access token + expiry (epoch seconds) */
  at: string;
  atExp: number;
  /** Spreadsheet id in the user's Drive */
  sid: string;
}

let cachedKey: { secret: string; key: Uint8Array } | null = null;

async function key(): Promise<Uint8Array> {
  const secret = googleConfig()?.authSecret;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  if (cachedKey?.secret === secret) return cachedKey.key;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  cachedKey = { secret, key: new Uint8Array(digest) };
  return cachedKey.key;
}

/** Encrypt (not just sign) — the cookie carries a Google refresh token. */
export async function seal(payload: JWTPayload, maxAgeSeconds: number): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .encrypt(await key());
}

export async function unseal<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, await key());
    return payload as T;
  } catch {
    return null;
  }
}

export async function readSession(): Promise<Session | null> {
  if (!googleConfig()) return null;
  const store = await cookies();
  const s = await unseal<Session>(store.get(SESSION_COOKIE)?.value);
  return s?.sub && s.rt ? s : null;
}

export async function writeSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await seal({ ...session }, SESSION_MAX_AGE), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
