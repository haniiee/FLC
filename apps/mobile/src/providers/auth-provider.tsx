import { ApiClientError } from "@app/api-client";
import type { User } from "@app/shared-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useSegments } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { getApiClient } from "../lib/api";
import { mobileTokenStore } from "../lib/token-store";
import { disconnectSocket, setSocketUnauthorizedHandler } from "../realtime/socket";

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
  const refresh = await mobileTokenStore.getRefreshToken();
  if (!refresh) {
    return null;
  }

  if (!(await mobileTokenStore.getAccessToken())) {
    try {
      await getApiClient().refresh(refresh);
    } catch {
      await mobileTokenStore.clear();
      return null;
    }
  }

  try {
    const me = await getApiClient().me();
    return me.user;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      await mobileTokenStore.clear();
      return null;
    }
    throw error;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const segments = useSegments();

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
    disconnectSocket();
    try {
      await getApiClient().logout();
    } catch {
      await mobileTokenStore.clear();
    }
    queryClient.clear();
    router.replace("/login");
  }, [queryClient]);

  useEffect(() => {
    setSocketUnauthorizedHandler(() => {
      void logout();
    });
    return () => setSocketUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    if (meQuery.isPending) return;
    const inAuthGroup = segments[0] === "(auth)";
    const onChangePassword = inAuthGroup && segments[1] === "change-password";

    if (!meQuery.data) {
      if (!inAuthGroup) {
        router.replace("/login");
      }
      return;
    }

    if (meQuery.data.mustChangePassword) {
      if (!onChangePassword) {
        router.replace("/change-password");
      }
      return;
    }

    if (inAuthGroup) {
      router.replace("/");
    }
  }, [meQuery.data, meQuery.isPending, segments]);

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
