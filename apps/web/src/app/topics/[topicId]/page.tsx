"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ItemActionsMenu } from "../../../components/content/ItemActionsMenu";
import { canManageContent, FileRow } from "../../../components/files/FileRow";
import { UploadSheet } from "../../../components/files/UploadSheet";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Spinner } from "../../../components/ui/Spinner";
import { getApiClient } from "../../../lib/api";

export default function TopicPage() {
  const params = useParams<{ topicId: string }>();
  const topicId = params.topicId;
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);

  const topicQuery = useQuery({
    queryKey: ["topic", topicId],
    queryFn: () => getApiClient().getTopic(topicId),
  });

  const sessionId = topicQuery.data?.topic.sessionId;
  const sessionQuery = useQuery({
    queryKey: ["session", sessionId],
    queryFn: () => getApiClient().getSession(sessionId!),
    enabled: Boolean(sessionId),
  });

  const groupId = sessionQuery.data?.session.groupId;
  const groupQuery = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getApiClient().getGroup(groupId!),
    enabled: Boolean(groupId),
  });

  const canManage = canManageContent(groupQuery.data?.myRole);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["topic", topicId] });
    if (sessionId) {
      await queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    }
  }

  if (topicQuery.isLoading || sessionQuery.isLoading || groupQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!topicQuery.data || !sessionId) {
    return <EmptyState title="تاپیک پیدا نشد" />;
  }

  const { topic, files } = topicQuery.data;

  return (
    <div className="space-y-4">
      <div>
        <Link href={`/sessions/${sessionId}`} className="text-xs text-text-muted">
          → بازگشت به جلسه
        </Link>
        <div className="mt-1 flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-secondary">{topic.displayName}</h1>
          {canManage ? (
            <ItemActionsMenu
              title={topic.title}
              onRename={async (title) => {
                await getApiClient().updateTopic(topic.id, { title });
                await refresh();
              }}
              onDelete={async () => {
                await getApiClient().deleteTopic(topic.id);
                window.location.href = `/sessions/${sessionId}`;
              }}
            />
          ) : null}
        </div>
      </div>

      {canManage ? (
        <Button type="button" className="w-full" onClick={() => setUploadOpen(true)}>
          افزودن
        </Button>
      ) : null}

      {files.length === 0 ? (
        <EmptyState title="فایلی در این تاپیک نیست" />
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              canManage={canManage}
              sessionId={sessionId}
              onChanged={() => void refresh()}
            />
          ))}
        </div>
      )}

      <UploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        sessionId={sessionId}
        topicId={topicId}
        onDone={() => void refresh()}
      />
    </div>
  );
}
