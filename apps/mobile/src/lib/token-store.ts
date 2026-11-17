import type { TokenStore } from "@app/api-client";
import * as SecureStore from "expo-secure-store";

const REFRESH_KEY = "flc.refreshToken";
const ACCESS_KEY = "flc.accessToken";

let accessTokenMemory: string | null = null;

async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

export const mobileTokenStore: TokenStore = {
  getAccessToken: async () => {
    if (accessTokenMemory) return accessTokenMemory;
    const stored = await secureGet(ACCESS_KEY);
    accessTokenMemory = stored;
    return stored;
  },
  getRefreshToken: async () => secureGet(REFRESH_KEY),
  setTokens: async ({ accessToken, refreshToken }) => {
    accessTokenMemory = accessToken;
    await secureSet(ACCESS_KEY, accessToken);
    await secureSet(REFRESH_KEY, refreshToken);
  },
  clear: async () => {
    accessTokenMemory = null;
    await secureDelete(ACCESS_KEY);
    await secureDelete(REFRESH_KEY);
  },
};
