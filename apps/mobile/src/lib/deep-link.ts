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
