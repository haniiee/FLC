"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ItemActionsMenu } from "../../../components/content/ItemActionsMenu";
import { canManageContent, FileRow, OptimisticFileRow } from "../../../components/files/FileRow";
import { UploadSheet } from "../../../components/files/UploadSheet";
import { RecordButton, type PendingUpload } from "../../../components/recorder/RecordButton";
import { AddToPlaylistModal } from "../../../components/playlists/AddToPlaylistModal";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Hero } from "../../../components/ui/Hero";
import { Spinner } from "../../../components/ui/Spinner";
import { getApiClient } from "../../../lib/api";
import { copy } from "../../../lib/copy";
import { usePlayer } from "../../../player/context";
import { filesRefetchInterval } from "../../../recorder/refetch-interval";

export default function TopicPage() {
  const params = useParams<{ topicId: string }>();
  const topicId = params.topicId;
  const queryClient = useQueryClient();
  const player = usePlayer();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchPlaylistOpen, setBatchPlaylistOpen] = useState(false);
  const prevStatuses = useRef<Map<string, string>>(new Map());

  const topicQuery = useQuery({
    queryKey: ["topic", topicId],
    queryFn: () => getApiClient().getTopic(topicId),
    refetchInterval: (query) => filesRefetchInterval(query.state.data?.files ?? []),
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

  useEffect(() => {
    const files = topicQuery.data?.files ?? [];
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
  }, [player, topicQuery.data?.files]);

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
    return <EmptyState title={copy.content.topicNotFound} />;
  }

  const { topic, files } = topicQuery.data;

  const readyAudio = files.filter((file) => file.status === "ready" && file.kind === "audio");
  const selectedOrderedIds = files
    .filter((file) => selectedIds.has(file.id))
    .map((file) => file.id);

  function toggleSelected(fileId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  return (
    <div
      className={`space-y-4 ${canManage ? "pb-28" : ""} ${selectMode && selectedIds.size > 0 ? "pb-36" : ""}`}
    >
      <Hero>
        <Link
          href={`/sessions/${sessionId}`}
          className="text-xs font-medium text-white/70 hover:text-white"
        >
          ← {copy.group.backToSession}
        </Link>
        <div className="mt-2 flex items-start justify-between gap-2">
          <h1 className="text-2xl font-extrabold" dir="auto">
            {topic.displayName}
          </h1>
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
      </Hero>

      {canManage ? (
        <Button type="button" className="w-full" onClick={() => setUploadOpen(true)}>
          {copy.content.addFile}
        </Button>
      ) : null}

      {readyAudio.length > 0 ? (
        selectMode ? (
          <Button type="button" variant="secondary" className="w-full" onClick={exitSelectMode}>
            {copy.library.cancelSelection}
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => setSelectMode(true)}
          >
            {copy.library.selectVoices}
          </Button>
        )
      ) : null}

      {files.length === 0 && pending.length === 0 ? (
        <EmptyState title={copy.content.emptyTopicFiles} />
      ) : (
        <div className="space-y-2">
          {pending.map((item) => (
            <OptimisticFileRow
              key={item.id}
              title={copy.content.pendingUpload}
              progress={item.progress}
            />
          ))}
          {files.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              canManage={canManage}
              sessionId={sessionId}
              onChanged={() => void refresh()}
              selectMode={selectMode && file.status === "ready" && file.kind === "audio"}
              selected={selectedIds.has(file.id)}
              onToggleSelect={() => toggleSelected(file.id)}
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

      {selectMode && selectedIds.size > 0 ? (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 mx-auto flex max-w-[720px] gap-2 border-t border-border bg-background px-4 py-3 shadow-soft">
          <Button type="button" variant="ghost" className="flex-1" onClick={exitSelectMode}>
            {copy.library.cancelSelection}
          </Button>
          <Button type="button" className="flex-1" onClick={() => setBatchPlaylistOpen(true)}>
            {copy.library.addCountToPlaylist(selectedIds.size)}
          </Button>
        </div>
      ) : null}

      <AddToPlaylistModal
        open={batchPlaylistOpen}
        onClose={() => setBatchPlaylistOpen(false)}
        fileIds={selectedOrderedIds}
        onAdded={() => exitSelectMode()}
      />

      {canManage ? (
        <RecordButton
          sessionId={sessionId}
          topicId={topicId}
          pending={pending}
          onPendingChange={setPending}
          onUploaded={() => void refresh()}
        />
      ) : null}
    </div>
  );
}
