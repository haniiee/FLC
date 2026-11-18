import type { FileDto } from "@app/shared-types";
import * as FileSystem from "expo-file-system/legacy";
import { uploadLocalFile } from "./upload-local-file";

export type VoiceCapture = {
  uri: string;
  durationMs: number;
  mimeType: string;
  fileName: string;
};

export type PendingVoiceUpload = {
  title: string;
  progress: number;
  status: "uploading" | "failed";
  capture: VoiceCapture;
  /** Set after complete — keep row until this id appears in the refetch. */
  uploadedFileId?: string;
};

export async function uploadVoiceCapture(input: {
  sessionId: string;
  topicId?: string;
  capture: VoiceCapture;
  onProgress?: (progress: number) => void;
}): Promise<FileDto> {
  return uploadLocalFile({
    sessionId: input.sessionId,
    topicId: input.topicId,
    uri: input.capture.uri,
    fileName: input.capture.fileName,
    mimeType: input.capture.mimeType,
    source: "recording",
    durationMs: input.capture.durationMs > 0 ? input.capture.durationMs : undefined,
    onProgress: input.onProgress,
  });
}

export async function deleteLocalCapture(uri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Best-effort cleanup of the local recording.
  }
}
