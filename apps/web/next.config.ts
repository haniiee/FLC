import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const revision =
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  // Landing frames are runtime CacheFirst — keep them out of the install precache.
  globPublicPatterns: ["**/*", "!frames/**", "!video/**", "!downloads/**"],
});

const nextConfig: NextConfig = {
  transpilePackages: ["@app/brand", "@app/api-client", "@app/shared-types"],
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default withSerwist(nextConfig);
