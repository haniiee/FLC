import { createHmac, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import { env } from "./env";

const BUCKET = env.S3_BUCKET;

function requireSupabase() {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.API_PUBLIC_URL) {
    throw new Error(
      "STORAGE_DRIVER=supabase requires SUPABASE_URL, SUPABASE_ANON_KEY, and API_PUBLIC_URL",
    );
  }
  return {
    baseUrl: env.SUPABASE_URL.replace(/\/$/, ""),
    anonKey: env.SUPABASE_ANON_KEY,
    publicApi: env.API_PUBLIC_URL.replace(/\/$/, ""),
  };
}

function objectUrl(key: string) {
  const { baseUrl } = requireSupabase();
  return `${baseUrl}/storage/v1/object/${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const { anonKey } = requireSupabase();
  return {
    Authorization: `Bearer ${anonKey}`,
    apikey: anonKey,
    ...extra,
  };
}

type StorageTokenPayload = {
  key: string;
  mime?: string;
  fileName?: string;
  download?: boolean;
  purpose: "upload" | "download";
  exp: number;
};

function b64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64url");
}

function signPayload(payload: StorageTokenPayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", env.JWT_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyStorageToken(token: string): StorageTokenPayload {
  const [body, sig] = token.split(".");
  if (!body || !sig) {
    throw new Error("invalid token");
  }
  const expected = createHmac("sha256", env.JWT_SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("invalid token signature");
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StorageTokenPayload;
  if (!payload?.key || !payload.purpose || !payload.exp) {
    throw new Error("invalid token payload");
  }
  if (payload.exp * 1000 <= Date.now()) {
    throw new Error("token expired");
  }
  return payload;
}

export async function createSupabaseUploadUrl(key: string, mimeType: string, expiresIn = 900) {
  const { publicApi } = requireSupabase();
  const token = signPayload({
    key,
    mime: mimeType,
    purpose: "upload",
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  });
  return `${publicApi}/storage/upload/${token}`;
}

export async function createSupabaseDownloadUrl(
  key: string,
  options?: { expiresIn?: number; fileName?: string; download?: boolean },
) {
  const { publicApi } = requireSupabase();
  const token = signPayload({
    key,
    fileName: options?.fileName,
    download: options?.download,
    purpose: "download",
    exp: Math.floor(Date.now() / 1000) + (options?.expiresIn ?? 3600),
  });
  return `${publicApi}/storage/download/${token}`;
}

export async function supabaseHeadObject(key: string) {
  const res = await fetch(objectUrl(key), {
    method: "HEAD",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = new Error(`HeadObject failed (${res.status})`);
    (err as Error & { $metadata?: { httpStatusCode: number } }).$metadata = {
      httpStatusCode: res.status,
    };
    throw err;
  }
  const length = res.headers.get("content-length");
  return {
    ContentLength: length ? Number(length) : undefined,
    ContentType: res.headers.get("content-type") ?? undefined,
  };
}

export async function supabaseDownloadObjectStream(key: string) {
  const res = await fetch(objectUrl(key), {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok || !res.body) {
    return null;
  }
  return Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
}

export async function supabasePutObjectFromFile(key: string, filePath: string, contentType: string) {
  const { readFile } = await import("node:fs/promises");
  const body = await readFile(filePath);
  await supabaseUploadFromRequest(key, contentType, body);
}

export async function supabaseUploadFromRequest(key: string, mimeType: string, body: Buffer) {
  const res = await fetch(objectUrl(key), {
    method: "POST",
    headers: authHeaders({
      "Content-Type": mimeType,
      "Content-Length": String(body.byteLength),
      "x-upsert": "true",
    }),
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase upload failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function supabaseDeleteKeys(keys: string[]): Promise<void> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return;
  for (const key of unique) {
    await fetch(objectUrl(key), {
      method: "DELETE",
      headers: authHeaders(),
    }).catch(() => undefined);
  }
}

export async function supabaseFetchDownload(key: string) {
  return fetch(objectUrl(key), {
    method: "GET",
    headers: authHeaders(),
  });
}
