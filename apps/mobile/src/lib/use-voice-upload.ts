import { useCallback, useEffect, useRef, useState } from "react";
import { nextVoiceTitle } from "./record-logic";
import {
  deleteLocalCapture,
  uploadVoiceCapture,
  type PendingVoiceUpload,
  type VoiceCapture,
} from "./upload-voice";

export function useVoiceUpload(input: {
  sessionId: string | undefined;
  topicId?: string;
  /** Current container files — used for predicted title + clear-after-match. */
  files: ReadonlyArray<{
    id: string;
    kind: string;
    status?: string;
    number?: number | null;
    displayName?: string | null;
  }>;
  onUploaded: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState<PendingVoiceUpload | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const onUploadedRef = useRef(input.onUploaded);
  onUploadedRef.current = input.onUploaded;
  const filesRef = useRef(input.files);
  filesRef.current = input.files;

  // Drop optimistic row only once the completed file is present in refetch data.
  useEffect(() => {
    const uploadedId = pending?.uploadedFileId;
    if (!uploadedId || pending.status === "failed") return;
    if (input.files.some((f) => f.id === uploadedId)) {
      setPending(null);
    }
  }, [input.files, pending?.uploadedFileId, pending?.status]);

  const runUpload = useCallback(
    async (capture: VoiceCapture) => {
      if (!input.sessionId) return;
      const title = nextVoiceTitle(filesRef.current);
      setPending({
        title,
        progress: 0,
        status: "uploading",
        capture,
      });
      try {
        // Brief pause so the optimistic bottom row can paint before the PUT starts.
        await new Promise((resolve) => setTimeout(resolve, 450));
        const file = await uploadVoiceCapture({
          sessionId: input.sessionId,
          topicId: input.topicId,
          capture,
          onProgress: (progress) => {
            setPending((prev) =>
              prev && prev.capture.uri === capture.uri
                ? { ...prev, progress, status: "uploading" }
                : prev,
            );
          },
        });
        await deleteLocalCapture(capture.uri);
        setPending((prev) =>
          prev && prev.capture.uri === capture.uri
            ? {
                ...prev,
                title: file.displayName || prev.title,
                progress: 1,
                status: "uploading",
                uploadedFileId: file.id,
              }
            : prev,
        );
        await onUploadedRef.current();
      } catch {
        setPending((prev) =>
          prev && prev.capture.uri === capture.uri
            ? { ...prev, progress: 0, status: "failed" }
            : prev,
        );
      }
    },
    [input.sessionId, input.topicId],
  );

  const retry = useCallback(() => {
    const current = pendingRef.current;
    if (!current || current.status !== "failed") return;
    void runUpload(current.capture);
  }, [runUpload]);

  return { pending, upload: runUpload, retry };
}
