"use client";

import type { ReceiptInput } from "./ai/client";

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const IMAGE_RE = /^image\/(jpeg|png|webp|gif|heic|heif)$/;

export function isReceiptFile(file: File | Blob): boolean {
  return IMAGE_RE.test(file.type) || file.type === "application/pdf";
}

export interface PreparedReceipt {
  blob: Blob;
  name: string;
  ai: ReceiptInput;
  previewUrl: string | null;
  isPdf: boolean;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(binary);
}

/** Downscale to <= maxDim and re-encode as JPEG — smaller uploads, fewer AI tokens, and HEIC → JPEG where the browser can decode it. */
async function compressImage(file: Blob, maxDim = 1600, quality = 0.85): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  } catch {
    return null;
  }
}

export async function prepareReceipt(file: File): Promise<PreparedReceipt> {
  if (file.size > MAX_RECEIPT_BYTES) throw new Error("tooBig");
  if (!isReceiptFile(file)) throw new Error("badType");
  const base = (file.name || "receipt").replace(/\.[^.]+$/, "");
  const stamp = new Date().toISOString().slice(0, 10);

  if (file.type === "application/pdf") {
    return {
      blob: file,
      name: `${stamp} ${base}.pdf`,
      ai: { base64: await blobToBase64(file), mediaType: "application/pdf" },
      previewUrl: null,
      isPdf: true,
    };
  }

  const compressed = await compressImage(file);
  if (!compressed) {
    // Couldn't decode (e.g. HEIC in Chrome) — only formats the AI accepts natively can pass through.
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) throw new Error("badType");
    return {
      blob: file,
      name: `${stamp} ${file.name || "receipt"}`,
      ai: { base64: await blobToBase64(file), mediaType: file.type as ReceiptInput["mediaType"] },
      previewUrl: URL.createObjectURL(file),
      isPdf: false,
    };
  }
  return {
    blob: compressed,
    name: `${stamp} ${base}.jpg`,
    ai: { base64: await blobToBase64(compressed), mediaType: "image/jpeg" },
    previewUrl: URL.createObjectURL(compressed),
    isPdf: false,
  };
}

/** First receipt-like file in a clipboard or drag event. */
export function receiptFromTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null;
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === "file") {
      const f = item.getAsFile();
      if (f && isReceiptFile(f)) return f;
    }
  }
  for (const f of Array.from(dt.files ?? [])) if (isReceiptFile(f)) return f;
  return null;
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
