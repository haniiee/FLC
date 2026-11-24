"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { InstallPrompt } from "../pwa/InstallPrompt";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isLandingPath(pathname: string) {
  return pathname === "/" || pathname === "/welcome" || pathname.startsWith("/welcome/");
}

function isAuthPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/login/") ||
    pathname.startsWith("/register/")
  );
}

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const admin = isAdminPath(pathname);
  const landing = isLandingPath(pathname);
  const auth = isAuthPath(pathname);

  if (admin) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  if (landing) {
    return (
      <div className="min-h-dvh overflow-x-clip bg-[#F6F7FB]">
        {children}
        <InstallPrompt />
      </div>
    );
  }

  if (auth) {
    return <div className="min-h-dvh overflow-x-clip bg-[#070D1F]">{children}</div>;
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto min-h-[calc(100vh-64px)] w-full max-w-[720px] px-4 py-5 pb-36 md:pb-8">
        {children}
      </main>
      <BottomNav />
      <InstallPrompt />
    </>
  );
}
