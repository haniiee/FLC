import { spawn } from "node:child_process";
import { env } from "../env";

export type ProbeResult = {
  durationMs: number;
  codec: string;
  formatName: string;
};

type FfprobeJson = {
  format?: { duration?: string; format_name?: string };
  streams?: Array<{ codec_type?: string; codec_name?: string }>;
};

const PROBE_TIMEOUT_MS = 30_000;

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

        const durationSec = Number.parseFloat(parsed.format?.duration ?? "0");
        if (!Number.isFinite(durationSec) || durationSec <= 0) {
          reject(new Error("invalid duration"));
          return;
        }

        resolve({
          durationMs: Math.round(durationSec * 1000),
          codec: audio.codec_name,
          formatName: parsed.format?.format_name ?? "",
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error("ffprobe parse failed"));
      }
    });
  });
}
