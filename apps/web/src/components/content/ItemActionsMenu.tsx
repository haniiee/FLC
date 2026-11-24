"use client";

import { useState } from "react";
import { toast } from "sonner";
import { copy } from "../../lib/copy";
import { apiErrorMessage } from "../../lib/format";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Sheet } from "../ui/Sheet";

export type ItemExtraAction = {
  title: string;
  onPress: () => void;
  destructive?: boolean;
};

export function ItemActionsMenu({
  title,
  onRename,
  onDelete,
  extraActions,
}: {
  title?: string | null;
  onRename?: (title: string | null) => Promise<void>;
  onDelete?: () => Promise<void>;
  extraActions?: ItemExtraAction[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [value, setValue] = useState(title ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="px-2 py-1 text-lg leading-none"
        aria-label={copy.chat.moreMenu}
        onClick={() => setMenuOpen(true)}
      >
        ⋯
      </Button>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={copy.content.actions}>
        <div className="space-y-2">
          {extraActions?.map((action) => (
            <Button
              key={action.title}
              type="button"
              variant={action.destructive ? "danger" : "secondary"}
              className="w-full"
              onClick={() => {
                setMenuOpen(false);
                action.onPress();
              }}
            >
              {action.title}
            </Button>
          ))}
          {onRename ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                setMenuOpen(false);
                setValue(title ?? "");
                setRenameOpen(true);
              }}
            >
              {copy.content.rename}
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="danger"
              className="w-full"
              onClick={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
            >
              {copy.content.delete}
            </Button>
          ) : null}
        </div>
      </Sheet>

      {onRename ? (
        <Sheet open={renameOpen} onClose={() => setRenameOpen(false)} title={copy.content.rename}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                setBusy(true);
                try {
                  const next = value.trim();
                  await onRename(next.length === 0 ? null : next);
                  toast.success(copy.content.nameUpdated);
                  setRenameOpen(false);
                } catch (error) {
                  toast.error(apiErrorMessage(error));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            <Input
              label={copy.content.renameNameHint}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {copy.content.save}
            </Button>
          </form>
        </Sheet>
      ) : null}

      {onDelete ? (
        <Sheet
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={copy.content.deleteConfirm}
        >
          <p className="mb-4 text-sm text-text-muted">{copy.content.deleteItemBody}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => setConfirmOpen(false)}
            >
              {copy.content.cancel}
            </Button>
            <Button
              type="button"
              variant="danger"
              className="flex-1"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    await onDelete();
                    toast.success(copy.content.deleted);
                    setConfirmOpen(false);
                  } catch (error) {
                    toast.error(apiErrorMessage(error));
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              {copy.content.delete}
            </Button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
