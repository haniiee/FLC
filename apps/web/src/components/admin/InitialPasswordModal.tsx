"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

export function InitialPasswordModal({
  open,
  onClose,
  phone,
  initialPassword,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  phone: string;
  initialPassword?: string;
  existing?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    if (!initialPassword) return;
    try {
      await navigator.clipboard.writeText(initialPassword);
      setCopied(true);
      toast.success("Password copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy password");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? "User already existed" : "Save this password"}
    >
      <div className="space-y-4">
        {existing ? (
          <p className="text-sm text-text-muted">
            This phone number already belongs to an account. They were added to the class without
            changing their password.
          </p>
        ) : (
          <>
            <p className="text-sm text-text-muted">
              This temporary password is shown once. Copy it now — you will not see it again.
            </p>
            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Phone</p>
              <p className="mt-1 font-mono text-sm text-text" dir="ltr">
                {phone}
              </p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-text-muted">
                Initial password
              </p>
              <p
                className="mt-1 break-all font-mono text-base font-semibold text-secondary"
                dir="ltr"
              >
                {initialPassword}
              </p>
            </div>
            <Button type="button" className="w-full" onClick={() => void copyPassword()}>
              {copied ? "Copied" : "Copy password"}
            </Button>
          </>
        )}
        <Button type="button" variant="secondary" className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </Modal>
  );
}
