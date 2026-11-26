import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
  type ObjectIdentifier,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { FileKind } from "@app/shared-types";
import { env } from "./env";
import { badRequest, payloadTooLarge } from "./lib/errors";
import {
  createSupabaseDownloadUrl,
  createSupabaseUploadUrl,
  supabaseDeleteKeys,
  supabaseDownloadObjectStream,
  supabaseHeadObject,
  supabasePutObjectFromFile,
} from "./storage-supabase";

function createS3Client(endpoint: string) {
  return new S3Client({
    endpoint,
    region: env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY!,
      secretAccessKey: env.S3_SECRET_KEY!,
    },
  });
}

const usingSupabase = env.STORAGE_DRIVER === "supabase";

/** Internal client for Head/Delete (docker network / server-side). */
export const s3 = usingSupabase ? null : createS3Client(env.S3_ENDPOINT!);

/** Public client used only for presigned URLs (browser/mobile reachable). */
export const s3Public = usingSupabase ? null : createS3Client(env.S3_PUBLIC_ENDPOINT!);

export async function checkStorage(): Promise<"ok" | "down"> {
  try {
    if (usingSupabase) {
      const res = await fetch(`${env.SUPABASE_URL!.replace(/\/$/, "")}/storage/v1/bucket/${env.S3_BUCKET}`, {
        headers: {
          Authorization: `Bearer ${env.SUPABASE_ANON_KEY!}`,
          apikey: env.SUPABASE_ANON_KEY!,
        },
      });
      return res.ok ? "ok" : "down";
    }
    await s3!.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    return "ok";
  } catch {
    return "down";
  }
}

const AUDIO_MIMES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/webm",
  "audio/ogg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
]);

const RECORDING_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/aac",
  "audio/mpeg",
]);

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

const SIZE_LIMITS: Record<Exclude<FileKind, "text">, number> = {
  audio: 50 * 1024 * 1024,
  pdf: 50 * 1024 * 1024,
  image: 15 * 1024 * 1024,
  video: 500 * 1024 * 1024,
};

/** Strip parameters like `;codecs=opus` from Content-Type. */
export function baseMime(mimeType: string): string {
  return mimeType.split(";")[0]!.trim().toLowerCase();
}

export function mimeToKind(
  mimeType: string,
  source: "upload" | "recording" = "upload",
): Exclude<FileKind, "text"> {
  const mime = baseMime(mimeType);
  if (source === "recording") {
    if (RECORDING_AUDIO_MIMES.has(mime)) {
      return "audio";
    }
    throw badRequest("INVALID_MIME", "نوع فایل ضبط مجاز نیست");
  }
  if (AUDIO_MIMES.has(mime)) {
    return "audio";
  }
  if (mime === "application/pdf") {
    return "pdf";
  }
  if (IMAGE_MIMES.has(mime)) {
    return "image";
  }
  if (VIDEO_MIMES.has(mime)) {
    return "video";
  }
  throw badRequest("INVALID_MIME", "نوع فایل مجاز نیست");
}

export function assertSizeAllowed(kind: Exclude<FileKind, "text">, sizeBytes: number): void {
  const limit = SIZE_LIMITS[kind];
  if (sizeBytes > limit) {
    throw payloadTooLarge("FILE_TOO_LARGE", `حجم فایل بیش از حد مجاز است (${limit} بایت)`);
  }
  if (sizeBytes <= 0) {
    throw badRequest("INVALID_SIZE", "حجم فایل نامعتبر است");
  }
}

export function extensionForMime(mimeType: string, kind: FileKind): string {
  const mime = baseMime(mimeType);
  const map: Record<string, string> = {
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/x-m4a": "m4a",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "text/plain": "txt",
  };
  return map[mime] ?? (kind === "text" ? "txt" : "bin");
}

export function buildStorageKey(groupId: string, fileId: string, ext: string): string {
  return `groups/${groupId}/files/${fileId}/original.${ext}`;
}

export const CHAT_VOICE_MAX_BYTES = 20 * 1024 * 1024;

