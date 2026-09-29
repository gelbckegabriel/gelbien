"use client";

import type { MessageKey, TFn } from "../i18n";
import { ApiError } from "./sources";

// Codes set by the server's errorResponse (googleErrorCode).
const BY_CODE: Record<string, MessageKey> = {
  storage: "err.why.storage",
  rateLimit: "err.why.rateLimit",
  unavailable: "err.why.unavailable",
  api: "err.why.api",
  lost: "err.why.lost",
  access: "err.why.access",
  sheet: "err.why.sheet",
};

/** The explanation for a server error code (e.g. a sheet that can be read but not written), if there is one. */
export function reasonForCode(code: string, t: TFn): string | null {
  const key = BY_CODE[code];
  return key ? t(key) : null;
}

/** A short, translated explanation of why a request failed and what the user can do about it. */
export function errorReason(err: unknown, t: TFn): string {
  // fetch() itself rejects with a TypeError when the request never reached the server
  if (err instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine)) return t("err.why.network");
  if (!(err instanceof ApiError)) return t("err.why.unknown", { detail: (err as Error)?.message ?? String(err) });
  if (err.status === 401) return t("err.session");
  const key = err.code ? BY_CODE[err.code] : undefined;
  if (key) return t(key);
  if (err.status === 400) return t("err.why.invalid", { detail: err.message });
  // 502–504: Google or the function behind /api timed out or is down
  if (err.status >= 502) return t("err.why.unavailable");
  return t("err.why.unknown", { detail: err.message });
}
