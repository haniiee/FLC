import { buildApp } from "./app";
import { env } from "./env";
import { checkFfmpeg, recoverProcessingAudio } from "./media/process-audio";

const app = await buildApp();

try {
  const ffmpeg = await checkFfmpeg();
  if (ffmpeg === "missing") {
    console.warn(
      `[media] ffmpeg missing (FFMPEG_PATH=${env.FFMPEG_PATH}). Audio processing will fail until installed.`,
    );
  }

  await app.listen({ port: env.API_PORT, host: "0.0.0.0" });
  void recoverProcessingAudio().catch((error) => {
    app.log.error(error, "failed to recover processing audio");
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
