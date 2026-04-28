import { promises as fs } from "node:fs";
import path from "node:path";
import type { ImageInput } from "./types";

/**
 * Gemini API inlineData payload formatı.
 */
export type InlineImageData = {
  mimeType: string;
  /** base64 encoded image bytes */
  data: string;
};

/**
 * Maksimum görsel boyutu — Gemini API toplam request 20MB; metin/header marjı için 18MB.
 * Aşılırsa fail-fast (sessiz crop yok).
 */
const MAX_IMAGE_BYTES = 18 * 1024 * 1024;

/**
 * MIME type fallback — header yoksa veya local file uzantısı bilinmiyorsa.
 */
const DEFAULT_MIME = "image/png";

const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_TO_MIME[ext] ?? DEFAULT_MIME;
}

/**
 * Görseli Gemini'ye gönderilebilir inlineData formatına çevirir.
 *
 * Tek code path: hem local-path hem remote-url buradan geçer.
 *
 * Sessiz fallback YASAK:
 * - Local file okunamazsa ⇒ throw (fs hatası propagate)
 * - Remote fetch HTTP non-2xx ⇒ throw
 * - Remote response content-type VAR ve "image/" ile başlamıyorsa ⇒ throw
 *   (HTML/JSON/error page koruma — kullanıcı talebi)
 * - Boyut MAX_IMAGE_BYTES aşarsa ⇒ throw
 */
export async function imageToInlineData(input: ImageInput): Promise<InlineImageData> {
  if (input.kind === "local-path") {
    const buffer = await fs.readFile(input.filePath);
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(
        `image too large: ${buffer.byteLength} bytes (max ${MAX_IMAGE_BYTES})`,
      );
    }
    return {
      mimeType: mimeFromPath(input.filePath),
      data: buffer.toString("base64"),
    };
  }

  // remote-url
  const res = await fetch(input.url);
  if (!res.ok) {
    throw new Error(`image fetch failed: ${res.status} ${res.statusText} (${input.url})`);
  }

  // Content-type guard (kullanıcı talebi):
  // header VARSA ve "image/" ile başlamıyorsa throw.
  // Header yoksa fallback'e izin ver.
  const contentType = res.headers.get("content-type");
  if (contentType && !contentType.toLowerCase().startsWith("image/")) {
    throw new Error(`non-image content-type: "${contentType}" (${input.url})`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(
      `image too large: ${buffer.byteLength} bytes (max ${MAX_IMAGE_BYTES})`,
    );
  }

  // Header'dan mime al; yoksa default.
  // "image/png; charset=..." → "image/png" (parameter strip).
  const mimeType = contentType?.toLowerCase().startsWith("image/")
    ? contentType.split(";")[0]!.trim()
    : DEFAULT_MIME;

  return { mimeType, data: buffer.toString("base64") };
}
