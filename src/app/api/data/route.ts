import { ZodError } from "zod";
import type { Dataset, Locale } from "@/lib/types";
import { parseMutation } from "@/lib/validation";
import { errorResponse, withGoogle } from "@/server/context";
import { applyMutation, readDataset, sheetUrl } from "@/server/sheets";

function localeOf(request: Request): Locale {
  const l = new URL(request.url).searchParams.get("locale");
  return l === "pt" || l === "fr" ? l : "en";
}

export async function GET(request: Request) {
  try {
    const locale = localeOf(request);
    const data = await withGoogle(locale, async ({ accessToken, spreadsheetId }) => {
      const { data, warning } = await readDataset(accessToken, spreadsheetId, locale);
      const full: Dataset = {
        ...data,
        meta: { source: "google", spreadsheetId, spreadsheetUrl: sheetUrl(spreadsheetId), syncedAt: new Date().toISOString(), warning },
      };
      return full;
    });
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  // Cheap CSRF guard on top of SameSite=Lax: cross-site forms can't set custom headers.
  if (request.headers.get("x-gelbien") !== "1") return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    const mutation = parseMutation(await request.json());
    const locale = localeOf(request);
    await withGoogle(locale, ({ accessToken, spreadsheetId }) => applyMutation(accessToken, spreadsheetId, mutation));
    return Response.json({ ok: true, syncedAt: new Date().toISOString() });
  } catch (err) {
    if (err instanceof ZodError) return Response.json({ error: "Invalid data", issues: err.issues.slice(0, 5) }, { status: 400 });
    return errorResponse(err);
  }
}
