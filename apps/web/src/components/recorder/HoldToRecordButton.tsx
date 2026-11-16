"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "../../player/store";
import { useRecorder, type RecorderResult } from "../../recorder/useRecorder";

function formatTimer(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function HoldToRecordButton({
  onSend,
  fixed = true,
  className = "",
}: {
  onSend: (result: RecorderResult) => void | Promise<void>;
  /** When true, float like the session RecordButton. */
  fixed?: boolean;
  className?: string;
}) {
  const hasMiniPlayer = usePlayerStore((s) => s.hasActiveQueue);
  const recorder = useRecorder();
  const pointerIdRef = useRef<number | null>(null);
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;

  useEffect(() => {
    recorder.setOnSend(async (result: RecorderResult) => {
      await onSendRef.current(result);
    });
  }, [recorder.setOnSend]);

  const recording = recorder.gesture.ui === "recording" || recorder.gesture.ui === "cancel-armed";
  const cancelArmed = recorder.gesture.ui === "cancel-armed";
  const bottomClass = hasMiniPlayer ? "bottom-24" : "bottom-6";

  const button = (
    <button
      type="button"
      aria-label="ضبط صوت"
      className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl text-on-primary shadow-lg select-none ${
        cancelArmed ? "bg-danger" : "bg-primary"
      } ${fixed ? `fixed end-4 z-40 ${bottomClass}` : ""} ${className}`}
      style={{
        touchAction: "none",
        WebkitTouchCallout: "none",
        userSelect: "none",
      }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => {
        event.preventDefault();
        pointerIdRef.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        recorder.onPress(event.clientX);
      }}
      onPointerMove={(event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        recorder.onMove(event.clientX);
      }}
      onPointerUp={(event) => {
        if (pointerIdRef.current !== event.pointerId) return;
        pointerIdRef.current = null;
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // ignore
        }
        recorder.onRelease();
      }}
      onPointerCancel={(event) => {
        pointerIdRef.current = null;
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // ignore
        }
        recorder.onRelease();
      }}
    >
      🎤
    </button>
  );

  return (
    <>
      {recording ? (
        <div
          className={`${
            fixed
              ? `fixed inset-x-0 z-40 mx-auto flex max-w-[720px] items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-lg ${bottomClass}`
              : "mb-2 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
          }`}
          style={fixed ? { marginBottom: "4.5rem" } : undefined}
        >
          {cancelArmed ? (
            <span className="text-2xl" aria-hidden>
              🗑️
            </span>
          ) : (
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-danger" />
            </span>
          )}
          <bdi dir="ltr" className="font-mono text-sm text-secondary">
            {formatTimer(recorder.gesture.elapsedMs)}
          </bdi>
          <p className={`flex-1 text-sm ${cancelArmed ? "text-danger" : "text-secondary"}`}>
            {cancelArmed ? "رها کن برای لغو" : recorder.cancelHintText}
          </p>
        </div>
      ) : null}
      {button}
    </>
  );
}
