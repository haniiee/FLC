"use client";

import type { AdminUser } from "@app/shared-types";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { InitialPasswordModal } from "../../../components/admin/InitialPasswordModal";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Spinner } from "../../../components/ui/Spinner";
import { getApiClient } from "../../../lib/api";
import { apiErrorMessage } from "../../../lib/format";

function platformBadge(role: AdminUser["platformRole"]) {
  const styles =
    role === "admin"
      ? "bg-secondary text-white"
      : role === "teacher"
        ? "bg-primary/15 text-primary"
        : "bg-surface text-text-muted border border-border";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles}`}
    >
      {role}
    </span>
  );
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <Input
            placeholder="Search users…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          Create user
        </Button>
      </div>

      {usersQuery.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No users found" description="Create a user or refine your search." />
      ) : (
        <div className="space-y-2">
          {items.map((user) => (
            <Card key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-text">{user.displayName}</span>
                  {platformBadge(user.platformRole)}
                  {user.mustChangePassword ? (
                    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      Must change password
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-text-muted" dir="ltr">
                  {user.phone}
                </p>
                <p className="text-xs text-text-muted">
                  {user.groupCount} {user.groupCount === 1 ? "class" : "classes"}
                  {user.roles.length > 0 ? ` · roles: ${user.roles.join(", ")}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="px-3 py-1.5 text-xs"
                onClick={() => void onReset(user)}
              >
                Reset password
              </Button>
            </Card>
          ))}
        </div>
      )}

      {usersQuery.hasNextPage ? (
        <Button
          type="button"
          variant="ghost"
          className="w-full"
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
