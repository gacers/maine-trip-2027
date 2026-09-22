import { randomUUID } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const FETCH_TIMEOUT_MS = 20_000;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export interface IngestResult {
  publicUrl: string;
  key: string;
}

function envConfig() {
  const bucket = process.env.S3_BUCKET?.trim() || "";
  const endpoint = process.env.S3_ENDPOINT?.trim() || "";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim() || "";
  const publicBaseUrl = (process.env.S3_PUBLIC_BASE_URL?.trim() || "").replace(/\/$/, "");
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    return null;
  }
  return { bucket, endpoint, accessKeyId, secretAccessKey, publicBaseUrl };
}

/** True when poster storage is configured (R2 / S3-compatible). */
export function isMediaStoreConfigured(): boolean {
  return envConfig() != null;
}

export function isOwnedPosterUrl(url: string | null | undefined): boolean {
  const cfg = envConfig();
  if (!cfg || !url) return false;
  return url === cfg.publicBaseUrl || url.startsWith(`${cfg.publicBaseUrl}/`);
}

function getClient(cfg: NonNullable<ReturnType<typeof envConfig>>): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
}

function normalizeContentType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const type = raw.split(";")[0].trim().toLowerCase();
  if (ALLOWED_TYPES.has(type)) return type;
  // Some CDNs say image/jpg
  if (type === "image/jpg") return "image/jpeg";
  return null;
}

function guessTypeFromUrl(url: string): string | null {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
    if (path.endsWith(".png")) return "image/png";
    if (path.endsWith(".webp")) return "image/webp";
    if (path.endsWith(".gif")) return "image/gif";
  } catch {
    /* ignore */
  }
  return null;
}

function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  return null;
}

function objectKey(contentType: string): string {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const ext = EXT_BY_TYPE[contentType] || "bin";
  return `posters/${yyyy}/${mm}/${randomUUID()}.${ext}`;
}

async function putImage(bytes: Buffer, contentType: string): Promise<IngestResult> {
  const cfg = envConfig();
  if (!cfg) throw new Error("Poster storage is not configured (S3_* env vars)");

  const key = objectKey(contentType);
  const client = getClient(cfg);
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );
  return { publicUrl: `${cfg.publicBaseUrl}/${key}`, key };
}

/**
 * Download a remote image and store it in R2. Rejects non-images and
 * oversized payloads. Caller should catch and fall back to the original
 * URL when ingest fails (hotlink better than dropping the photo).
 */
export async function ingestRemoteImage(sourceUrl: string): Promise<IngestResult> {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error("Invalid image URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Image URL must be http(s)");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Some CDNs refuse bare bots; a browser-ish UA helps without
        // pretending to be a full scrape session.
        "User-Agent": "CountryGothTravelPosterBot/1.0",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);

  const len = Number(res.headers.get("content-length") || 0);
  if (len > MAX_BYTES) throw new Error("Image is too large (max 8MB)");

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error("Empty image response");
  if (buf.length > MAX_BYTES) throw new Error("Image is too large (max 8MB)");

  const sniffed = sniffImageType(buf);
  const headerType = normalizeContentType(res.headers.get("content-type"));
  const guessed = guessTypeFromUrl(sourceUrl);
  const contentType = sniffed || headerType || guessed;
  if (!contentType || !ALLOWED_TYPES.has(contentType)) {
    throw new Error("URL did not resolve to a supported image (jpeg/png/webp/gif)");
  }

  return putImage(buf, contentType);
}

/** Store an already-uploaded image body in R2. */
export async function ingestUpload(bytes: Buffer, contentTypeRaw: string): Promise<IngestResult> {
  if (bytes.length === 0) throw new Error("Empty upload");
  if (bytes.length > MAX_BYTES) throw new Error("Image is too large (max 8MB)");

  const sniffed = sniffImageType(bytes);
  const headerType = normalizeContentType(contentTypeRaw);
  const contentType = sniffed || headerType;
  if (!contentType || !ALLOWED_TYPES.has(contentType)) {
    throw new Error("Unsupported image type (jpeg/png/webp/gif only)");
  }

  return putImage(bytes, contentType);
}

/**
 * On save: if posterImage is an external URL, copy it into R2 and return
 * the public URL. Already-owned URLs and blank values pass through.
 * Ingest failures keep the original URL (fragile hotlink > lost photo).
 * When S3_* isn't configured, returns the input unchanged.
 */
export async function ensureOwnedPosterImage(
  posterImage: string | null | undefined
): Promise<string | null> {
  const raw = typeof posterImage === "string" ? posterImage.trim() : "";
  if (!raw) return null;
  if (!isMediaStoreConfigured()) return raw;
  if (isOwnedPosterUrl(raw)) return raw;

  try {
    const { publicUrl } = await ingestRemoteImage(raw);
    return publicUrl;
  } catch (err) {
    console.error("ensureOwnedPosterImage failed; keeping original URL:", err);
    return raw;
  }
}
