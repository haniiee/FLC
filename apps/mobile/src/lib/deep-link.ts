/**
 * Extract invite code from flc://join/CODE, flc://join?code=CODE,
 * https://host/join/CODE, or a bare CODE.
 */
export function parseJoinCodeFromUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Bare code (alphanumeric, no scheme)
  if (/^[A-Za-z0-9_-]{4,32}$/.test(raw) && !raw.includes("://") && !raw.includes("/")) {
    return raw;
  }

  try {
    const withScheme = raw.includes("://") ? raw : `https://placeholder/${raw.replace(/^\//, "")}`;
    const url = new URL(withScheme);

    const queryCode = url.searchParams.get("code");
    if (queryCode && queryCode.trim()) {
      return queryCode.trim();
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const joinIndex = parts.findIndex((p) => p.toLowerCase() === "join");
    if (joinIndex >= 0 && parts[joinIndex + 1]) {
      return parts[joinIndex + 1]!;
    }

    // flc://join/CODE → host may be "join" and path "/CODE"
    if (url.host.toLowerCase() === "join") {
      const code = parts[0];
      if (code) return code;
    }
  } catch {
    return null;
  }

  return null;
}

const PLAYLIST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Playlist id from flc://playlists/<uuid> or https://host/playlists/<uuid>.
 * flc://playlists/<uuid> puts "playlists" in the host and the id in the path.
 */
export function parsePlaylistIdFromUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  try {
    const withScheme = raw.includes("://") ? raw : `https://placeholder/${raw.replace(/^\//, "")}`;
    const url = new URL(withScheme);
    const parts = url.pathname.split("/").filter(Boolean);

    if (url.host.toLowerCase() === "playlists") {
      const id = parts[0];
      return id && PLAYLIST_UUID.test(id) ? id : null;
    }

    const index = parts.findIndex((part) => part.toLowerCase() === "playlists");
    const id = index >= 0 ? parts[index + 1] : undefined;
    if (id && PLAYLIST_UUID.test(id)) return id;
  } catch {
    return null;
  }

  return null;
}

/**
 * Library tab from flc://library?tab=bookmarks or https://host/library?tab=bookmarks.
 * flc://library puts "library" in the host.
 */
export function parseLibraryTabFromUrl(input: string): "bookmarks" | null {
  const raw = input.trim();
  if (!raw) return null;

  try {
    const withScheme = raw.includes("://") ? raw : `https://placeholder/${raw.replace(/^\//, "")}`;
    const url = new URL(withScheme);
    const parts = url.pathname.split("/").filter(Boolean);
    const isLibrary =
      url.host.toLowerCase() === "library" ||
      parts.some((part) => part.toLowerCase() === "library");
    if (!isLibrary) return null;
    return url.searchParams.get("tab") === "bookmarks" ? "bookmarks" : null;
  } catch {
    return null;
  }
}

/** Map an incoming flc:// or https URL onto an in-app Expo Router path. */
export function resolveDeepLinkPath(path: string): string {
  try {
    const code = parseJoinCodeFromUrl(path);
    if (code) {
      return `/join/${encodeURIComponent(code)}`;
    }
    const playlistId = parsePlaylistIdFromUrl(path);
    if (playlistId) {
      return `/playlists/${playlistId}`;
    }
    if (parseLibraryTabFromUrl(path) === "bookmarks") {
      return "/library?tab=bookmarks";
    }
    return path;
  } catch {
    return path;
  }
}
