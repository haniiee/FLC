"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { copy } from "../../lib/copy";
import { apiErrorMessage } from "../../lib/format";
import { usePlayerStore } from "../../player/store";
import { uploadRecording } from "../../recorder/upload-recording";
import type { RecorderResult } from "../../recorder/useRecorder";
import { Button } from "../ui/Button";
import { HoldToRecordButton } from "./HoldToRecordButton";

export type PendingUpload = {
  id: string;
  progress: number;
  status: "uploading" | "failed";
  blob: Blob;
  mimeType: string;
  error?: string;
};

export function RecordButton({
  sessionId,
  topicId,
  pending,
  onPendingChange,
  onUploaded,
}: {
  sessionId: string;
  topicId?: string;
  pending: PendingUpload[];
  onPendingChange: (items: PendingUpload[]) => void;
  onUploaded: () => void;
}) {
  const hasMiniPlayer = usePlayerStore((s) => s.hasActiveQueue);
  const pendingRef = useRef(pending);
  const onPendingChangeRef = useRef(onPendingChange);
  const onUploadedRef = useRef(onUploaded);
  pendingRef.current = pending;
  onPendingChangeRef.current = onPendingChange;
  onUploadedRef.current = onUploaded;

  const runUpload = useCallback(
    async (item: PendingUpload) => {
      try {
        await uploadRecording({
          sessionId,
          topicId,
          blob: item.blob,
          mimeType: item.mimeType,
          onProgress: (progress) => {
            onPendingChangeRef.current(
              pendingRef.current.map((row) =>
                row.id === item.id ? { ...row, progress, status: "uploading" } : row,
              ),
            );
          },
        });
        onPendingChangeRef.current(pendingRef.current.filter((row) => row.id !== item.id));
        onUploadedRef.current();
      } catch (error) {
        onPendingChangeRef.current(
          pendingRef.current.map((row) =>
            row.id === item.id
              ? {
                  ...row,
                  status: "failed",
                  error: apiErrorMessage(error, copy.content.sendFailed),
                }
              : row,
          ),
        );
        toast.error(apiErrorMessage(error, copy.content.sendFailed));
      }
    },
    [sessionId, topicId],
  );

  const handleSend = useCallback(
    async (result: RecorderResult) => {
      const id = `local-${Date.now()}`;
      const item: PendingUpload = {
        id,
        progress: 0,
        status: "uploading",
        blob: result.blob,
        mimeType: result.mimeType,
      };
      onPendingChangeRef.current([...pendingRef.current, item]);
      await runUpload(item);
    },
    [runUpload],
  );

  const bottomClass = hasMiniPlayer ? "bottom-40 md:bottom-24" : "bottom-24 md:bottom-6";

  return (
    <>
      {pending.map((item) =>
        item.status === "failed" ? (
          <div
            key={item.id}
            className={`fixed inset-x-0 z-30 mx-auto flex max-w-[720px] items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-2 shadow-card ${bottomClass}`}
            style={{ marginBottom: "4.5rem" }}
          >
            <p className="text-sm text-danger">{copy.content.sendFailed}</p>
            <Button
              type="button"
              variant="secondary"
              className="text-xs"
              onClick={() => void runUpload(item)}
            >
              {copy.chat.tryAgain}
            </Button>
          </div>
        ) : null,
      )}

      <HoldToRecordButton onSend={handleSend} fixed />
    </>
  );
}
