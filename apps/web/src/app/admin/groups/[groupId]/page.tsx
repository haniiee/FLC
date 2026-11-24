"use client";

import type { AdminMember, AdminUser } from "@app/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { InitialPasswordModal } from "../../../../components/admin/InitialPasswordModal";
import { Button } from "../../../../components/ui/Button";
import { Input } from "../../../../components/ui/Input";
import { Modal } from "../../../../components/ui/Modal";
import { Spinner } from "../../../../components/ui/Spinner";
import { getApiClient } from "../../../../lib/api";
import { apiErrorMessage } from "../../../../lib/format";

function roleBadge(role: AdminMember["role"]) {
  const styles =
    role === "teacher"
      ? "bg-primary text-white"
      : role === "assistant"
        ? "bg-secondary/12 text-secondary"
        : "bg-surface-muted text-text-muted ring-1 ring-border";
  const label = role === "teacher" ? "Teacher" : role === "assistant" ? "Assistant" : "Student";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {label}
    </span>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export default function AdminGroupDetailPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const queryClient = useQueryClient();

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [changeTeacherOpen, setChangeTeacherOpen] = useState(false);
  const [teacherQuery, setTeacherQuery] = useState("");
  const [debouncedTeacherQuery, setDebouncedTeacherQuery] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<AdminUser | null>(null);
  const [previousTeacher, setPreviousTeacher] = useState<"assistant" | "remove">("assistant");
  const [savingTeacher, setSavingTeacher] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<"existing" | "new">("existing");
  const [memberRole, setMemberRole] = useState<"student" | "assistant">("student");
  const [userQuery, setUserQuery] = useState("");
  const [debouncedUserQuery, setDebouncedUserQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [adding, setAdding] = useState(false);

  const [passwordModal, setPasswordModal] = useState<{
    phone: string;
    initialPassword?: string;
    existing?: boolean;
  } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedTeacherQuery(teacherQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [teacherQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedUserQuery(userQuery.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [userQuery]);

  const groupsQuery = useQuery({
    queryKey: ["admin", "groups"],
    queryFn: () => getApiClient().admin.groups.list(),
  });
  const group = groupsQuery.data?.items.find((item) => item.id === groupId);

  const membersQuery = useQuery({
    queryKey: ["admin", "members", groupId],
    queryFn: () => getApiClient().admin.members.list(groupId),
    enabled: Boolean(groupId),
  });

  const teacherPickQuery = useQuery({
    queryKey: ["admin", "users", "change-teacher", debouncedTeacherQuery],
    queryFn: () => getApiClient().admin.users.list({ q: debouncedTeacherQuery || undefined }),
    enabled: changeTeacherOpen,
  });

  const userPickQuery = useQuery({
    queryKey: ["admin", "users", "add-member", debouncedUserQuery],
    queryFn: () => getApiClient().admin.users.list({ q: debouncedUserQuery || undefined }),
    enabled: addOpen && addTab === "existing",
  });

  useEffect(() => {
    if (group && !editingName) {
      setNameDraft(group.name);
    }
  }, [editingName, group]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "groups"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "members", groupId] }),
    ]);
  }

  async function saveName() {
    if (!nameDraft.trim()) return;
    setSavingName(true);
    try {
      await getApiClient().admin.groups.update(groupId, { name: nameDraft.trim() });
      toast.success("Class renamed");
      setEditingName(false);
      await refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not rename class"));
    } finally {
      setSavingName(false);
    }
  }

  async function saveTeacher() {
    if (!selectedTeacher) {
      toast.error("Select a new teacher");
      return;
    }
    setSavingTeacher(true);
    try {
      await getApiClient().admin.groups.setTeacher(groupId, {
        userId: selectedTeacher.id,
        previousTeacher,
      });
      toast.success("Teacher updated");
      setChangeTeacherOpen(false);
      setSelectedTeacher(null);
      setTeacherQuery("");
      await refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not change teacher"));
    } finally {
      setSavingTeacher(false);
    }
  }

  async function addMember() {
    setAdding(true);
    try {
      const result =
        addTab === "existing"
          ? await getApiClient().admin.members.add(groupId, {
              role: memberRole,
              userId: selectedUser!.id,
            })
          : await getApiClient().admin.members.add(groupId, {
              role: memberRole,
              newUser: {
                phone: newPhone.trim(),
                displayName: newDisplayName.trim(),
                initialPassword: newPassword.trim() || undefined,
              },
            });

      setAddOpen(false);
      setSelectedUser(null);
      setUserQuery("");
      setNewPhone("");
      setNewDisplayName("");
      setNewPassword("");
      await refresh();

      if (result.existing) {
        setPasswordModal({
          phone: result.member.phone,
          existing: true,
        });
      } else if (result.initialPassword) {
        setPasswordModal({
          phone: result.member.phone,
          initialPassword: result.initialPassword,
        });
      } else {
        toast.success("Member added");
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not add member"));
    } finally {
      setAdding(false);
    }
  }

  async function toggleRole(member: AdminMember) {
    const nextRole = member.role === "assistant" ? "student" : "assistant";
    try {
      await getApiClient().admin.members.update(groupId, member.id, { role: nextRole });
      toast.success("Role updated");
      await refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not update role"));
    }
  }

  async function removeMember(member: AdminMember) {
    if (!window.confirm(`Remove ${member.displayName} from this class?`)) return;
    try {
      await getApiClient().admin.members.remove(groupId, member.id);
      toast.success("Member removed");
      await refresh();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Could not remove member"));
    }
  }

  if (groupsQuery.isLoading || membersQuery.isLoading) {
    return (
      <div className="flex min-h-[36vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="rounded-2xl border border-primary/8 bg-white p-8 text-center shadow-[0_18px_50px_-36px_rgba(15,30,74,0.5)]">
        <h2 className="text-lg font-bold text-primary">Class not found</h2>
        <Link
          href="/admin/groups"
          className="mt-3 inline-block text-sm font-semibold text-secondary underline-offset-2 hover:underline"
        >
          Back to classes
        </Link>
      </div>
    );
  }

  const members = membersQuery.data?.members ?? [];
  const canSubmitAdd =
    addTab === "existing"
      ? Boolean(selectedUser)
      : Boolean(newPhone.trim() && newDisplayName.trim());

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/admin/groups"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary transition hover:text-primary"
        >
          <span aria-hidden>←</span> Classes
        </Link>

        <div className="mt-4 overflow-hidden rounded-2xl border border-primary/8 bg-white shadow-[0_18px_50px_-36px_rgba(15,30,74,0.5)]">
          <div className="bg-hero-navy px-5 py-6 text-white sm:px-6">
            {editingName ? (
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-[220px] flex-1 space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                    Class name
                  </span>
                  <input
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    className="w-full rounded-md border border-white/20 bg-white px-3 py-2.5 text-sm text-text outline-none focus:border-secondary-light focus:ring-2 focus:ring-secondary-light/30"
                  />
                </label>
                <Button type="button" disabled={savingName} onClick={() => void saveName()}>
                  {savingName ? "Saving…" : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  onClick={() => setEditingName(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                    Class
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold tracking-tight" dir="auto">
                    {group.name}
                  </h2>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-3 py-1.5 text-xs text-white/85 hover:bg-white/10 hover:text-white"
                  onClick={() => setEditingName(true)}
                >
                  Rename
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-hero-navy text-xs font-bold text-white">
                {initials(group.teacher.displayName)}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  Teacher
                </p>
                <p className="truncate font-semibold text-text" dir="auto">
                  {group.teacher.displayName}
                </p>
                <p className="text-sm text-text-muted" dir="ltr">
                  {group.teacher.phone}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => setChangeTeacherOpen(true)}>
              Change teacher
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-primary">Members</h3>
          <p className="text-sm text-text-muted">
            {members.length} {members.length === 1 ? "person" : "people"} in this class
          </p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          Add member
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-primary/8 bg-white shadow-[0_18px_50px_-36px_rgba(15,30,74,0.5)]">
        <ul className="divide-y divide-border/70">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-xs font-bold text-primary">
                  {initials(member.displayName)}
                </span>
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-text" dir="auto">
                      {member.displayName}
                    </span>
                    {roleBadge(member.role)}
                  </div>
                  <p className="text-sm text-text-muted" dir="ltr">
                    {member.phone}
                  </p>
                </div>
              </div>
              {member.role !== "teacher" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2.5 py-1.5 text-xs"
                    onClick={() => void toggleRole(member)}
                  >
                    Make {member.role === "assistant" ? "Student" : "Assistant"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="px-2.5 py-1.5 text-xs"
                    onClick={() => void removeMember(member)}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <Modal
        open={changeTeacherOpen}
        onClose={() => setChangeTeacherOpen(false)}
        title="Change teacher"
        wide
      >
        <div className="space-y-3">
          <Input
            label="Search user"
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
            </div>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
              {(teacherPickQuery.data?.items ?? []).map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-primary-soft"
                  onClick={() => setSelectedTeacher(user)}
                >
                  <span>
                    <span dir="auto">{user.displayName}</span>
                    <span className="ml-2 text-text-muted" dir="ltr">
                      {user.phone}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-text">Previous teacher</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="previousTeacher"
                checked={previousTeacher === "assistant"}
                onChange={() => setPreviousTeacher("assistant")}
              />
              Keep as Assistant
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="previousTeacher"
                checked={previousTeacher === "remove"}
                onChange={() => setPreviousTeacher("remove")}
              />
              Remove from Class
            </label>
          </fieldset>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setChangeTeacherOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={savingTeacher} onClick={() => void saveTeacher()}>
              {savingTeacher ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add member" wide>
        <div className="space-y-3">
          <div className="flex gap-2">
            {(
              [
                ["existing", "Existing user"],
                ["new", "New user"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  addTab === id
                    ? "bg-primary text-white"
                    : "bg-primary-soft text-text-muted hover:text-text"
                }`}
                onClick={() => setAddTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {(
              [
                ["student", "Student"],
                ["assistant", "Assistant"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                  memberRole === id
                    ? "bg-secondary text-white"
                    : "bg-primary-soft text-text-muted hover:text-text"
                }`}
                onClick={() => setMemberRole(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {addTab === "existing" ? (
            <>
              <Input
                label="Search user"
                placeholder="Phone or name…"
                value={userQuery}
                onChange={(event) => setUserQuery(event.target.value)}
              />
              {selectedUser ? (
                <div className="rounded-xl border border-secondary/25 bg-primary-soft/50 px-3 py-2.5 text-sm">
                  Selected: <strong dir="auto">{selectedUser.displayName}</strong>{" "}
                  <span className="text-text-muted" dir="ltr">
                    ({selectedUser.phone})
                  </span>
                </div>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
                  {(userPickQuery.data?.items ?? []).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-primary-soft"
                      onClick={() => setSelectedUser(user)}
                    >
                      <span>
                        <span dir="auto">{user.displayName}</span>
                        <span className="ml-2 text-text-muted" dir="ltr">
                          {user.phone}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <Input
                label="Phone"
                value={newPhone}
                onChange={(event) => setNewPhone(event.target.value)}
                placeholder="0912..."
              />
              <Input
                label="Display name"
                value={newDisplayName}
                onChange={(event) => setNewDisplayName(event.target.value)}
              />
              <Input
                label="Initial password (optional)"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={adding || !canSubmitAdd}
              onClick={() => void addMember()}
            >
              {adding ? "Adding…" : "Add"}
            </Button>
          </div>
        </div>
      </Modal>

      <InitialPasswordModal
        open={Boolean(passwordModal)}
        onClose={() => setPasswordModal(null)}
        phone={passwordModal?.phone ?? ""}
        initialPassword={passwordModal?.initialPassword}
        existing={passwordModal?.existing}
      />
    </div>
  );
}
