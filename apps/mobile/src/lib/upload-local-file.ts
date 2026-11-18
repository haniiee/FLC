import { ApiClientError } from "@app/api-client";
import type { FileDto } from "@app/shared-types";
import * as DocumentPicker from "expo-document-picker";
import { File, UploadType } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { getApiClient } from "./api";

export type UploadTarget = {
  sessionId: string;
  topicId?: string;
};

type LocalFileAsset = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
};

const PICKER_TYPES = ["audio/*", "application/pdf", "image/*", "video/*"] as const;

export class UploadCanceledError extends Error {
  constructor() {
    super("Upload canceled");
    this.name = "UploadCanceledError";
  }
}

async function resolveSizeBytes(asset: LocalFileAsset): Promise<number> {
  if (asset.size != null && asset.size > 0) {
    return asset.size;
  }
  const info = await FileSystem.getInfoAsync(asset.uri);
  if (info.exists && "size" in info && typeof info.size === "number" && info.size > 0) {
    return info.size;
  }
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  return blob.size;
}

async function putLocalFile(
  uploadUrl: string,
  uri: string,
  mimeType: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  const file = new File(uri);
  const result = await file.upload(uploadUrl, {
    httpMethod: "PUT",
    uploadType: UploadType.BINARY_CONTENT,
    headers: { "content-type": mimeType },
    mimeType,
    onProgress: onProgress
      ? ({ bytesSent, totalBytes }) => {
          if (totalBytes > 0) {
            onProgress(bytesSent / totalBytes);
          }
        }
      : undefined,
  });
  if (result.status < 200 || result.status >= 300) {
    throw new ApiClientError(result.status, "UPLOAD_FAILED", "Upload failed");
  }
}

export async function uploadLocalFile(input: {
  sessionId: string;
  topicId?: string;
  uri: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  source?: "upload" | "recording";
  durationMs?: number;
  onProgress?: (progress: number) => void;
}): Promise<FileDto> {
  const asset: LocalFileAsset = {
    name: input.fileName,
    uri: input.uri,
    mimeType: input.mimeType,
    size: input.sizeBytes != null && input.sizeBytes > 0 ? input.sizeBytes : undefined,
  };
  return uploadDocumentAsset(
    asset,
    { sessionId: input.sessionId, topicId: input.topicId },
    input.onProgress,
    { source: input.source, durationMs: input.durationMs },
  );
}

export async function uploadDocumentAsset(
  asset: LocalFileAsset,
  target: UploadTarget,
  onProgress?: (progress: number) => void,
  options?: { source?: "upload" | "recording"; durationMs?: number },
): Promise<FileDto> {
  const mimeType = asset.mimeType?.trim() || "application/octet-stream";
  const fileName = asset.name?.trim() || "upload.bin";
  const sizeBytes = await resolveSizeBytes(asset);

  const client = getApiClient();
  let preparedFileId: string | undefined;
  try {
    const prepared = await client.createUploadUrl({
      sessionId: target.sessionId,
      topicId: target.topicId,
      mimeType,
      sizeBytes,
      fileName,
      source: options?.source ?? "upload",
    });
    preparedFileId = prepared.file.id;
    await putLocalFile(prepared.uploadUrl, asset.uri, mimeType, onProgress);
    const durationMs =
      options?.durationMs != null && options.durationMs > 0 ? options.durationMs : undefined;
    return await client.completeFile(prepared.file.id, durationMs != null ? { durationMs } : {});
  } catch (error) {
    // Drop the server-side pending row so retries do not leave orphans.
    if (preparedFileId) {
      try {
        await client.deleteFile(preparedFileId);
      } catch {
        // Best-effort — list/cleanup also hide or purge pending.
      }
    }
    throw error;
  }
}

export async function pickAndUploadFile(
  target: UploadTarget,
  onProgress?: (progress: number) => void,
): Promise<FileDto> {
  const pick = await DocumentPicker.getDocumentAsync({
    type: [...PICKER_TYPES],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (pick.canceled || !pick.assets[0]) {
    throw new UploadCanceledError();
  }
  return uploadDocumentAsset(pick.assets[0], target, onProgress);
}
