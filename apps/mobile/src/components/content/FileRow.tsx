import type { FileDto } from "@app/shared-types";
import { FileAudio2, FileImage, FileText, FileType, Film, Pause, Play } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { getApiClient } from "../../lib/api";
import { copy } from "../../lib/copy";
import { apiErrorMessage, formatBytes, formatDuration, kindLabel } from "../../lib/format";
import { shareFile } from "../../lib/share-file";
import { usePlayerOptional } from "../../player/context";
import {
  indexOfFile,
  resolveQueueForContainer,
  type PlayAudioContext,
} from "../../player/play-audio";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";
import { Card } from "../Card";
import { Chip } from "../Chip";
import { MoreOptionsButton } from "../MoreOptionsButton";
import { ImageViewer } from "./ImageViewer";
import { ItemActionsSheet } from "./ItemActionsSheet";
import { RenameModal } from "./RenameModal";
import { TextViewer } from "./TextViewer";

function KindIcon({ kind }: { kind: FileDto["kind"] }) {
  const { colors } = useTheme();
  const size = 22;
  const color = colors.primary;
  switch (kind) {
    case "audio":
      return <FileAudio2 size={size} color={color} />;
    case "pdf":
      return <FileType size={size} color={color} />;
    case "image":
      return <FileImage size={size} color={color} />;
    case "video":
      return <Film size={size} color={color} />;
    case "text":
      return <FileText size={size} color={color} />;
  }
}

function StatusChip({
  status,
  canManage,
  onReprocess,
  reprocessing,
}: {
  status: FileDto["status"];
  canManage: boolean;
  onReprocess?: () => void;
  reprocessing?: boolean;
}) {
  if (status === "ready") return null;
  if (status === "processing") {
    return <Chip label={copy.content.processing} variant="primary" />;
  }
  if (status === "pending" && canManage) {
    return <Chip label={copy.content.pending} variant="neutral" />;
  }
  if (status === "failed" && canManage) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Chip label={copy.content.failed} variant="neutral" />
        {onReprocess ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.content.reprocess}
            onPress={onReprocess}
            disabled={reprocessing}
          >
            <AppText variant="caption" color="primary">
              {copy.content.reprocess}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return null;
}

export function OptimisticFileRow({ title, progress }: { title: string; progress: number }) {
  return <UploadingFileRow label={title} progress={progress} />;
}

export function UploadingFileRow({ label, progress }: { label: string; progress: number }) {
  const { spacing } = useTheme();
  const pct = Math.round(progress * 100);
  return (
    <Card padding={16}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
        <ActivityIndicator />
        <View style={{ flex: 1, gap: spacing[1] }}>
          <AppText variant="h3">{label}</AppText>
          <AppText variant="caption" color="textMuted">
            {copy.content.uploading} {pct}%
          </AppText>
          <Chip label={copy.content.uploading} variant="primary" />
        </View>
      </View>
    </Card>
  );
}

type FileRowProps = {
  file: FileDto;
  canManage: boolean;
  onChanged: () => void;
  playContext?: PlayAudioContext;
};

