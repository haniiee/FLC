import type { RepeatMode, SavedPlayerSession } from "./types";

const POS_PREFIX = "flc:pos:";
const SESSION_KEY = "flc:player:session";

export function positionKey(fileId: string): string {
  return `${POS_PREFIX}${fileId}`;
}

export function loadFilePosition(fileId: string): number {
  if (typeof window === "undefined") {
    return 0;
  }
  try {
    const raw = localStorage.getItem(positionKey(fileId));
    if (!raw) {
      return 0;
    }
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveFilePosition(fileId: string, positionSec: number): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (positionSec <= 0) {
      localStorage.removeItem(positionKey(fileId));
      return;
    }
    localStorage.setItem(positionKey(fileId), String(Math.floor(positionSec)));
  } catch {
    // ignore quota / private mode
  }
}

export function clearFilePosition(fileId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(positionKey(fileId));
  } catch {
    // ignore
  }
}

export function loadSavedSession(): SavedPlayerSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as SavedPlayerSession;
    if (
      !parsed?.sessionId ||
      !parsed.currentFileId ||
      typeof parsed.currentIndex !== "number" ||
      typeof parsed.rate !== "number"
    ) {
      return null;
    }
    const repeatMode: RepeatMode =
      parsed.repeatMode === "all" || parsed.repeatMode === "one" ? parsed.repeatMode : "off";
    return { ...parsed, repeatMode };
  } catch {
    return null;
  }
}

export function saveSavedSession(session: SavedPlayerSession): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearSavedSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}
