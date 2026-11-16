import type { ChatMessage } from "@app/shared-types";
import { getApiClient } from "../lib/api";
import { baseMimeType } from "../recorder/pick-mime";

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

export async function uploadChatVoice(input: {
  channelId: string;
  blob: Blob;
  mimeType: string;
  onProgress?: (progress: number) => void;
}): Promise<ChatMessage> {
  const client = getApiClient();
  const putMime = baseMimeType(input.mimeType);
  const prepared = await client.createChatVoiceUploadUrl(input.channelId, {
    mimeType: input.mimeType,
    sizeBytes: input.blob.size,
  });

  await putWithProgress(prepared.uploadUrl, input.blob, putMime, input.onProgress);
  return client.completeChatVoice(prepared.message.id);
}
