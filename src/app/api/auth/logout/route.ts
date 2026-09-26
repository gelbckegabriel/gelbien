import { revokeToken } from "@/server/google";
import { clearSession, readSession } from "@/server/session";

export async function POST() {
  const session = await readSession();
  if (session) await revokeToken(session.rt);
  await clearSession();
  return Response.json({ ok: true });
}
