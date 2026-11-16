import type { TokenStore } from "@app/api-client";

const REFRESH_KEY = "flc.refreshToken";

let accessToken: string | null = null;

export const webTokenStore: TokenStore = {
  getAccessToken: () => accessToken,
  getRefreshToken: () => {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem(REFRESH_KEY);
  },
  setTokens: ({ accessToken: nextAccess, refreshToken }) => {
    accessToken = nextAccess;
    if (typeof window !== "undefined") {
      localStorage.setItem(REFRESH_KEY, refreshToken);
    }
  },
  clear: () => {
    accessToken = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem(REFRESH_KEY);
    }
  },
};
