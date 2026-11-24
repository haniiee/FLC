"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { InstallPrompt } from "../pwa/InstallPrompt";

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const admin = isAdminPath(pathname);

  if (admin) {
    return <div className="min-h-screen bg-background">{children}</div>;
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
