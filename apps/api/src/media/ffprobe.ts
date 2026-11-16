import { spawn } from "node:child_process";
import { env } from "../env";

export type ProbeResult = {
  durationMs: number | null;
  codec: string;
  formatName: string;
};

type FfprobeJson = {
  format?: { duration?: string; format_name?: string };
  streams?: Array<{ codec_type?: string; codec_name?: string; duration?: string }>;
};

const PROBE_TIMEOUT_MS = 30_000;

function parseDurationSec(value: string | undefined): number | null {
  if (!value || value === "N/A") {
    return null;
  }
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  return n;
}

function parseTimeToMs(time: string): number | null {
  // HH:MM:SS.xx or MM:SS.xx
  const parts = time.split(":").map((p) => Number.parseFloat(p));
  if (parts.some((p) => !Number.isFinite(p))) {
    return null;
  }
  let seconds = 0;
  if (parts.length === 3) {
    seconds = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
  } else if (parts.length === 2) {
    seconds = parts[0]! * 60 + parts[1]!;
  } else if (parts.length === 1) {
    seconds = parts[0]!;
  } else {
    return null;
  }
  if (seconds <= 0) {
    return null;
  }
  return Math.round(seconds * 1000);
}

export function probe(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      env.FFPROBE_PATH,
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error("ffprobe timed out"));
    }, PROBE_TIMEOUT_MS);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (code !== 0) {
        reject(new Error(stderr.trim() || `ffprobe exited with code ${code}`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as FfprobeJson;
        const audio = parsed.streams?.find((stream) => stream.codec_type === "audio");
        if (!audio?.codec_name) {
          reject(new Error("no audio stream"));
          return;
        }

        const durationSec =
          parseDurationSec(parsed.format?.duration) ?? parseDurationSec(audio.duration);

        resolve({
          durationMs: durationSec !== null ? Math.round(durationSec * 1000) : null,
          codec: audio.codec_name,
          formatName: parsed.format?.format_name ?? "",
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error("ffprobe parse failed"));
      }
    });
  });
}

/** Decode-based duration when container headers lack duration (e.g. non-seekable webm). */
export function decodeDurationMs(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawn(env.FFMPEG_PATH, ["-i", filePath, "-f", "null", "-"], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve(null);
    }, PROBE_TIMEOUT_MS);

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 80_000) {
        stderr = stderr.slice(-60_000);
      }
    });

    child.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    });

    child.on("close", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      // Prefer the last time= occurrence (final progress).
      const matches = [...stderr.matchAll(/time=(\d+:\d+:\d+\.\d+)/g)];
      const last = matches.at(-1)?.[1];
      resolve(last ? parseTimeToMs(last) : null);
    });
  });
}

/** Fill missing duration via stream headers already tried in probe; fall back to decode. */
export async function ensureDurationMs(
  filePath: string,
  existing: number | null,
): Promise<number | null> {
  if (existing !== null && existing > 0) {
    return existing;
  }
  return decodeDurationMs(filePath);
}