export function FileRow({ file, canManage, onChanged, playContext }: FileRowProps) {
  const { colors, spacing } = useTheme();
  const player = usePlayerOptional();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);

  const playable = file.status === "ready";
  const isCurrent = player?.current?.fileId === file.id;
  const isPlayingThis = Boolean(isCurrent && player?.isPlaying);

  const metaParts: string[] = [kindLabel(file.kind)];
  const sizePart = formatBytes(file.sizeBytes);
  if (sizePart && file.kind !== "audio") {
    metaParts.push(sizePart);
  }
  const durationPart = formatDuration(file.durationMs);
  if (durationPart) {
    metaParts.push(durationPart);
  }

  async function resolveUrl(download = false) {
    const result = await getApiClient().getFileUrl(file.id, download);
    return result.url;
  }

  async function onPlayAudio() {
    if (!playable || file.kind !== "audio" || !player || !playContext) return;
    if (isCurrent) {
      player.toggle();
      return;
    }
    setOpening(true);
    try {
      const queue = await resolveQueueForContainer(playContext);
      const index = indexOfFile(queue, file.id);
      await player.playQueue(queue, index);
    } catch (error) {
      Alert.alert(copy.content.actionFailed, apiErrorMessage(error, copy.content.actionFailed));
    } finally {
      setOpening(false);
    }
  }

  async function onOpen() {
    if (!playable) return;
    if (file.kind === "audio") {
      await onPlayAudio();
      return;
    }
    setOpening(true);
    try {
      if (file.kind === "image") {
        setImageUrl(await resolveUrl(false));
        return;
      }
      if (file.kind === "pdf" || file.kind === "video") {
        const url = await resolveUrl(false);
        await WebBrowser.openBrowserAsync(url);
        return;
      }
      if (file.kind === "text") {
        setTextOpen(true);
      }
    } catch (error) {
      Alert.alert(copy.content.actionFailed, apiErrorMessage(error, copy.content.actionFailed));
    } finally {
      setOpening(false);
    }
  }

  async function onReprocess() {
    setReprocessing(true);
    try {
      await getApiClient().reprocessFile(file.id);
      onChanged();
    } catch (error) {
      Alert.alert(copy.content.actionFailed, apiErrorMessage(error, copy.content.actionFailed));
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <>
      <Card padding={16}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[3] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.content.open}
            hitSlop={6}
            disabled={!playable}
            onPress={() => void onOpen()}
            style={{ opacity: opening && file.kind !== "audio" ? 0.6 : 1 }}
          >
            {opening && file.kind !== "audio" ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <KindIcon kind={file.kind} />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={{ flex: 1, gap: spacing[1] }}
            disabled={!playable}
            onPress={() => void onOpen()}
          >
            <AppText variant="h3">{file.displayName}</AppText>
            <AppText variant="caption" color="textMuted">
              {metaParts.join(" · ")}
            </AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <StatusChip
                status={file.status}
                canManage={canManage}
                reprocessing={reprocessing}
                onReprocess={
                  file.status === "failed" && canManage && !reprocessing
                    ? () => void onReprocess()
                    : undefined
                }
              />
              {isPlayingThis ? <Chip label={copy.content.playing} variant="accent" /> : null}
            </View>
          </Pressable>

          {file.kind === "audio" && playable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isPlayingThis ? copy.content.pause : copy.content.play}
              hitSlop={8}
              disabled={opening}
              onPress={() => void onPlayAudio()}
              style={{
                width: spacing[10],
                height: spacing[10],
                borderRadius: spacing[10] / 2,
                backgroundColor: colors.primary,
                alignItems: "center",
                justifyContent: "center",
                opacity: opening ? 0.6 : 1,
              }}
            >
              {opening ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : isPlayingThis ? (
                <Pause size={18} color={colors.onPrimary} fill={colors.onPrimary} />
              ) : (
                <Play
                  size={18}
                  color={colors.onPrimary}
                  fill={colors.onPrimary}
                  style={{ marginLeft: 2 }}
                />
              )}
            </Pressable>
          ) : null}

          {canManage || playable ? <MoreOptionsButton onPress={() => setMenuOpen(true)} /> : null}
        </View>
      </Card>

      <ItemActionsSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        showShare={playable}
        onRename={canManage ? () => setRenameOpen(true) : undefined}
        onShare={playable ? async () => shareFile(file) : undefined}
        onDelete={
          canManage
            ? async () => {
                await getApiClient().deleteFile(file.id);
                onChanged();
              }
            : undefined
        }
      />

      <RenameModal
        visible={renameOpen}
        initialTitle={file.title}
        onClose={() => setRenameOpen(false)}
        onSave={async (title) => {
          await getApiClient().updateFile(file.id, { title });
          onChanged();
        }}
      />

      <ImageViewer
        visible={Boolean(imageUrl)}
        uri={imageUrl}
        title={file.displayName}
        onClose={() => setImageUrl(null)}
      />

      <TextViewer
        visible={textOpen}
        title={file.displayName}
        textContent={file.textContent}
        onClose={() => setTextOpen(false)}
      />
    </>
  );
}
