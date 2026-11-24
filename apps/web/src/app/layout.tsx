import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Vazirmatn } from "next/font/google";
import { Suspense } from "react";
import { AuthGuard } from "../components/auth/AuthGuard";
import { AppChrome } from "../components/layout/AppChrome";
import { Spinner } from "../components/ui/Spinner";
import { AppProviders } from "../providers/app-providers";
import { SerwistProvider } from "../providers/serwist-provider";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FLC",
  applicationName: "FLC",
  description: "Forough Mah Taban Academy — FLC",
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
    <html lang="en" dir="ltr" className={`${plusJakarta.variable} ${vazirmatn.variable}`}>
      <body className={`${plusJakarta.className} font-sans`}>
        <SerwistProvider>
          <AppProviders>
            <AppChrome>
              <Suspense
                fallback={
                  <div className="flex min-h-[40vh] items-center justify-center">
                    <Spinner className="h-8 w-8" />
                  </div>
                }
              >
                <AuthGuard>{children}</AuthGuard>
              </Suspense>
            </AppChrome>
          </AppProviders>
        </SerwistProvider>
      </body>
    </html>
  );
}
