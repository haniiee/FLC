import AsyncStorage from "@react-native-async-storage/async-storage";
import { PLAYBACK_RATES, type PlaybackRate, type RepeatMode } from "./types";

const RATE_KEY = "flc:playbackRate";
const REPEAT_KEY = "flc:repeatMode";
const resumeKey = (fileId: string) => `flc:resume:${fileId}`;

export async function loadPlaybackRate(): Promise<PlaybackRate> {
  try {
    const raw = await AsyncStorage.getItem(RATE_KEY);
    const value = raw ? Number(raw) : NaN;
    if (PLAYBACK_RATES.includes(value as PlaybackRate)) {
      return value as PlaybackRate;
    }
  } catch {
    // ignore
  }
  return 1;
}

export async function savePlaybackRate(rate: number): Promise<void> {
  await AsyncStorage.setItem(RATE_KEY, String(rate));
}

export async function loadRepeatMode(): Promise<RepeatMode> {
  try {
    const raw = await AsyncStorage.getItem(REPEAT_KEY);
    if (raw === "all" || raw === "one" || raw === "off") return raw;
  } catch {
    // ignore
  }
  return "off";
}

export async function saveRepeatMode(mode: RepeatMode): Promise<void> {
  await AsyncStorage.setItem(REPEAT_KEY, mode);
}

export async function loadResumePosition(fileId: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(resumeKey(fileId));
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export async function saveResumePosition(fileId: string, positionSec: number): Promise<void> {
  if (!Number.isFinite(positionSec) || positionSec <= 0) {
    await clearResumePosition(fileId);
    return;
  }
  await AsyncStorage.setItem(resumeKey(fileId), String(positionSec));
}

export async function clearResumePosition(fileId: string): Promise<void> {
  await AsyncStorage.removeItem(resumeKey(fileId));
}
