import type { FileDto } from "@app/shared-types";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getApiClient } from "./api";
import { fileExtensionForKind } from "./format";

function safeFileBaseName(displayName: string): string {
  return (
    displayName
      .replace(/[^\w\s.-]/g, "")
      .trim()
      .replace(/\s+/g, "_")
      .slice(0, 80) || "file"
  );
}

export async function shareFile(file: FileDto): Promise<void> {
  const { url, displayName } = await getApiClient().getFileUrl(file.id, true);
  const ext = fileExtensionForKind(file.kind, file.mimeType);
  const destination = new File(Paths.cache, `${safeFileBaseName(displayName)}${ext}`);
  await File.downloadFileAsync(url, destination, { idempotent: true });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device");
  }
  await Sharing.shareAsync(destination.uri);
}
