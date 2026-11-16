import icon192 from "@app/brand/assets/icon-192.png";
import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { Suspense } from "react";
import { AuthGuard } from "../components/auth/AuthGuard";
import { AppHeader } from "../components/layout/AppHeader";
import { Spinner } from "../components/ui/Spinner";
import { AppProviders } from "../providers/app-providers";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

const faviconSrc = typeof icon192 === "string" ? icon192 : icon192.src;

export const metadata: Metadata = {
  title: "FLC",
  description: "آکادمی فروغ ماه تابان",
  icons: {
    icon: [{ url: faviconSrc, type: "image/png", sizes: "192x192" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className={vazirmatn.className}>
        <AppProviders>
          <AppHeader />
          <main className="mx-auto min-h-[calc(100vh-64px)] w-full max-w-[720px] px-4 py-5">
            <Suspense
              fallback={
                <div className="flex min-h-[40vh] items-center justify-center">
                  <Spinner className="h-8 w-8" />
                </div>
              }
            >
              <AuthGuard>{children}</AuthGuard>
            </Suspense>
          </main>
        </AppProviders>
      </body>
    </html>
  );
}
