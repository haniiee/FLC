"use client";

import { ApiClientError } from "@app/api-client";
import type { User } from "@app/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { getApiClient } from "../lib/api";
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
  const refresh = await webTokenStore.getRefreshToken();
  if (!refresh) {
    return null;
  }

  // Ensure we have an access token (refresh if needed)
  if (!(await webTokenStore.getAccessToken())) {
    try {
      await getApiClient().refresh(refresh);
    } catch {
      await webTokenStore.clear();
      return null;
    }
  }

  try {
    const me = await getApiClient().me();
    return me.user;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      await webTokenStore.clear();
      return null;
    }
    throw error;
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
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
