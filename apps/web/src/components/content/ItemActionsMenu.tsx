"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiErrorMessage } from "../../lib/format";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Sheet } from "../ui/Sheet";

export function ItemActionsMenu({
  title,
  onRename,
  onDelete,
}: {
  title: string | null;
  onRename: (title: string | null) => Promise<void>;
  onDelete: () => Promise<void>;
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
        aria-label="منوی بیشتر"
        onClick={() => setMenuOpen(true)}
      >
        ⋯
      </Button>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="عملیات">
        <div className="space-y-2">
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
            تغییر نام
          </Button>
          <Button
            type="button"
            variant="danger"
            className="w-full"
            onClick={() => {
              setMenuOpen(false);
              setConfirmOpen(true);
            }}
          >
            حذف
          </Button>
        </div>
      </Sheet>

      <Sheet open={renameOpen} onClose={() => setRenameOpen(false)} title="تغییر نام">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              setBusy(true);
              try {
                const next = value.trim();
                await onRename(next.length === 0 ? null : next);
                toast.success("نام به‌روزرسانی شد");
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
            label="نام (خالی = اسم خودکار)"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            ذخیره
          </Button>
        </form>
      </Sheet>

      <Sheet open={confirmOpen} onClose={() => setConfirmOpen(false)} title="حذف؟">
        <p className="mb-4 text-sm text-text-muted">این مورد حذف می‌شود و قابل بازگشت نیست.</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={() => setConfirmOpen(false)}
          >
            انصراف
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
                  toast.success("حذف شد");
                  setConfirmOpen(false);
                } catch (error) {
                  toast.error(apiErrorMessage(error));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            حذف
          </Button>
        </div>
      </Sheet>
    </>
  );
}
