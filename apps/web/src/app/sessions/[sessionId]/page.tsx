"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ItemActionsMenu } from "../../../components/content/ItemActionsMenu";
import { canManageContent, FileRow, OptimisticFileRow } from "../../../components/files/FileRow";
import { UploadSheet } from "../../../components/files/UploadSheet";
import { RecordButton, type PendingUpload } from "../../../components/recorder/RecordButton";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Spinner } from "../../../components/ui/Spinner";
import { getApiClient } from "../../../lib/api";
import { apiErrorMessage } from "../../../lib/format";
import { usePlayer } from "../../../player/context";
import { filesRefetchInterval } from "../../../recorder/refetch-interval";

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const queryClient = useQueryClient();
  const player = usePlayer();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const prevStatuses = useRef<Map<string, string>>(new Map());

  const sessionQuery = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => getApiClient().getSession(sessionId),
    refetchInterval: (query) => filesRefetchInterval(query.state.data?.files ?? []),
  });

  const groupId = sessionQuery.data?.session.groupId;
  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getApiClient().getGroup(groupId!),
    enabled: Boolean(groupId),
  });

  const myRole = groupQuery.data?.myRole;
  const canManage = canManageContent(myRole);

  useEffect(() => {
    const files = sessionQuery.data?.files ?? [];
    let becameReady = false;
    for (const file of files) {
      const prev = prevStatuses.current.get(file.id);
      if (prev && prev !== "ready" && file.status === "ready") {
        becameReady = true;
      }
      prevStatuses.current.set(file.id, file.status);
    }
    if (becameReady) {
      void player.refreshPlaylist();
    }
  }, [player, sessionQuery.data?.files]);

  const createTopic = useMutation({
    mutationFn: () => getApiClient().createTopic(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      toast.success("تاپیک ساخته شد");
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
  }

  if (sessionQuery.isLoading || groupQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!sessionQuery.data) {
    return <EmptyState title="جلسه پیدا نشد" />;
  }

  const { session, topics, files } = sessionQuery.data;

  return (
    <div className={`space-y-4 ${canManage ? "pb-28" : ""}`}>
      <div>
        <Link href={`/groups/${session.groupId}`} className="text-xs text-text-muted">
          → بازگشت به کلاس
        </Link>
        <div className="mt-1 flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-secondary">{session.displayName}</h1>
          {canManage ? (
            <ItemActionsMenu
              title={session.title}
              onRename={async (title) => {
                await getApiClient().updateSession(session.id, { title });
                await refresh();
              }}
              onDelete={async () => {
                await getApiClient().deleteSession(session.id);
                window.location.href = `/groups/${session.groupId}`;
              }}
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="flex-1" onClick={() => void player.playSession(sessionId)}>
          پخش همه
        </Button>
        {canManage ? (
          <>
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={createTopic.isPending}
              onClick={() => createTopic.mutate()}
            >
              تاپیک جدید
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => setUploadOpen(true)}
            >
              افزودن
            </Button>
          </>
        ) : null}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text-muted">فایل‌های جلسه</h2>
        {files.length === 0 && pending.length === 0 ? (
          <EmptyState title="فایلی در این جلسه نیست" />
        ) : (
          <>
            {pending.map((item) => (
              <OptimisticFileRow key={item.id} title="در حال ارسال…" progress={item.progress} />
            ))}
            {files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                canManage={canManage}
                sessionId={sessionId}
                onChanged={() => void refresh()}
              />
            ))}
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text-muted">تاپیک‌ها</h2>
        {topics.length === 0 ? (
          <EmptyState title="تاپیکی نیست" />
        ) : (
          topics.map((topic) => (
            <Card key={topic.id} className="flex items-center gap-2">
              <Link href={`/topics/${topic.id}`} className="min-w-0 flex-1">
                <h3 className="font-semibold">{topic.displayName}</h3>
                <p className="mt-1 text-xs text-text-muted">
                  <bdi dir="ltr">{topic.fileCount}</bdi> فایل
                </p>
              </Link>
              {canManage ? (
                <ItemActionsMenu
                  title={topic.title}
                  onRename={async (title) => {
                    await getApiClient().updateTopic(topic.id, { title });
                    await refresh();
                  }}
                  onDelete={async () => {
                    await getApiClient().deleteTopic(topic.id);
                    await refresh();
                  }}
                />
              ) : null}
            </Card>
          ))
        )}
      </section>

      <UploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        sessionId={sessionId}
        onDone={() => void refresh()}
      />

      {canManage ? (
        <RecordButton
          sessionId={sessionId}
          pending={pending}
          onPendingChange={setPending}
          onUploaded={() => void refresh()}
        />
      ) : null}
    </div>
  );
}
