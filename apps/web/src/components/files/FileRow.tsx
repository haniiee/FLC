"use client";

import type { FileDto, GroupRole } from "@app/shared-types";
import { useState } from "react";
import { toast } from "sonner";
import { getApiClient } from "../../lib/api";
import { apiErrorMessage, formatBytes, formatDuration, kindLabel } from "../../lib/format";
import { usePlayer } from "../../player/context";
import { usePlayerStore } from "../../player/store";
import { ItemActionsMenu } from "../content/ItemActionsMenu";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

function KindIcon({ kind }: { kind: FileDto["kind"] }) {
  const map = {
    audio: "🎵",
    pdf: "📄",
    image: "🖼️",
    video: "🎬",
    text: "📝",
  } as const;
  return <span aria-hidden>{map[kind]}</span>;
}

export function canManageContent(role: GroupRole | undefined) {
  return role === "teacher" || role === "assistant";
}

function StatusBadge({
  status,
  canManage,
  onReprocess,
}: {
  status: FileDto["status"];
  canManage: boolean;
  onReprocess?: () => void;
}) {
  if (status === "ready") {
    return null;
  }
  if (status === "processing") {
    return (
      <span className="mt-2 inline-block rounded px-2 py-0.5 text-[11px] bg-primary-soft text-secondary">
        در حال پردازش…
      </span>
    );
  }
  if (status === "pending" && canManage) {
    return (
      <span className="mt-2 inline-block rounded px-2 py-0.5 text-[11px] bg-primary-soft text-secondary">
        در انتظار آپلود
      </span>
    );
  }
  if (status === "failed" && canManage) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="inline-block rounded bg-danger/10 px-2 py-0.5 text-[11px] text-danger">
          خطا
        </span>
        {onReprocess ? (
          <Button type="button" variant="ghost" className="px-2 py-1 text-xs" onClick={onReprocess}>
            پردازش دوباره
          </Button>
        ) : null}
      </div>
    );
  }
  return null;
}

export function OptimisticFileRow({ title, progress }: { title: string; progress: number }) {
  const pct = Math.round(progress * 100);
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-xl" aria-hidden>
          🎵
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text">{title}</p>
          <p className="mt-1 text-xs text-text-muted">
            صوت · <bdi dir="ltr">{pct}%</bdi>
          </p>
          <span className="mt-2 inline-block rounded bg-primary-soft px-2 py-0.5 text-[11px] text-secondary">
            در حال ارسال…
          </span>
        </div>
      </div>
    </div>
  );
}

export function FileRow({
  file,
  canManage,
  onChanged,
  sessionId,
}: {
  file: FileDto;
  canManage: boolean;
  onChanged: () => void;
  sessionId?: string;
}) {
  const player = usePlayer();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentFileId = usePlayerStore((s) => s.queue[s.currentIndex]?.fileId);
  const isCurrent = currentFileId === file.id;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  const playable = file.status === "ready";

  async function resolveUrl(download = false) {
    const result = await getApiClient().getFileUrl(file.id, download);
    return result.url;
  }

  async function onOpen() {
    try {
      if (!playable) {
        return;
      }
      if (file.kind === "audio") {
        if (!sessionId) {
          toast.error("شناسه جلسه برای پخش موجود نیست");
          return;
        }
        if (isCurrent) {
          player.toggle();
          return;
        }
        await player.playSession(sessionId, file.id);
        return;
      }
      if (file.kind === "image") {
        setImageUrl(await resolveUrl(false));
        return;
      }
      if (file.kind === "pdf") {
        window.open(await resolveUrl(false), "_blank", "noopener,noreferrer");
        return;
      }
      if (file.kind === "video") {
        setVideoUrl(await resolveUrl(false));
        return;
      }
      if (file.kind === "text") {
        setTextOpen(true);
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, "باز کردن فایل ناموفق بود"));
    }
  }

  async function onDownload() {
    try {
      window.open(await resolveUrl(true), "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(apiErrorMessage(error, "دانلود ناموفق بود"));
    }
  }

  async function onReprocess() {
    setReprocessing(true);
    try {
      await getApiClient().reprocessFile(file.id);
      onChanged();
    } catch (error) {
      toast.error(apiErrorMessage(error, "پردازش دوباره ناموفق بود"));
    } finally {
      setReprocessing(false);
    }
  }

  const sizePart = formatBytes(file.sizeBytes);
  const durationPart = formatDuration(file.durationMs);

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start gap-3">
        {file.kind === "audio" && playable ? (
          <button
            type="button"
            aria-label={isCurrent && isPlaying ? "توقف" : "پخش"}
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-on-primary"
            onClick={() => void onOpen()}
          >
            {isCurrent && isPlaying ? "❚❚" : "▶"}
          </button>
        ) : (
          <button
            type="button"
            className="mt-0.5 text-xl disabled:opacity-40"
            disabled={!playable && file.kind === "audio"}
            onClick={() => void onOpen()}
          >
            <KindIcon kind={file.kind} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block w-full text-right font-medium text-text disabled:opacity-60"
            disabled={!playable && file.kind === "audio"}
            onClick={() => void onOpen()}
          >
            {file.displayName}
          </button>
          <p className="mt-1 text-xs text-text-muted">
            {kindLabel(file.kind)}
            {sizePart ? (
              <>
                {" · "}
                <bdi dir="ltr">{sizePart}</bdi>
              </>
            ) : null}
            {durationPart ? (
              <>
                {" · "}
                <bdi dir="ltr">{durationPart}</bdi>
              </>
            ) : null}
          </p>
          <StatusBadge
            status={file.status}
            canManage={canManage}
            onReprocess={
              file.status === "failed" && canManage && !reprocessing
                ? () => void onReprocess()
                : undefined
            }
          />
        </div>
        <div className="flex items-center gap-1">
          {playable ? (
            <Button
              type="button"
              variant="ghost"
              className="px-2 py-1 text-xs"
              onClick={() => void onDownload()}
            >
              دانلود
            </Button>
          ) : null}
          {canManage ? (
            <ItemActionsMenu
              title={file.title}
              onRename={async (title) => {
                await getApiClient().updateFile(file.id, { title });
                onChanged();
              }}
              onDelete={async () => {
                await getApiClient().deleteFile(file.id);
                onChanged();
              }}
            />
          ) : null}
        </div>
      </div>

      <Sheet open={Boolean(imageUrl)} onClose={() => setImageUrl(null)} title={file.displayName}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={file.displayName}
            className="max-h-[70vh] w-full object-contain"
          />
        ) : null}
      </Sheet>

      <Sheet open={Boolean(videoUrl)} onClose={() => setVideoUrl(null)} title={file.displayName}>
        {videoUrl ? <video className="w-full rounded-md" controls src={videoUrl} /> : null}
      </Sheet>

      <Sheet open={textOpen} onClose={() => setTextOpen(false)} title={file.displayName}>
        <pre className="whitespace-pre-wrap rounded-md bg-surface p-3 text-sm text-text">
          {file.textContent ?? "متن در دسترس نیست"}
        </pre>
      </Sheet>
    </div>
  );
}
