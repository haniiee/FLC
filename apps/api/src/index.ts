import { buildApp } from "./app";
import { env } from "./env";
import { checkFfmpeg, recoverProcessingAudio } from "./media/process-audio";
import { cleanupStalePendingFiles } from "./services/content-service";

const STALE_PENDING_INTERVAL_MS = 30 * 60 * 1000;

const app = await buildApp();

try {
  const ffmpeg = await checkFfmpeg();
  if (ffmpeg === "missing") {
    console.warn(
      `[media] ffmpeg missing (FFMPEG_PATH=${env.FFMPEG_PATH}). Audio processing will fail until installed.`,
    );
  }

  const port = env.PORT ?? env.API_PORT;
  await app.listen({ port, host: "0.0.0.0" });
  void recoverProcessingAudio().catch((error) => {
    app.log.error(error, "failed to recover processing audio");
  });

  const runStalePendingCleanup = () => {
    void cleanupStalePendingFiles()
      .then((n) => {
        if (n > 0) app.log.info({ count: n }, "cleaned stale pending files");
      })
      .catch((error) => {
        app.log.error(error, "failed to clean stale pending files");
      });
  };
  runStalePendingCleanup();
  setInterval(runStalePendingCleanup, STALE_PENDING_INTERVAL_MS);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
