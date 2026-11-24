"use client";

import { useEffect, useState } from "react";
import { copy } from "../../lib/copy";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

export function TextNoteSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (content: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setText("");
      setBusy(false);
    }
  }, [open]);

  async function submit() {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      await onSubmit(content);
      onClose();
    } catch {
      // The page shows the error.
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={copy.content.textFile}>
      <div className="space-y-3">
        <textarea
          className="min-h-40 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-secondary focus:ring-2 focus:ring-primary-soft"
          placeholder={copy.content.writeTextPlaceholder}
          value={text}
          onChange={(event) => setText(event.target.value)}
          dir="auto"
        />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            {copy.content.cancel}
          </Button>
          <Button
            type="button"
            className="flex-1"
            disabled={busy || !text.trim()}
            onClick={() => void submit()}
          >
            {copy.content.sendText}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
