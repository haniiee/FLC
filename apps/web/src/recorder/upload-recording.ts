import type { FileDto } from "@app/shared-types";
import { getApiClient } from "../lib/api";
import { baseMimeType } from "./pick-mime";

function putWithProgress(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(blob);
  });
}

export type UploadRecordingInput = {
  sessionId: string;
  topicId?: string;
  blob: Blob;
  /** Full mime including codecs for upload-url */
  mimeType: string;
  onProgress?: (progress: number) => void;
};

export async function uploadRecording(input: UploadRecordingInput): Promise<FileDto> {
  const fullMime = input.mimeType;
  const putMime = baseMimeType(fullMime);
  const ext =
    putMime.includes("mp4") || putMime.includes("aac") ? "m4a" : putMime.split("/")[1] || "webm";
  const client = getApiClient();

  const prepared = await client.createUploadUrl({
    sessionId: input.sessionId,
    topicId: input.topicId,
    mimeType: fullMime,
    sizeBytes: input.blob.size,
    fileName: `recording.${ext}`,
    source: "recording",
  });

  await putWithProgress(prepared.uploadUrl, input.blob, putMime, input.onProgress);
  return client.completeFile(prepared.file.id, {});
}
