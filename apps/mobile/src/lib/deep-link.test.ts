import { describe, expect, it } from "vitest";
import {
  parseJoinCodeFromUrl,
  parseLibraryTabFromUrl,
  parsePlaylistIdFromUrl,
  resolveDeepLinkPath,
} from "./deep-link";

const PLAYLIST_ID = "11111111-1111-4111-8111-111111111111";

describe("parseJoinCodeFromUrl", () => {
  it("parses flc scheme paths", () => {
    expect(parseJoinCodeFromUrl("flc://join/ABC123")).toBe("ABC123");
    expect(parseJoinCodeFromUrl("flc://join/hello_world")).toBe("hello_world");
  });

  it("parses https web join urls", () => {
    expect(parseJoinCodeFromUrl("https://flc.example/join/XYZ99")).toBe("XYZ99");
    expect(parseJoinCodeFromUrl("https://localhost:3000/join/XYZ99?x=1")).toBe("XYZ99");
  });

  it("parses query code", () => {
    expect(parseJoinCodeFromUrl("flc://join?code=QWERTY")).toBe("QWERTY");
  });

  it("accepts bare codes", () => {
    expect(parseJoinCodeFromUrl("INVITE01")).toBe("INVITE01");
  });

  it("returns null for empty/invalid", () => {
    expect(parseJoinCodeFromUrl("")).toBeNull();
    expect(parseJoinCodeFromUrl("https://example.com/other/x")).toBeNull();
  });
});

describe("playlist deep links", () => {
  it("parses flc and https playlist urls", () => {
    expect(parsePlaylistIdFromUrl(`flc://playlists/${PLAYLIST_ID}`)).toBe(PLAYLIST_ID);
    expect(parsePlaylistIdFromUrl(`flc://playlists/${PLAYLIST_ID}/`)).toBe(PLAYLIST_ID);
    expect(parsePlaylistIdFromUrl(`https://flc.example/playlists/${PLAYLIST_ID}`)).toBe(
      PLAYLIST_ID,
    );
    expect(parsePlaylistIdFromUrl(`https://localhost:3000/playlists/${PLAYLIST_ID}?x=1`)).toBe(
      PLAYLIST_ID,
    );
  });

  it("rejects join links and non-uuids", () => {
    expect(parsePlaylistIdFromUrl("flc://join/ABC123")).toBeNull();
    expect(parsePlaylistIdFromUrl("flc://playlists/not-a-uuid")).toBeNull();
    expect(parsePlaylistIdFromUrl("")).toBeNull();
    expect(parsePlaylistIdFromUrl("https://example.com/other/x")).toBeNull();
  });

  it("rewrites playlist urls to the playlist screen and keeps join routes", () => {
    expect(resolveDeepLinkPath(`flc://playlists/${PLAYLIST_ID}`)).toBe(`/playlists/${PLAYLIST_ID}`);
    expect(resolveDeepLinkPath(`https://flc.example/playlists/${PLAYLIST_ID}`)).toBe(
      `/playlists/${PLAYLIST_ID}`,
    );
    expect(resolveDeepLinkPath("flc://join/ABC123")).toBe("/join/ABC123");
    expect(resolveDeepLinkPath("https://example.com/other/x")).toBe("https://example.com/other/x");
  });
});

describe("library deep links", () => {
  it("opens the bookmarks tab", () => {
    expect(parseLibraryTabFromUrl("flc://library?tab=bookmarks")).toBe("bookmarks");
    expect(parseLibraryTabFromUrl("https://flc.example/library?tab=bookmarks")).toBe("bookmarks");
    expect(parseLibraryTabFromUrl("flc://library")).toBeNull();
    expect(parseLibraryTabFromUrl("flc://library?tab=playlists")).toBeNull();
    expect(parseLibraryTabFromUrl(`flc://playlists/${PLAYLIST_ID}`)).toBeNull();
    expect(resolveDeepLinkPath("flc://library?tab=bookmarks")).toBe("/library?tab=bookmarks");
    expect(resolveDeepLinkPath("flc://join/ABC123")).toBe("/join/ABC123");
  });
});
