"use client";

import type { User } from "@app/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { getApiClient } from "../lib/api";
import { createBrowserSupabaseClient } from "../lib/supabase/browser";
import { disconnectSocket } from "../realtime/socket";
import { webTokenStore } from "../lib/token-store";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  setSessionFromAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<User | null> {
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const supabase = createBrowserSupabaseClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) return null;
      if (data.session.access_token && data.session.refresh_token) {
        await webTokenStore.setTokens({
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
        });
      }
    } else {
      const refresh = await webTokenStore.getRefreshToken();
      if (!refresh) return null;
    }
    const me = await getApiClient().me();
    return me.user;
  } catch {
    await webTokenStore.clear();
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    const supabase = createBrowserSupabaseClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && session.refresh_token) {
        void webTokenStore.setTokens({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const refreshUser = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    await meQuery.refetch();
  }, [meQuery, queryClient]);

  const setSessionFromAuth = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    await queryClient.fetchQuery({ queryKey: ["me"], queryFn: fetchMe });
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await getApiClient().logout();
    } catch {
      await webTokenStore.clear();
    }
    disconnectSocket();
    queryClient.clear();
    if (pathname !== "/login") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, queryClient, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isPending,
      isAuthenticated: Boolean(meQuery.data),
      refreshUser,
      logout,
      setSessionFromAuth,
    }),
    [logout, meQuery.data, meQuery.isPending, refreshUser, setSessionFromAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
