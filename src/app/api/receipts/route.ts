import { errorResponse, withGoogle } from "@/server/context";
import { uploadReceipt } from "@/server/sheets";

// Vercel caps function request bodies at ~4.5 MB; the client compresses images before upload.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = /^(image\/(jpeg|png|webp|heic|heif|gif)|application\/pdf)$/;

export async function POST(request: Request) {
  if (request.headers.get("x-gelbien") !== "1") return Response.json({ error: "Bad request" }, { status: 400 });
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
    if (file.size > MAX_BYTES) return Response.json({ error: "File too large" }, { status: 413 });
    if (!ALLOWED.test(file.type)) return Response.json({ error: "Unsupported file type" }, { status: 415 });

    const bytes = new Uint8Array(await file.arrayBuffer());
    const name = String(form.get("name") || file.name || "receipt").slice(0, 120);
    const result = await withGoogle("en", ({ accessToken }) => uploadReceipt(accessToken, { name, type: file.type, bytes }));
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
