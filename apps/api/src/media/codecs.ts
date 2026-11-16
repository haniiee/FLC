/** Codecs that are already browser-friendly; skip transcode. */
const PASSTHROUGH_CODECS = new Set(["mp3", "mp3float", "aac", "mp4a"]);

/**
 * Returns true when the audio stream should be re-encoded to AAC/M4A.
 * mp3 and aac (in mp4/m4a) pass through; opus/vorbis/pcm/etc. need transcode.
 */
export function needsTranscode(codec: string): boolean {
  const normalized = codec.trim().toLowerCase();
  return !PASSTHROUGH_CODECS.has(normalized);
}
