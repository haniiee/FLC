"use client";

import type { AdminUser } from "@app/shared-types";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { AdminToolbar } from "../../../components/admin/AdminToolbar";
import { InitialPasswordModal } from "../../../components/admin/InitialPasswordModal";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Spinner } from "../../../components/ui/Spinner";
import { getApiClient } from "../../../lib/api";
import { apiErrorMessage } from "../../../lib/format";

function platformBadge(role: AdminUser["platformRole"]) {
  const styles =
    role === "admin"
      ? "bg-primary text-white"
      : role === "teacher"
        ? "bg-secondary/12 text-secondary"
        : "bg-surface-muted text-text-muted ring-1 ring-border";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {role}
    </span>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [passwordModal, setPasswordModal] = useState<{
    phone: string;
    initialPassword: string;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  const usersQuery = useInfiniteQuery({
    queryKey: ["admin", "users", debouncedQ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getApiClient().admin.users.list({
        q: debouncedQ || undefined,
        cursor: pageParam,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = usersQuery.data?.pages.flatMap((page) => page.items) ?? [];

  async function onCreate() {
    if (!phone.trim() || !displayName.trim()) {
      toast.error("Phone and display name are required");
      return;
    }
    setCreating(true);
    try {
      const result = await getApiClient().admin.users.create({
        phone: phone.trim(),
        displayName: displayName.trim(),
        initialPassword: initialPassword.trim() || undefined,
      });
      setCreateOpen(false);
      setPhone("");
      setDisplayName("");
      setInitialPassword("");
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setPasswordModal({
        phone: result.user.phone,
        initialPassword: result.initialPassword,
      });
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not create user"));
    } finally {
      setCreating(false);
    }
  }

  async function onReset(user: AdminUser) {
    if (!window.confirm(`Reset password for ${user.displayName}?`)) return;
    try {
      const result = await getApiClient().admin.users.resetPassword(user.id);
      await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setPasswordModal({
        phone: user.phone,
        initialPassword: result.initialPassword,
      });
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not reset password"));
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="Create accounts, reset passwords, and see who belongs to which classes."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Create user
          </Button>
        }
      />

      <AdminToolbar
        search={
          <Input
            placeholder="Search by name or phone…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        }
      />

      {usersQuery.isLoading ? (
        <div className="flex min-h-[36vh] items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No users found" description="Create a user or refine your search." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-primary/8 bg-white shadow-[0_18px_50px_-36px_rgba(15,30,74,0.55)]">
          <div className="hidden grid-cols-[1fr_auto] gap-4 border-b border-border/70 bg-primary-soft/40 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted sm:grid">
            <span>Person</span>
            <span>Actions</span>
          </div>
          <ul className="divide-y divide-border/70">
            {items.map((user) => (
              <li
                key={user.id}
                className="flex flex-col gap-3 px-4 py-4 transition hover:bg-primary-soft/25 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-hero-navy text-xs font-bold text-white shadow-sm">
                    {initials(user.displayName)}
                  </span>
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-text" dir="auto">
                        {user.displayName}
                      </span>
                      {platformBadge(user.platformRole)}
                      {user.mustChangePassword ? (
                        <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200/80">
                          Must change password
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-text-muted" dir="ltr">
                      {user.phone}
                    </p>
                    <p className="text-xs text-text-muted">
                      {user.groupCount} {user.groupCount === 1 ? "class" : "classes"}
                      {user.roles.length > 0 ? ` · ${user.roles.join(", ")}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 px-3 py-2 text-xs"
                  onClick={() => void onReset(user)}
                >
                  Reset password
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {usersQuery.hasNextPage ? (
        <Button
          type="button"
          variant="ghost"
          className="mt-4 w-full"
          disabled={usersQuery.isFetchingNextPage}
          onClick={() => void usersQuery.fetchNextPage()}
        >
          {usersQuery.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      ) : null}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create user">
        <div className="space-y-3">
          <Input
            label="Phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="0912..."
          />
          <Input
            label="Display name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <Input
            label="Initial password (optional)"
            type="password"
            value={initialPassword}
            onChange={(event) => setInitialPassword(event.target.value)}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={creating} onClick={() => void onCreate()}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      <InitialPasswordModal
        open={Boolean(passwordModal)}
        onClose={() => setPasswordModal(null)}
        phone={passwordModal?.phone ?? ""}
        initialPassword={passwordModal?.initialPassword}
      />
    </div>
  );
}
