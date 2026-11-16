/**
 * Asset path helpers for FLC brand files in packages/brand/assets/:
 *   - flc-logo.svg
 *   - icon-1024.png
 *   - icon-512.png
 *   - icon-192.png
 *
 * Web / bundlers: import via the `brandAssetImports` module IDs below
 * (or `@app/brand/assets/<filename>`).
 * React Native: require from this package's assets directory.
 */
export const brandAssetFiles = {
  logoSvg: "flc-logo.svg",
  icon1024: "icon-1024.png",
  icon512: "icon-512.png",
  icon192: "icon-192.png",
} as const;

/** Relative paths from the package root (useful for RN Metro / Expo). */
export const brandAssetPaths = {
  logoSvg: "assets/flc-logo.svg",
  icon1024: "assets/icon-1024.png",
  icon512: "assets/icon-512.png",
  icon192: "assets/icon-192.png",
} as const;

/** Workspace package import IDs for Next / bundlers. */
export const brandAssetImports = {
  logoSvg: "@app/brand/assets/flc-logo.svg",
  icon1024: "@app/brand/assets/icon-1024.png",
  icon512: "@app/brand/assets/icon-512.png",
  icon192: "@app/brand/assets/icon-192.png",
} as const;
