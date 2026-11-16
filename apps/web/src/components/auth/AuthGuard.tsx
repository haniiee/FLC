"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Spinner } from "../ui/Spinner";
import { useAuth } from "../../providers/auth-provider";

const PUBLIC_PREFIXES = ["/login", "/register", "/join", "/offline"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const publicPath = isPublicPath(pathname);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!isAuthenticated && !publicPath) {
      const next = `${pathname}${searchParams?.toString() ? `?${searchParams}` : ""}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [isAuthenticated, isLoading, pathname, publicPath, router, searchParams]);

  if (isLoading && !publicPath) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!isAuthenticated && !publicPath) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return children;
}
