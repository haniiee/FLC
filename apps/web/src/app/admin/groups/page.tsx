"use client";

import type { AdminUser } from "@app/shared-types";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Input } from "../../../components/ui/Input";
import { Modal } from "../../../components/ui/Modal";
import { Spinner } from "../../../components/ui/Spinner";
import { getApiClient } from "../../../lib/api";
import { apiErrorMessage } from "../../../lib/format";

export default function AdminGroupsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [teacherQuery, setTeacherQuery] = useState("");
  const [debouncedTeacherQuery, setDebouncedTeacherQuery] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTeacherQuery(teacherQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [teacherQuery]);

  const groupsQuery = useQuery({
    queryKey: ["admin", "groups", debouncedQ],
    queryFn: () => getApiClient().admin.groups.list({ q: debouncedQ || undefined }),
  });

  const teachersQuery = useQuery({
    queryKey: ["admin", "users", "teacher-pick", debouncedTeacherQuery],
    queryFn: () => getApiClient().admin.users.list({ q: debouncedTeacherQuery || undefined }),
    enabled: createOpen,
  });

  async function onCreate() {
    if (!name.trim() || !selectedTeacher) {
      toast.error("Class name and teacher are required");
      return;
    }
    setCreating(true);
    try {
      const group = await getApiClient().admin.groups.create({
        name: name.trim(),
        teacherUserId: selectedTeacher.id,
      });
      toast.success("Class created");
      setCreateOpen(false);
      setName("");
      setSelectedTeacher(null);
      setTeacherQuery("");
      await groupsQuery.refetch();
      router.push(`/admin/groups/${group.id}`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not create class"));
    } finally {
      setCreating(false);
    }
  }

  const items = groupsQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[220px] flex-1">
          <Input
            placeholder="Search classes…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          Create class
        </Button>
      </div>

      {groupsQuery.isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No classes found" description="Create a class and assign a teacher." />
      ) : (
        <div className="space-y-3">
          {items.map((group) => (
            <Link key={group.id} href={`/admin/groups/${group.id}`} className="block">
              <Card className="transition hover:border-secondary/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-text">{group.name}</h2>
                    <p className="mt-1 text-sm text-text-muted">
                      Teacher: {group.teacher.displayName} ·{" "}
                      <span dir="ltr">{group.teacher.phone}</span>
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {group.assistantCount} assistants · {group.studentCount} students
                    </p>
                  </div>
                  <span className="text-secondary">→</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create class" wide>
        <div className="space-y-3">
          <Input
            label="Class name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <Input
            label="Search teacher"
            placeholder="Phone or name…"
            value={teacherQuery}
            onChange={(event) => setTeacherQuery(event.target.value)}
          />
          {selectedTeacher ? (
            <div className="rounded-lg border border-secondary/30 bg-surface px-3 py-2 text-sm">
              Selected: <strong>{selectedTeacher.displayName}</strong>{" "}
              <span className="text-text-muted" dir="ltr">
                ({selectedTeacher.phone})
              </span>
              <button
                type="button"
                className="ml-2 text-xs text-secondary underline"
                onClick={() => setSelectedTeacher(null)}
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {teachersQuery.isLoading ? (
                <p className="p-2 text-sm text-text-muted">Searching…</p>
              ) : (teachersQuery.data?.items ?? []).length === 0 ? (
                <p className="p-2 text-sm text-text-muted">No users found</p>
              ) : (
                (teachersQuery.data?.items ?? []).map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-surface"
                    onClick={() => setSelectedTeacher(user)}
                  >
                    <span>
                      {user.displayName}
                      <span className="ml-2 text-text-muted" dir="ltr">
                        {user.phone}
                      </span>
                    </span>
                    <span className="text-xs uppercase text-text-muted">{user.platformRole}</span>
                  </button>
                ))
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={creating} onClick={() => void onCreate()}>
              {creating ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
