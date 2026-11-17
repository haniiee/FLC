import { createApiClient, type ApiClient } from "@app/api-client";
import Constants from "expo-constants";
import { mobileTokenStore } from "./token-store";

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromExtra === "string" && fromExtra) {
    return fromExtra.replace(/\/$/, "");
  }
  // Android emulator loopback to host machine
  return "http://10.0.2.2:4000";
}

let client: ApiClient | null = null;

export function getApiBaseUrl(): string {
  return resolveApiUrl();
}

export function getApiClient(): ApiClient {
  if (!client) {
    client = createApiClient(resolveApiUrl(), { tokenStore: mobileTokenStore });
  }
  return client;
}
