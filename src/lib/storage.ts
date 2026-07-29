import { env, isConfigured } from "@/lib/env";
import { put, del } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export type UploadResult = { url: string; pathname: string };

/**
 * Uploads a file (COA PDF, payment receipt, invoice) to Vercel Blob when a token
 * is present; otherwise falls back to writing under /public/uploads for local dev.
 * The local fallback does NOT persist on Vercel — serverless functions get a
 * fresh, ephemeral filesystem per invocation — so BLOB_READ_WRITE_TOKEN must be
 * set in every deployed environment.
 */
export async function uploadFile(
  file: File | Buffer,
  filename: string,
  folder = "misc"
): Promise<UploadResult> {
  const safeName = `${folder}/${Date.now()}-${filename.replace(/[^\w.-]+/g, "_")}`;

  if (isConfigured.blob()) {
    const blob = await put(safeName, file, {
      access: "public",
      ...(env.blob.storeId ? { storeId: env.blob.storeId } : { token: env.blob.token }),
    });
    return { url: blob.url, pathname: blob.pathname };
  }

  // --- Local dev fallback ---
  const buffer =
    file instanceof Buffer
      ? file
      : Buffer.from(await (file as File).arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  const abs = path.join(dir, path.basename(safeName));
  await writeFile(abs, buffer);
  return { url: `/uploads/${folder}/${path.basename(safeName)}`, pathname: safeName };
}

/**
 * Deletes a file from Vercel Blob when configured; otherwise removes the local
 * fallback from /public/uploads. Fails silently if the file is already gone.
 */
export async function deleteFile(url: string, pathname?: string): Promise<void> {
  if (!isConfigured.blob()) {
    const localPath = path.join(process.cwd(), "public", url.replace(/^\//, ""));
    try {
      await import("fs/promises").then((fs) => fs.unlink(localPath));
    } catch {
      // File may not exist locally; ignore.
    }
    return;
  }

  try {
    await del(url, {
      ...(env.blob.storeId ? { storeId: env.blob.storeId } : { token: env.blob.token }),
    });
  } catch (err) {
    // Blob may already be deleted or URL may be malformed; log but don't throw
    // so DB cleanup can proceed.
    console.warn("[storage] deleteFile blob removal failed:", err instanceof Error ? err.message : err);
  }
}
