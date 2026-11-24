"use client";

import type { GroupRole } from "@app/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ItemActionsMenu } from "../../../components/content/ItemActionsMenu";
import { canManageContent, FileRow } from "../../../components/files/FileRow";
import { TextNoteSheet } from "../../../components/files/TextNoteSheet";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Hero } from "../../../components/ui/Hero";
import { Sheet } from "../../../components/ui/Sheet";
import { Spinner } from "../../../components/ui/Spinner";
import { channelTitle } from "../../../chat/cache";
import { getApiClient } from "../../../lib/api";
import { copy } from "../../../lib/copy";
import { apiErrorMessage, roleLabel } from "../../../lib/format";

export default function GroupPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"sessions" | "members">("sessions");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getApiClient().getGroup(groupId),
  });

  const chatsQuery = useQuery({
    queryKey: ["chats", groupId],
    queryFn: () => getApiClient().listChats(groupId),
  });

  const sessionsQuery = useQuery({
    queryKey: ["sessions", groupId],
    queryFn: () => getApiClient().listSessions(groupId),
  });

  const filesQuery = useQuery({
    queryKey: ["group-files", groupId],
    queryFn: () => getApiClient().listGroupFiles(groupId),
  });

  const membersQuery = useQuery({
    queryKey: ["members", groupId],
    queryFn: () => getApiClient().listMembers(groupId),
    enabled: tab === "members",
  });

  const myRole = groupQuery.data?.myRole;
  const canManage = canManageContent(myRole);

  const createSession = useMutation({
    mutationFn: () => getApiClient().createSession(groupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sessions", groupId] });
      toast.success(copy.group.sessionCreated);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const createInvite = useMutation({
    mutationFn: () => getApiClient().createInvite(groupId, { maxUses: 50 }),
    onSuccess: (invite) => {
      setInviteCode(invite.code);
      setInviteUrl(invite.url);
      setInviteOpen(true);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const roleOptions = useMemo(() => ["assistant", "student"] as const, []);

  if (groupQuery.isLoading || sessionsQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!groupQuery.data) {
    return <EmptyState title={copy.group.notFound} />;
  }

  const group = groupQuery.data;

  return (
    <div className="space-y-4">
      <Hero>
        <Link href="/home" className="text-xs font-medium text-white/70 hover:text-white">
          ← {copy.common.back}
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold" dir="auto">
          {group.name}
        </h1>
        <p className="mt-1 text-sm text-white/80">
          {copy.group.yourRole}: {roleLabel(group.myRole)}
        </p>
        {canManage ? (
          <Button
            type="button"
            variant="outline"
            className="mt-4 border-white/30 bg-white/10 text-white hover:bg-white/20"
            onClick={() => createInvite.mutate()}
          >
            {copy.group.invite}
          </Button>
        ) : null}
      </Hero>

      <div className="flex flex-wrap gap-2">
        {(chatsQuery.data?.channels ?? []).map((channel) => (
          <Link
            key={channel.id}
            href={`/groups/${groupId}/chat/${channel.id}`}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-secondary shadow-card transition hover:border-secondary/40"
          >
            {channelTitle(channel.kind)}
          </Link>
        ))}
      </div>

      {(canManage || (filesQuery.data?.files.length ?? 0) > 0) && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-secondary">{copy.content.classNotes}</h2>
          {canManage ? (
            <Button type="button" variant="outline" className="w-full" onClick={() => setTextOpen(true)}>
              {copy.content.sendText}
            </Button>
          ) : null}
          {(filesQuery.data?.files ?? []).map((file) => (
            <FileRow
              key={file.id}
              file={file}
              canManage={canManage}
              onChanged={() => void filesQuery.refetch()}
            />
          ))}
        </section>
      )}

      <div className="flex gap-2 rounded-lg border border-border bg-surface p-1 shadow-card">
        {(
          [
            ["sessions", copy.group.sessions],
            ["members", copy.group.members],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              tab === key
                ? "bg-secondary text-white shadow-card"
                : "text-text-muted hover:text-text"
            }`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "sessions" ? (
        <div className="space-y-3">
          {canManage ? (
            <Button
              type="button"
              className="w-full"
              disabled={createSession.isPending}
              onClick={() => createSession.mutate()}
            >
              {copy.group.newSession}
            </Button>
          ) : null}
          {(sessionsQuery.data?.sessions ?? []).length === 0 ? (
            <EmptyState
              title={canManage ? copy.group.emptySessionsTeacher : copy.group.emptySessionsStudent}
              description={copy.group.emptySessionsSubtitle}
            />
          ) : (
            (sessionsQuery.data?.sessions ?? []).map((session) => (
              <Card key={session.id} className="flex items-center gap-2">
                <Link href={`/sessions/${session.id}`} className="min-w-0 flex-1">
                  <h2 className="font-semibold text-text" dir="auto">
                    {session.displayName}
                  </h2>
                  <p className="mt-1 text-xs text-text-muted">
                    <bdi dir="ltr">
                      {copy.group.sessionStats(session.topicCount, session.fileCount)}
                    </bdi>
                  </p>
                </Link>
                {canManage ? (
                  <ItemActionsMenu
                    title={session.title}
                    onRename={async (title) => {
                      await getApiClient().updateSession(session.id, { title });
                      await queryClient.invalidateQueries({ queryKey: ["sessions", groupId] });
                    }}
                    onDelete={async () => {
                      await getApiClient().deleteSession(session.id);
                      await queryClient.invalidateQueries({ queryKey: ["sessions", groupId] });
                    }}
                  />
                ) : null}
              </Card>
            ))
          )}
        </div>
      ) : null}

      {tab === "members" ? (
        <div className="space-y-3">
          {membersQuery.isLoading ? (
            <Spinner />
          ) : (
            (membersQuery.data?.members ?? []).map((member) => (
              <Card key={member.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-text" dir="auto">
                      {member.displayName}
                    </p>
                    <p className="text-xs text-text-muted">
                      {roleLabel(member.role)}
                      {member.phone ? (
                        <>
                          {" · "}
                          <bdi dir="ltr">{member.phone}</bdi>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
                {myRole === "teacher" && member.role !== "teacher" ? (
                  <div className="flex flex-wrap gap-2">
                    {roleOptions.map((role) => (
                      <Button
                        key={role}
                        type="button"
                        variant={member.role === role ? "primary" : "ghost"}
                        className="px-2 py-1 text-xs"
                        onClick={() => {
                          void (async () => {
                            try {
                              await getApiClient().updateMemberRole(groupId, member.id, { role });
                              await queryClient.invalidateQueries({
                                queryKey: ["members", groupId],
                              });
                              toast.success(copy.group.roleUpdated);
                            } catch (error) {
                              toast.error(apiErrorMessage(error));
                            }
                          })();
                        }}
                      >
                        {roleLabel(role as GroupRole)}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="danger"
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        void (async () => {
                          try {
                            await getApiClient().removeMember(groupId, member.id);
                            await queryClient.invalidateQueries({ queryKey: ["members", groupId] });
                            toast.success(copy.group.memberRemoved);
                          } catch (error) {
                            toast.error(apiErrorMessage(error));
                          }
                        })();
                      }}
                    >
                      {copy.group.remove}
                    </Button>
                  </div>
                ) : null}
                {myRole === "assistant" && member.role === "student" ? (
                  <Button
                    type="button"
                    variant="danger"
                    className="px-2 py-1 text-xs"
                    onClick={() => {
                      void (async () => {
                        try {
                          await getApiClient().removeMember(groupId, member.id);
                          await queryClient.invalidateQueries({ queryKey: ["members", groupId] });
                          toast.success(copy.group.studentRemoved);
                        } catch (error) {
                          toast.error(apiErrorMessage(error));
                        }
                      })();
                    }}
                  >
                    {copy.group.removeStudent}
                  </Button>
                ) : null}
              </Card>
            ))
          )}
        </div>
      ) : null}

      <TextNoteSheet
        open={textOpen}
        onClose={() => setTextOpen(false)}
        onSubmit={async (content) => {
          try {
            await getApiClient().createTextFile({ groupId, content });
            toast.success(copy.content.textAdded);
            await queryClient.invalidateQueries({ queryKey: ["group-files", groupId] });
          } catch (error) {
            toast.error(apiErrorMessage(error));
            throw error;
          }
        }}
      />

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title={copy.group.invite}>
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            {copy.group.inviteCodeLabel}: <bdi dir="ltr">{inviteCode}</bdi>
          </p>
          <p className="break-all rounded-md border border-border bg-surface-muted/50 p-3 text-sm">
            {inviteUrl}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                void navigator.clipboard.writeText(inviteUrl);
                toast.success(copy.group.inviteCopied);
              }}
            >
              {copy.group.copyLink}
            </Button>
            {"share" in navigator ? (
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  void navigator.share({ title: copy.group.inviteShareTitle, url: inviteUrl });
                }}
              >
                {copy.group.share}
              </Button>
            ) : null}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
