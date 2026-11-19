import { resolveDeepLinkPath } from "../lib/deep-link";

/**
 * Rewrite flc://join/CODE, flc://playlists/<id>, and the https equivalents
 * into Expo Router paths. `path` may be a full URL or a relative path.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return resolveDeepLinkPath(path);
}
