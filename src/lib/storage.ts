import { env, isConfigured } from "@/lib/env";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export type UploadResult = { url: string; pathname: string };

/**
 * Uploads a file (COA PDF, payment receipt, invoice) to Vercel Blob when a token
 * is present; otherwise falls back to writing under /public/uploads for local dev.
 *
 * To use Vercel Blob, `npm i @vercel/blob` and set BLOB_READ_WRITE_TOKEN, then
 * uncomment the block below.
 */
export async function uploadFile(
  file: File | Buffer,
  filename: string,
  folder = "misc"
): Promise<UploadResult> {
  const safeName = `${folder}/${Date.now()}-${filename.replace(/[^\w.-]+/g, "_")}`;

  if (isConfigured.blob()) {
    // --- Vercel Blob (production) ---
    // import { put } from "@vercel/blob";
    // const blob = await put(safeName, file, {
    //   access: "public",
    //   token: env.blob.token,
    // });
    // return { url: blob.url, pathname: blob.pathname };
    // Until @vercel/blob is installed we still fall through to local so the
    // build never breaks. Swap once the package is added.
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
