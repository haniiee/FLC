import { parseJoinCodeFromUrl } from "../lib/deep-link";

/**
 * Rewrite flc://join/CODE and https://…/join/CODE into Expo Router paths.
 * `path` may be a full URL or a relative path depending on the platform.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const code = parseJoinCodeFromUrl(path);
    if (code) {
      return `/join/${encodeURIComponent(code)}`;
    }
    return path;
  } catch {
    return path;
  }
}
