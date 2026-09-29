import "server-only";
import type { Locale } from "@/lib/types";
import { GoogleApiError, googleErrorCode, refreshAccessToken } from "./google";
import { clearSession, readSession, writeSession, type Session } from "./session";
import { ensureSpreadsheet, explainRefusal } from "./sheets";

export class AuthError extends Error {}

export interface GoogleContext {
  session: Session;
  accessToken: string;
  spreadsheetId: string;
}

async function freshToken(session: Session, force = false): Promise<Session> {
  const now = Math.floor(Date.now() / 1000);
  if (!force && session.at && session.atExp - 60 > now) return session;
  try {
    const tok = await refreshAccessToken(session.rt);
    return { ...session, at: tok.access_token, atExp: now + tok.expires_in, rt: tok.refresh_token ?? session.rt };
  } catch (err) {
    if (err instanceof GoogleApiError && (err.status === 400 || err.status === 401)) {
      throw new AuthError("Google session expired");
    }
    throw err;
  }
}

/**
 * Resolve the signed-in user's Google context for a route handler, refreshing the
 * access token and (re)locating the spreadsheet as needed, then run `fn`.
 * Retries once on a stale token or a spreadsheet that was deleted from Drive.
 */
export async function withGoogle<T>(locale: Locale, fn: (ctx: GoogleContext) => Promise<T>): Promise<T> {
  try {
    return await withSession(locale, fn);
  } catch (err) {
    // Google no longer accepts this login: the refresh token expired or was revoked, or a request
    // was refused even with a fresh token. Drop the cookie too — while it's there /login treats
    // the user as signed in and sends them straight back here. (Out here, after withSession's own cookie write.)
    if (err instanceof AuthError || (err instanceof GoogleApiError && err.status === 401)) {
      await clearSession();
      throw err instanceof AuthError ? err : new AuthError("Google session expired");
    }
    throw err;
  }
}

async function withSession<T>(locale: Locale, fn: (ctx: GoogleContext) => Promise<T>): Promise<T> {
  let session = await readSession();
  if (!session) throw new AuthError("Not signed in");
  const original = JSON.stringify(session);

  session = await freshToken(session);
  if (!session.sid) session = { ...session, sid: await ensureSpreadsheet(session.at, locale, session.name) };

  const run = () => fn({ session: session!, accessToken: session!.at, spreadsheetId: session!.sid });
  try {
    return await run();
  } catch (err) {
    if (!(err instanceof GoogleApiError)) throw err;
    if (err.status === 401) {
      session = await freshToken(session, true);
    } else if (err.status === 404) {
      session = { ...session, sid: await ensureSpreadsheet(session.at, locale, session.name) };
    } else {
      throw await explainRefusal(session.at, session.sid, err);
    }
    return await run();
  } finally {
    if (JSON.stringify(session) !== original) await writeSession(session);
  }
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AuthError) return Response.json({ error: err.message, code: "auth" }, { status: 401 });
  if (err instanceof GoogleApiError) {
    return Response.json({ error: err.message, code: googleErrorCode(err) }, { status: err.status >= 500 ? 502 : err.status });
  }
  console.error(err);
  return Response.json({ error: "Unexpected server error" }, { status: 500 });
}
