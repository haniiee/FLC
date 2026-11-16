"use client";

import type { GroupRole } from "@app/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ItemActionsMenu } from "../../../components/content/ItemActionsMenu";
import { canManageContent } from "../../../components/files/FileRow";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Sheet } from "../../../components/ui/Sheet";
import { Spinner } from "../../../components/ui/Spinner";
import { getApiClient } from "../../../lib/api";
import { apiErrorMessage, roleLabel } from "../../../lib/format";
export default function GroupPage() {
  const params = useParams<{ groupId: string }>();
  const groupId = params.groupId;
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"sessions" | "members">("sessions");
  const [inviteOpen, setInviteOpen] = useState(false);
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
      toast.success("جلسه ساخته شد");
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
    return <EmptyState title="کلاس پیدا نشد" />;
  }

  const group = groupQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-text-muted">
            → بازگشت
          </Link>
          <h1 className="mt-1 text-xl font-bold text-secondary">{group.name}</h1>
          <p className="text-sm text-text-muted">نقش شما: {roleLabel(group.myRole)}</p>
        </div>
        {canManage ? (
          <Button type="button" variant="secondary" onClick={() => createInvite.mutate()}>
            لینک دعوت
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(chatsQuery.data?.channels ?? []).map((channel) => (
          <Link
            key={channel.id}
            href={`/groups/${groupId}/chat/${channel.id}`}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-secondary"
          >
            {channel.kind === "all" ? "چت کلاس" : "چت دانشجوها"}
          </Link>
        ))}
      </div>

      <div className="flex gap-2 rounded-lg bg-surface p-1">
        {(
          [
            ["sessions", "جلسه‌ها"],
            ["members", "اعضا"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              tab === key ? "bg-secondary text-white" : "text-text-muted"
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
              جلسه‌ی جدید
            </Button>
          ) : null}
          {(sessionsQuery.data?.sessions ?? []).length === 0 ? (
            <EmptyState title="هنوز جلسه‌ای نیست" />
          ) : (
            (sessionsQuery.data?.sessions ?? []).map((session) => (
              <Card key={session.id} className="flex items-center gap-2">
                <Link href={`/sessions/${session.id}`} className="min-w-0 flex-1">
                  <h2 className="font-semibold text-text">{session.displayName}</h2>
                  <p className="mt-1 text-xs text-text-muted">
                    <bdi dir="ltr">{session.topicCount}</bdi> تاپیک ·{" "}
                    <bdi dir="ltr">{session.fileCount}</bdi> فایل
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
                    <p className="font-medium">{member.displayName}</p>
                    <p className="text-xs text-text-muted">
                      {roleLabel(member.role)}
                      {member.phone ? ` · ${member.phone}` : ""}
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
                              toast.success("نقش به‌روزرسانی شد");
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
                            toast.success("عضو حذف شد");
                          } catch (error) {
                            toast.error(apiErrorMessage(error));
                          }
                        })();
                      }}
                    >
                      حذف
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
                          toast.success("شاگرد حذف شد");
                        } catch (error) {
                          toast.error(apiErrorMessage(error));
                        }
                      })();
                    }}
                  >
                    حذف شاگرد
                  </Button>
                ) : null}
              </Card>
            ))
          )}
        </div>
      ) : null}

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title="لینک دعوت">
        <div className="space-y-3">
          <p className="text-sm text-text-muted">کد: {inviteCode}</p>
          <p className="break-all rounded-md bg-surface p-3 text-sm">{inviteUrl}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                void navigator.clipboard.writeText(inviteUrl);
                toast.success("لینک کپی شد");
              }}
            >
              کپی لینک
            </Button>
            {"share" in navigator ? (
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  void navigator.share({ title: "دعوت به کلاس FLC", url: inviteUrl });
                }}
              >
                اشتراک‌گذاری
              </Button>
            ) : null}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
