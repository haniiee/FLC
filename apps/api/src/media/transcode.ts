import { spawn } from "node:child_process";
import { env } from "../env";

const TRANSCODE_TIMEOUT_MS = 5 * 60_000;

export function toAacM4a(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      input,
      "-vn",
      "-c:a",
      "aac",
      "-b:a",
      "64k",
      "-ac",
      "1",
      "-ar",
      "44100",
      "-movflags",
      "+faststart",
      output,
    ];

    const child = spawn(env.FFMPEG_PATH, args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`ffmpeg timed out\n${stderr.slice(-2000)}`));
    }, TRANSCODE_TIMEOUT_MS);

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      if (stderr.length > 50_000) {
        stderr = stderr.slice(-40_000);
      }
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

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim().slice(-2000) || `ffmpeg exited with code ${code}`));
    });
  });
}
