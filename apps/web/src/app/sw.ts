import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
import { CacheFirst, NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const apiOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_API_URL ? new URL(process.env.NEXT_PUBLIC_API_URL).origin : null;
  } catch {
    return null;
  }
})();

function isMediaOrRange(request: Request): boolean {
  if (request.headers.has("range")) {
    return true;
  }
  const dest = request.destination;
  return dest === "audio" || dest === "video";
}

function isApiOrS3(url: URL): boolean {
  if (apiOrigin && url.origin === apiOrigin) {
    return true;
  }
  if (url.pathname.includes("/class-files/")) {
    return true;
  }
  if (url.hostname.includes("minio") || url.port === "9000") {
    return true;
  }
  return false;
}

function isStaticAsset(request: Request, url: URL): boolean {
  if (request.destination === "font") {
    return true;
  }
  if (url.pathname.startsWith("/icons/")) {
    return true;
  }
  if (
    url.pathname.endsWith("favicon.ico") ||
    url.pathname.endsWith("apple-touch-icon.png") ||
    url.pathname.endsWith("icon.svg")
  ) {
    return true;
  }
  return false;
}

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher({ request, url }) {
      return isMediaOrRange(request) || isApiOrS3(url);
    },
    handler: new NetworkOnly(),
  },
  {
    matcher({ request, url }) {
      return isStaticAsset(request, url);
    },
    handler: new CacheFirst({
      cacheName: "flc-static-assets",
    }),
  },
  {
    matcher({ request }) {
      return request.mode === "navigate";
    },
    handler: new NetworkFirst({
      cacheName: "flc-pages",
      networkTimeoutSeconds: 5,
    }),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
