const CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/webm",
] as const;

export type MimeProbe = (mime: string) => boolean;

/** Pick the first MediaRecorder mime the browser supports, or null. */
export function pickRecordingMime(isTypeSupported: MimeProbe): string | null {
  for (const mime of CANDIDATES) {
    try {
      if (isTypeSupported(mime)) {
        return mime;
      }
    } catch {
      // ignore unsupported probe errors
    }
  }
  return null;
}

/** Strip `;codecs=...` for PUT Content-Type. */
export function baseMimeType(mime: string): string {
  return mime.split(";")[0]!.trim().toLowerCase();
}
