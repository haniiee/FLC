import { setAudioModeAsync } from "expo-audio";

/** Match PlayerProvider playback session settings after recording. */
export async function restorePlaybackAudioMode(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: "doNotMix",
  });
}

export async function enableRecordingAudioMode(): Promise<void> {
  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });
}
