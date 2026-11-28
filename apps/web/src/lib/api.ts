"use client";

import { createApiClient, type ApiClient } from "@app/api-client";
import { createSupabaseApiClient } from "@app/supabase-app";
import { createBrowserSupabaseClient } from "./supabase/browser";
import { webTokenStore } from "./token-store";

let client: ApiClient | null = null;

function useSupabaseBackend() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getApiClient(): ApiClient {
  if (!client) {
    if (useSupabaseBackend()) {
      client = createSupabaseApiClient({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        supabase: createBrowserSupabaseClient(),
        tokenStore: webTokenStore,
        adminApiBaseUrl: "",
      });
    } else {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
      client = createApiClient(baseUrl, { tokenStore: webTokenStore });
    }
  }
  return client;
}
