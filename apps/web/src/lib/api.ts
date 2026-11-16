"use client";

import { createApiClient, type ApiClient } from "@app/api-client";
import { webTokenStore } from "./token-store";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

let client: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!client) {
    client = createApiClient(baseUrl, { tokenStore: webTokenStore });
  }
  return client;
}
