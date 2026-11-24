"use client";

import type { AdminUser } from "@app/shared-types";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { AdminToolbar } from "../../../components/admin/AdminToolbar";
import { Button } from "../../../components/ui/Button";
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
  const totals = useMemo(() => {
    return items.reduce(
      (acc, group) => {
        acc.classes += 1;
        acc.assistants += group.assistantCount;
        acc.students += group.studentCount;
        return acc;
      },
      { classes: 0, assistants: 0, students: 0 },
    );
  }, [items]);

  return (
    <div>
      <AdminPageHeader
        title="Classes"
        description="Create cohorts, assign teachers, and open a class to manage members."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Create class
          </Button>
        }
      />

      {!groupsQuery.isLoading && items.length > 0 ? (
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[
            { label: "Classes", value: totals.classes },
            { label: "Assistants", value: totals.assistants },
            { label: "Students", value: totals.students },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-primary/8 bg-white/90 px-4 py-3 shadow-[0_12px_36px_-28px_rgba(15,30,74,0.5)]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight text-primary">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <AdminToolbar
        search={
          <Input
            placeholder="Search classes…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        }
      />

      {groupsQuery.isLoading ? (
        <div className="flex min-h-[36vh] items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title="No classes found" description="Create a class and assign a teacher." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-primary/8 bg-white shadow-[0_18px_50px_-36px_rgba(15,30,74,0.5)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-primary-soft/40 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  <th className="px-5 py-2.5 font-semibold">Class</th>
                  <th className="px-5 py-2.5 font-semibold">Teacher</th>
                  <th className="px-5 py-2.5 font-semibold">Phone</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Assistants</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Students</th>
                  <th className="px-5 py-2.5 font-semibold">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {items.map((group) => (
                  <tr key={group.id} className="transition hover:bg-primary-soft/25">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/admin/groups/${group.id}`}
                        className="font-semibold text-primary hover:text-secondary"
                        dir="auto"
                      >
                        {group.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-text" dir="auto">
                      {group.teacher.displayName}
                    </td>
                    <td className="px-5 py-3.5 text-text-muted" dir="ltr">
                      {group.teacher.phone}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-text">
                      {group.assistantCount}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums text-text">
                      {group.studentCount}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/groups/${group.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-secondary transition hover:bg-secondary hover:text-white"
                        aria-label={`Open ${group.name}`}
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <div className="rounded-xl border border-secondary/25 bg-primary-soft/50 px-3 py-2.5 text-sm">
              Selected: <strong dir="auto">{selectedTeacher.displayName}</strong>{" "}
              <span className="text-text-muted" dir="ltr">
                ({selectedTeacher.phone})
              </span>
              <button
                type="button"
                className="ml-2 text-xs font-semibold text-secondary underline"
                onClick={() => setSelectedTeacher(null)}
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
              {teachersQuery.isLoading ? (
                <p className="p-2 text-sm text-text-muted">Searching…</p>
              ) : (teachersQuery.data?.items ?? []).length === 0 ? (
                <p className="p-2 text-sm text-text-muted">No users found</p>
              ) : (
                (teachersQuery.data?.items ?? []).map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-primary-soft"
                    onClick={() => setSelectedTeacher(user)}
                  >
                    <span>
                      <span dir="auto">{user.displayName}</span>
                      <span className="ml-2 text-text-muted" dir="ltr">
                        {user.phone}
                      </span>
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      {user.platformRole}
                    </span>
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