export function buildChatVoiceStorageKey(
  groupId: string,
  channelId: string,
  messageId: string,
  ext: string,
): string {
  return `groups/${groupId}/chats/${channelId}/${messageId}/original.${ext}`;
}

/** Chat voice notes: recording mimes only, max 20MB. */
export function assertChatVoiceAllowed(mimeType: string, sizeBytes: number): void {
  mimeToKind(mimeType, "recording");
  if (sizeBytes <= 0) {
    throw badRequest("INVALID_SIZE", "حجم فایل نامعتبر است");
  }
  if (sizeBytes > CHAT_VOICE_MAX_BYTES) {
    throw payloadTooLarge(
      "FILE_TOO_LARGE",
      `حجم فایل بیش از حد مجاز است (${CHAT_VOICE_MAX_BYTES} بایت)`,
    );
  }
}

export async function createUploadUrl(key: string, mimeType: string, expiresIn = 900) {
  if (usingSupabase) {
    return createSupabaseUploadUrl(key, mimeType, expiresIn);
  }
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: mimeType,
  });
  return getSignedUrl(s3Public!, command, { expiresIn });
}

export async function createDownloadUrl(
  key: string,
  options?: { expiresIn?: number; fileName?: string; download?: boolean },
) {
  if (usingSupabase) {
    return createSupabaseDownloadUrl(key, options);
  }
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ...(options?.download && options.fileName
      ? {
          ResponseContentDisposition: `attachment; filename="${options.fileName.replace(/"/g, "")}"`,
        }
      : {}),
  });
  return getSignedUrl(s3Public!, command, { expiresIn: options?.expiresIn ?? 3600 });
}

/** Presigned URL used by session playlists and personal playlists. */
export function createPlaylistFileUrl(storageKey: string) {
  return createDownloadUrl(storageKey, { expiresIn: 3600 });
}

export async function headObject(key: string) {
  if (usingSupabase) {
    return supabaseHeadObject(key);
  }
  return s3!.send(
    new HeadObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }),
  );
}

export async function downloadObjectStream(key: string) {
  if (usingSupabase) {
    return supabaseDownloadObjectStream(key);
  }
  const result = await s3!.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }),
  );
  return result.Body ?? null;
}

export async function putObjectFromFile(key: string, filePath: string, contentType: string) {
  if (usingSupabase) {
    return supabasePutObjectFromFile(key, filePath, contentType);
  }
  const { createReadStream } = await import("node:fs");
  const { stat } = await import("node:fs/promises");
  const fileStat = await stat(filePath);
  await s3!.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: contentType,
      ContentLength: fileStat.size,
    }),
  );
}

export async function deleteStorageKeys(keys: string[]): Promise<void> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) {
    return;
  }

  if (usingSupabase) {
    try {
      await supabaseDeleteKeys(unique);
    } catch (error) {
      console.error("Failed to delete Supabase objects", error);
    }
    return;
  }

  const objects: ObjectIdentifier[] = unique.map((Key) => ({ Key }));
  try {
    await s3!.send(
      new DeleteObjectsCommand({
        Bucket: env.S3_BUCKET,
        Delete: { Objects: objects, Quiet: true },
      }),
    );
  } catch (error) {
    console.error("Failed to delete S3 objects", error);
  }
}

export async function applyBucketCors(origin = env.WEB_URL): Promise<void> {
  if (usingSupabase) {
    console.log("STORAGE_DRIVER=supabase: bucket CORS is managed by Supabase (skipped)");
    return;
  }
  try {
    await s3!.send(
      new PutBucketCorsCommand({
        Bucket: env.S3_BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedHeaders: ["*"],
              AllowedMethods: ["GET", "PUT", "HEAD"],
              AllowedOrigins: [origin],
              ExposeHeaders: ["ETag", "Content-Length"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    console.log(`CORS applied for bucket ${env.S3_BUCKET} origin=${origin}`);
  } catch (error) {
    console.error("PutBucketCors failed (ok for some MinIO setups):", error);
  }
}
