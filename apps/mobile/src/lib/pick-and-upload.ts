import type { FileDto } from "@app/shared-types";
import {
  pickAndUploadFile as pickAndUpload,
  UploadCanceledError,
  uploadLocalFile,
} from "./upload-local-file";

export { UploadCanceledError, uploadLocalFile };

export async function pickAndUploadFile(input: {
  sessionId: string;
  topicId?: string;
  onProgress?: (progress: number) => void;
}): Promise<FileDto | null> {
  try {
    return await pickAndUpload(
      { sessionId: input.sessionId, topicId: input.topicId },
      input.onProgress,
    );
  } catch (error) {
    if (error instanceof UploadCanceledError) {
      return null;
    }
    throw error;
  }
}
