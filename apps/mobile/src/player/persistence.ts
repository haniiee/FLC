import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizePlaybackRate, normalizeRepeatMode, DEFAULT_REPEAT_MODE } from "./logic";
import type { PlaybackRate, RepeatMode } from "./types";

const RATE_KEY = "flc:playbackRate";
/** v2 ignores an older "off" value saved before repeat-all became the default. */
const REPEAT_KEY = "flc.player.repeat.v2";
const resumeKey = (fileId: string) => `flc:resume:${fileId}`;

export async function loadPlaybackRate(): Promise<PlaybackRate> {
  try {
    const raw = await AsyncStorage.getItem(RATE_KEY);
    return normalizePlaybackRate(raw ? Number(raw) : NaN);
  } catch {
    return 1;
  }
}

export async function savePlaybackRate(rate: number): Promise<void> {
  await AsyncStorage.setItem(RATE_KEY, String(rate));
}

export async function loadRepeatMode(): Promise<RepeatMode> {
  try {
    const raw = await AsyncStorage.getItem(REPEAT_KEY);
    return normalizeRepeatMode(raw);
  } catch {
    return DEFAULT_REPEAT_MODE;
  }
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
