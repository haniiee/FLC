import { createApiClient, type ApiClient } from "@app/api-client";
import { createSupabaseApiClient } from "@app/supabase-app";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { mobileTokenStore } from "./token-store";

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromExtra === "string" && fromExtra) {
    return fromExtra.replace(/\/$/, "");
  }
  return "http://10.0.2.2:4000";
}

function supabaseConfig() {
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ||
    (Constants.expoConfig?.extra?.supabaseUrl as string | undefined);
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    (Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined);
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

let client: ApiClient | null = null;

export function getApiBaseUrl(): string {
  const sb = supabaseConfig();
  return sb?.url ?? resolveApiUrl();
}

export function getApiClient(): ApiClient {
  if (!client) {
    const sb = supabaseConfig();
    if (sb) {
      const supabase = createClient(sb.url, sb.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
      client = createSupabaseApiClient({
        supabaseUrl: sb.url,
        supabaseAnonKey: sb.anonKey,
        supabase,
        tokenStore: mobileTokenStore,
      });
    } else {
      client = createApiClient(resolveApiUrl(), { tokenStore: mobileTokenStore });
    }
  }
  return client;
}
