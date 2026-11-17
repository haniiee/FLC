import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import { Suspense } from "react";
import { AuthGuard } from "../components/auth/AuthGuard";
import { AppHeader } from "../components/layout/AppHeader";
import { InstallPrompt } from "../components/pwa/InstallPrompt";
import { Spinner } from "../components/ui/Spinner";
import { AppProviders } from "../providers/app-providers";
import { SerwistProvider } from "../providers/serwist-provider";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FLC",
  applicationName: "FLC",
  description: "آکادمی فروغ ماه تابان",
  appleWebApp: {
    capable: true,
    title: "FLC",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0F1E4A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className={vazirmatn.className}>
        <SerwistProvider>
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
            <InstallPrompt />
          </AppProviders>
        </SerwistProvider>
      </body>
    </html>
  );
}
