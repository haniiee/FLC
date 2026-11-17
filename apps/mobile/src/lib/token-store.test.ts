import { describe, expect, it } from "vitest";
import { createMemoryTokenStore } from "./token-store-memory";

describe("mobile TokenStore", () => {
  it("persists and clears tokens via secure backend", async () => {
    const map = new Map<string, string>();
    const store = createMemoryTokenStore({
      getItemAsync: async (key) => map.get(key) ?? null,
      setItemAsync: async (key, value) => {
        map.set(key, value);
      },
      deleteItemAsync: async (key) => {
        map.delete(key);
      },
    });

    expect(await store.getAccessToken()).toBeNull();
    expect(await store.getRefreshToken()).toBeNull();

    await store.setTokens({ accessToken: "access-1", refreshToken: "refresh-1" });
    expect(await store.getAccessToken()).toBe("access-1");
    expect(await store.getRefreshToken()).toBe("refresh-1");
    expect(map.get("flc.accessToken")).toBe("access-1");
    expect(map.get("flc.refreshToken")).toBe("refresh-1");

    await store.clear();
    expect(await store.getAccessToken()).toBeNull();
    expect(await store.getRefreshToken()).toBeNull();
    expect(map.size).toBe(0);
  });
});
