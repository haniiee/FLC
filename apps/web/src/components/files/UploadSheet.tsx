"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { getApiClient } from "../../lib/api";
import { copy } from "../../lib/copy";
import { apiErrorMessage, FILE_ACCEPT } from "../../lib/format";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

type UploadItem = {
  id: string;
  name: string;
  progress: number;
  error?: string;
};

export function UploadSheet({
  open,
  onClose,
  sessionId,
  topicId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  topicId?: string;
  onDone: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"menu" | "text" | "files">("menu");
  const [text, setText] = useState("");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [busy, setBusy] = useState(false);

  function reset() {
    setMode("menu");
    setText("");
    setItems([]);
    setBusy(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    setMode("files");
    setBusy(true);
    const files = Array.from(fileList);
    setItems(
      files.map((file, index) => ({ id: `${index}-${file.name}`, name: file.name, progress: 0 })),
    );

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]!;
      const id = `${index}-${file.name}`;
      try {
        await getApiClient().uploadFile({
          sessionId,
          topicId,
          file,
          fileName: file.name,
          mimeType: file.type || undefined,
          onProgress: (progress) => {
            setItems((current) =>
              current.map((item) => (item.id === id ? { ...item, progress } : item)),
            );
          },
        });
        setItems((current) =>
          current.map((item) => (item.id === id ? { ...item, progress: 1 } : item)),
        );
      } catch (error) {
        const message = apiErrorMessage(error, copy.content.uploadFailed);
        setItems((current) =>
          current.map((item) => (item.id === id ? { ...item, error: message } : item)),
        );
        toast.error(`${file.name}: ${message}`);
      }
    }

    setBusy(false);
    onDone();
    toast.success(copy.content.uploadComplete);
  }

  async function submitText() {
    if (!text.trim()) {
      return;
    }
    setBusy(true);
    try {
      await getApiClient().createTextFile({
        sessionId,
        topicId,
        content: text,
      });
      toast.success(copy.content.textAdded);
      onDone();
      close();
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={close} title={copy.content.addFile}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT}
        className="hidden"
        onChange={(event) => {
          void uploadFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {mode === "menu" ? (
        <div className="space-y-2">
          <Button type="button" className="w-full" onClick={() => fileInputRef.current?.click()}>
            {copy.content.upload}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => setMode("text")}
          >
            {copy.content.textFile}
          </Button>
        </div>
      ) : null}

      {mode === "text" ? (
        <div className="space-y-3">
          <textarea
            className="min-h-40 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-primary-soft"
            placeholder={copy.content.writeTextPlaceholder}
            value={text}
            onChange={(event) => setText(event.target.value)}
            dir="auto"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => setMode("menu")}
            >
              {copy.common.back}
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={busy}
              onClick={() => void submitText()}
            >
              {copy.content.save}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === "files" ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border p-3 shadow-card">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate" dir="auto">
                  {item.name}
                </span>
                <span className="text-xs text-text-muted">
                  {item.error ? copy.content.errorLabel : `${Math.round(item.progress * 100)}%`}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full ${item.error ? "bg-danger" : "bg-primary"}`}
                  style={{ width: `${Math.round(item.progress * 100)}%` }}
                />
              </div>
              {item.error ? <p className="mt-1 text-xs text-danger">{item.error}</p> : null}
            </div>
          ))}
          <Button type="button" className="w-full" disabled={busy} onClick={close}>
            {copy.common.close}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
