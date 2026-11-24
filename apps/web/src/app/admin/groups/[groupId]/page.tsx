"use client";

import type { AdminMember, AdminUser } from "@app/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { InitialPasswordModal } from "../../../../components/admin/InitialPasswordModal";
import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import { Input } from "../../../../components/ui/Input";
import { Modal } from "../../../../components/ui/Modal";
import { Spinner } from "../../../../components/ui/Spinner";
import { getApiClient } from "../../../../lib/api";
import { apiErrorMessage } from "../../../../lib/format";

function roleBadge(role: AdminMember["role"]) {
  const styles =
    role === "teacher"
      ? "bg-secondary text-white"
      : role === "assistant"
        ? "bg-primary/15 text-primary"
        : "bg-surface text-text-muted border border-border";
  const label = role === "teacher" ? "Teacher" : role === "assistant" ? "Assistant" : "Student";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
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
      <div className="flex min-h-[30vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!group) {
    return (
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-secondary">Class not found</h2>
        <Link href="/admin/groups" className="text-sm text-secondary underline">
          Back to classes
        </Link>
      </Card>
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
          className="text-sm text-secondary underline-offset-2 hover:underline"
        >
          ← Classes
        </Link>
        <div className="mt-3 flex flex-wrap items-start gap-3">
          {editingName ? (
            <div className="flex min-w-[240px] flex-1 flex-wrap items-end gap-2">
              <div className="min-w-[200px] flex-1">
                <Input
                  label="Class name"
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                />
              </div>
              <Button type="button" disabled={savingName} onClick={() => void saveName()}>
                {savingName ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditingName(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-secondary">{group.name}</h2>
              <Button
                type="button"
                variant="ghost"
                className="px-2 py-1 text-xs"
                onClick={() => setEditingName(true)}
              >
                Rename
              </Button>
            </div>
          )}
        </div>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-text">Teacher</h3>
            <p className="mt-1 text-sm text-text-muted">
              {group.teacher.displayName} · <span dir="ltr">{group.teacher.phone}</span>
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setChangeTeacherOpen(true)}>
            Change teacher
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold text-text">Members</h3>
          <Button type="button" onClick={() => setAddOpen(true)}>
            Add member
          </Button>
        </div>
        <div className="space-y-2">
          {members.map((member) => (
            <Card
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-text">{member.displayName}</span>
                  {roleBadge(member.role)}
                </div>
                <p className="text-sm text-text-muted" dir="ltr">
                  {member.phone}
                </p>
              </div>
              {member.role !== "teacher" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => void toggleRole(member)}
                  >
                    Make {member.role === "assistant" ? "Student" : "Assistant"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    className="px-2 py-1 text-xs"
                    onClick={() => void removeMember(member)}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
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
            <div className="rounded-lg border border-secondary/30 bg-surface px-3 py-2 text-sm">
              Selected: <strong>{selectedTeacher.displayName}</strong>{" "}
              <span className="text-text-muted" dir="ltr">
                ({selectedTeacher.phone})
              </span>
            </div>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
              {(teacherPickQuery.data?.items ?? []).map((user) => (
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
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  addTab === id ? "bg-secondary text-white" : "bg-surface text-text-muted"
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
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  memberRole === id ? "bg-primary text-on-primary" : "bg-surface text-text-muted"
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
                <div className="rounded-lg border border-secondary/30 bg-surface px-3 py-2 text-sm">
                  Selected: <strong>{selectedUser.displayName}</strong>{" "}
                  <span className="text-text-muted" dir="ltr">
                    ({selectedUser.phone})
                  </span>
                </div>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                  {(userPickQuery.data?.items ?? []).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-surface"
                      onClick={() => setSelectedUser(user)}
                    >
                      <span>
                        {user.displayName}
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
