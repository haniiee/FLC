import type { TokenStore } from "@app/api-client";

const REFRESH_KEY = "flc.refreshToken";
const ACCESS_KEY = "flc.accessToken";

/** In-memory TokenStore for unit tests (no expo-secure-store). */
export function createMemoryTokenStore(backend: {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}): TokenStore {
  let access: string | null = null;
  return {
    getAccessToken: async () => {
      if (access) return access;
      access = await backend.getItemAsync(ACCESS_KEY);
      return access;
    },
    getRefreshToken: async () => backend.getItemAsync(REFRESH_KEY),
    setTokens: async ({ accessToken, refreshToken }) => {
      access = accessToken;
      await backend.setItemAsync(ACCESS_KEY, accessToken);
      await backend.setItemAsync(REFRESH_KEY, refreshToken);
    },
    clear: async () => {
      access = null;
      await backend.deleteItemAsync(ACCESS_KEY);
      await backend.deleteItemAsync(REFRESH_KEY);
    },
  };
}
