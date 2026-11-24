"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "../../providers/auth-provider";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

const PUBLIC_PREFIXES = ["/login", "/register", "/join", "/offline"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function AccessDenied() {
  return (
    <div
      className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 text-center"
      dir="ltr"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/70">403</p>
      <h1 className="text-2xl font-bold text-secondary">Access denied</h1>
      <p className="text-sm text-text-muted">
        This area is only available to platform administrators.
      </p>
      <Link href="/">
        <Button type="button">Back to home</Button>
      </Link>
    </div>
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const publicPath = isPublicPath(pathname);
  const changePasswordPath = pathname === "/change-password";
  const adminPath = isAdminPath(pathname);
  const mustChangePassword = user?.mustChangePassword === true;

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !publicPath) {
      const next = `${pathname}${searchParams?.toString() ? `?${searchParams}` : ""}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    if (isAuthenticated && mustChangePassword && !changePasswordPath) {
      router.replace("/change-password");
      return;
    }

    if (
      isAuthenticated &&
      !mustChangePassword &&
      user?.platformRole === "admin" &&
      !adminPath &&
      !changePasswordPath &&
      !publicPath
    ) {
      router.replace("/admin/groups");
    }
  }, [
    adminPath,
    changePasswordPath,
    isAuthenticated,
    isLoading,
    mustChangePassword,
    pathname,
    publicPath,
    router,
    searchParams,
    user?.platformRole,
  ]);

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

  if (isAuthenticated && mustChangePassword && !changePasswordPath) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (
    isAuthenticated &&
    !mustChangePassword &&
    user?.platformRole === "admin" &&
    !adminPath &&
    !changePasswordPath &&
    !publicPath
  ) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (isAuthenticated && !mustChangePassword && adminPath && user?.platformRole !== "admin") {
    return <AccessDenied />;
  }

  return children;
}
