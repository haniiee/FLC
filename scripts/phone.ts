import { spawn, type ChildProcess, execSync } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import qrcode from "qrcode-terminal";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const children: ChildProcess[] = [];
let shuttingDown = false;

function log(msg: string) {
  console.log(`[phone] ${msg}`);
}

function which(bin: string): string | null {
  try {
    return execSync(`command -v ${bin}`, { encoding: "utf-8" }).trim() || null;
  } catch {
    return null;
  }
}

function requireCloudflared(): string {
  const path = which("cloudflared");
  if (!path) {
    console.error(
      "[phone] cloudflared پیدا نشد. نصب:\n  brew install cloudflared\n  یا از https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/",
    );
    process.exit(1);
  }
  return path;
}

function track(child: ChildProcess): ChildProcess {
  children.push(child);
  return child;
}

function startTunnel(cloudflared: string, port: number, label: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = track(
      spawn(cloudflared, ["tunnel", "--url", `http://127.0.0.1:${port}`], {
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`Timeout waiting for ${label} tunnel URL`));
      }
    }, 90_000);

    const onLine = (line: string) => {
      const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && !settled) {
        settled = true;
        clearTimeout(timer);
        log(`${label} tunnel: ${match[0]}`);
        resolvePromise(match[0]!);
      }
    };

    createInterface({ input: child.stdout! }).on("line", onLine);
    createInterface({ input: child.stderr! }).on("line", onLine);

    child.on("exit", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`${label} tunnel exited with code ${code}`));
      }
    });
  });
}

function runInherit(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  label: string,
): ChildProcess {
  log(`start ${label}`);
  return track(
    spawn(command, args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: "inherit",
    }),
  );
}

function runOnce(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = track(
      spawn(command, args, {
        cwd: ROOT,
        env: { ...process.env, ...env },
        stdio: "inherit",
      }),
    );
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed: ${code}`));
      }
    });
  });
}

async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  log("shutting down...");
  for (const child of children.splice(0).reverse()) {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }
  await new Promise((r) => setTimeout(r, 400));
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

async function main() {
  const cloudflared = requireCloudflared();

  if (!existsSync(resolve(ROOT, ".env"))) {
    log("هشدار: فایل .env در ریشه پیدا نشد.");
  }

  log("docker compose up postgres minio...");
  await runOnce("docker", ["compose", "up", "-d", "postgres", "minio"], {});

  log("starting Cloudflare quick tunnels...");
  const [webTunnel, apiTunnel, minioTunnel] = await Promise.all([
    startTunnel(cloudflared, 3000, "web"),
    startTunnel(cloudflared, 4000, "api"),
    startTunnel(cloudflared, 9000, "minio"),
  ]);

  log(`recreate MinIO with CORS origin ${webTunnel}`);
  await runOnce(
    "docker",
    ["compose", "up", "-d", "--force-recreate", "minio"],
    { MINIO_API_CORS_ALLOW_ORIGIN: webTunnel },
  );
  await new Promise((r) => setTimeout(r, 2500));

  const apiEnv: NodeJS.ProcessEnv = {
    WEB_URL: webTunnel,
    // Browser reaches MinIO via tunnel; server uses local endpoint for Head/Delete.
    S3_PUBLIC_ENDPOINT: minioTunnel,
    S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://127.0.0.1:9000",
  };

  const webEnv: NodeJS.ProcessEnv = {
    NEXT_PUBLIC_API_URL: apiTunnel,
    NODE_ENV: "production",
  };

  log("building @app/web for production...");
  await runOnce("pnpm", ["--filter", "@app/web", "build"], webEnv);

  log("starting API...");
  runInherit("pnpm", ["--filter", "@app/api", "dev"], apiEnv, "api");
  await new Promise((r) => setTimeout(r, 3000));

  log("applying bucket CORS for web tunnel...");
  await runOnce(
    "pnpm",
    ["--filter", "@app/api", "exec", "tsx", "src/scripts/storage-cors.ts"],
    apiEnv,
  );

  log("starting web...");
  runInherit("pnpm", ["--filter", "@app/web", "start"], webEnv, "web");
  await new Promise((r) => setTimeout(r, 2000));

  console.log("\n========================================");
  console.log("روی گوشی این آدرس را باز کنید:");
  console.log(webTunnel);
  console.log("");
  console.log("API:  ", apiTunnel);
  console.log("MinIO:", minioTunnel);
  console.log("========================================\n");
  qrcode.generate(webTunnel, { small: true });
  log("Ctrl+C برای توقف");
}

main().catch((error) => {
  console.error(error);
  void shutdown();
});
