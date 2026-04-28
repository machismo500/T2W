/**
 * Vercel Blob upload helper.
 *
 * Used by /api/upload (live uploads from the browser) and by the one-shot
 * migration script in scripts/migrate-images-to-blob.ts. Both call paths
 * funnel through `uploadImage` so MIME-handling, filename generation, and
 * size validation stay in one place.
 *
 * Replaces the old "store base64 in Postgres" path that crashed iOS WebKit.
 */

import { put } from "@vercel/blob";

// Vercel Blob stores are created as either "public" or "private" and cannot
// change after creation. The SDK requires `access` on every put() to match
// the store's mode — passing "public" to a private store (or vice versa)
// fails with "Cannot use <X> access on a <Y> store".
//
// We read the mode from BLOB_ACCESS so a single deployment can target either
// store type without a code change. Default is "public" because that's what
// the app's image flow assumes (URLs are rendered directly in <img src>).
// If you set this to "private", you must also add a server route that
// streams blobs via get() — private URLs require an auth token and won't
// load in the browser directly.
const BLOB_ACCESS: "public" | "private" =
  process.env.BLOB_ACCESS === "private" ? "private" : "public";

// Map a MIME type to a file extension. Limited to image types we accept.
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/heic": "heic",
};

export interface UploadImageOptions {
  /** Logical bucket — used as the top-level folder in Blob (avatar, poster, …) */
  type: string;
  /** Optional second folder, typically the owning entity ID (riderId, rideId, …) */
  scope?: string;
  /** Optional content-type override; defaults to detected MIME */
  contentType?: string;
}

export interface UploadImageResult {
  url: string;
  pathname: string;
  contentType: string;
}

/**
 * Decode a `data:` URL into raw bytes + MIME type.
 * Throws if the input isn't a well-formed image data URL.
 */
export function decodeDataUrl(dataUrl: string): { bytes: Buffer; mime: string } {
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("Not an image data URL");
  }
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Malformed data URL");
  const header = dataUrl.slice(5, comma); // strip "data:" prefix
  const isBase64 = header.endsWith(";base64");
  const mime = isBase64 ? header.slice(0, -7) : header;
  const payload = dataUrl.slice(comma + 1);
  const bytes = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf-8");
  return { bytes, mime };
}

/**
 * Upload an image to Vercel Blob and return its public URL.
 *
 * Accepts either a Web `File` (from a multipart form) or a `data:` URL string
 * (when the browser pre-compressed via canvas). Routes both through `put()`
 * with `addRandomSuffix: true` so concurrent uploads to the same logical
 * pathname never collide.
 */
export async function uploadImage(
  input: File | string,
  options: UploadImageOptions
): Promise<UploadImageResult> {
  let bytes: Buffer;
  let mime: string;

  if (typeof input === "string") {
    ({ bytes, mime } = decodeDataUrl(input));
  } else {
    const arrayBuf = await input.arrayBuffer();
    bytes = Buffer.from(arrayBuf);
    mime = input.type || "application/octet-stream";
  }

  const ext = MIME_EXT[mime] || "bin";
  const filename = options.scope
    ? `${options.type}/${options.scope}/${ext}`
    : `${options.type}/${ext}`;

  const result = await put(filename, bytes, {
    access: BLOB_ACCESS,
    contentType: options.contentType ?? mime,
    addRandomSuffix: true,
  });

  return {
    url: result.url,
    pathname: result.pathname,
    contentType: options.contentType ?? mime,
  };
}
