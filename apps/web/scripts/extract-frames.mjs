#!/usr/bin/env node
/**
 * Extract WebP frame sequences from public/video/aida.mp4 for scroll scrubbing.
 * Prefers system ffmpeg; falls back to ffmpeg-static.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const videoPath = join(root, "public/video/aida.mp4");
const framesRoot = join(root, "public/frames");

const PROFILES = [
  {
    id: "desktop",
    fps: 24,
    width: 1280,
    quality: 80,
    dir: join(framesRoot, "desktop"),
  },
  {
    id: "mobile",
    fps: 16,
    width: 720,
    quality: 72,
    dir: join(framesRoot, "mobile"),
  },
];

function resolveFfmpeg() {
  const fromEnv = process.env.FFMPEG_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const candidates = [
    join(root, "../../.tools/ffmpeg"),
    join(root, ".tools/ffmpeg"),
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  try {
    const require = createRequire(import.meta.url);
    const staticPath = require("ffmpeg-static");
    if (staticPath && existsSync(staticPath)) return staticPath;
  } catch {
    // ignore
  }

  return "ffmpeg";
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

function clearWebp(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    return;
  }
  for (const name of readdirSync(dir)) {
    if (name.endsWith(".webp")) {
      // leave cleanup to overwrite via ffmpeg -y pattern
    }
  }
}

function countFrames(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((n) => /^\d{4}\.webp$/.test(n)).length;
}

function totalBytes(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .filter((n) => n.endsWith(".webp"))
    .reduce((sum, n) => sum + statSync(join(dir, n)).size, 0);
}

async function extractProfile(ffmpeg, profile) {
  clearWebp(profile.dir);
  mkdirSync(profile.dir, { recursive: true });
  const outPattern = join(profile.dir, "%04d.webp");
  // scale width, keep aspect; do not upscale beyond source width
  const scale = `scale='min(${profile.width},iw)':-2:flags=lanczos`;
  const args = [
    "-y",
    "-i",
    videoPath,
    "-vf",
    `fps=${profile.fps},${scale}`,
    "-c:v",
    "libwebp",
    "-quality",
    String(profile.quality),
    "-compression_level",
    "4",
    outPattern,
  ];
  console.log(
    `\n→ Extracting ${profile.id} @ ${profile.fps}fps, w≤${profile.width}, q=${profile.quality}`,
  );
  await run(ffmpeg, args);
  const count = countFrames(profile.dir);
  if (count === 0) throw new Error(`No frames written for ${profile.id}`);
  console.log(`  ${count} frames → ${profile.dir}`);
  return count;
}

async function main() {
  if (!existsSync(videoPath)) {
    throw new Error(`Missing video: ${videoPath}`);
  }
  const ffmpeg = resolveFfmpeg();
  console.log(`Using ffmpeg: ${ffmpeg}`);

  mkdirSync(framesRoot, { recursive: true });

  const desktopCount = await extractProfile(ffmpeg, PROFILES[0]);
  const mobileCount = await extractProfile(ffmpeg, PROFILES[1]);

  // Probe first frame dimensions via ffprobe-less: assume width from profile
  const manifest = {
    source: "/video/aida.mp4",
    durationSec: 10,
    generatedAt: new Date().toISOString(),
    variants: {
      desktop: {
        fps: PROFILES[0].fps,
        width: PROFILES[0].width,
        height: Math.round((PROFILES[0].width * 720) / 1280),
        quality: PROFILES[0].quality,
        frameCount: desktopCount,
        pathPrefix: "/frames/desktop/",
        pattern: "{index:04d}.webp",
      },
      mobile: {
        fps: PROFILES[1].fps,
        width: PROFILES[1].width,
        height: Math.round((PROFILES[1].width * 720) / 1280),
        quality: PROFILES[1].quality,
        frameCount: mobileCount,
        pathPrefix: "/frames/mobile/",
        pattern: "{index:04d}.webp",
      },
    },
  };

  writeFileSync(join(framesRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log("\nWrote public/frames/manifest.json");
  console.log(
    `Desktop: ${desktopCount} frames, ${(totalBytes(PROFILES[0].dir) / 1024 / 1024).toFixed(1)} MB`,
  );
  console.log(
    `Mobile:  ${mobileCount} frames, ${(totalBytes(PROFILES[1].dir) / 1024 / 1024).toFixed(1)} MB`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
