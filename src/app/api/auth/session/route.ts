import type { SessionInfo } from "@/lib/types";
import { googleConfig } from "@/server/config";
import { readSession } from "@/server/session";
import { sheetUrl } from "@/server/sheets";

export async function GET() {
  const session = await readSession();
  const body: SessionInfo = {
    googleConfigured: googleConfig() !== null,
    user: session ? { sub: session.sub, email: session.email, name: session.name, picture: session.picture } : null,
    spreadsheetId: session?.sid || null,
    spreadsheetUrl: session?.sid ? sheetUrl(session.sid) : null,
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
