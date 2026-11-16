/**
 * Asset path helpers for FLC brand files in packages/brand/assets/.
 *
 * Web / bundlers: import via the `brandAssetImports` module IDs below
 * (or `@app/brand/assets/<filename>`).
 * React Native: require from this package's assets directory.
 */
export const brandAssetFiles = {
  logoSvg: "flc-logo.svg",
  iconSvg: "icon.svg",
  icon1024: "icon-1024.png",
  icon512: "icon-512.png",
  icon192: "icon-192.png",
  iconMaskable512: "icon-maskable-512.png",
  iconMaskable192: "icon-maskable-192.png",
  appleTouchIcon: "apple-touch-icon.png",
  faviconIco: "favicon.ico",
} as const;

/** Relative paths from the package root (useful for RN Metro / Expo). */
export const brandAssetPaths = {
  logoSvg: "assets/flc-logo.svg",
  iconSvg: "assets/icon.svg",
  icon1024: "assets/icon-1024.png",
  icon512: "assets/icon-512.png",
  icon192: "assets/icon-192.png",
  iconMaskable512: "assets/icon-maskable-512.png",
  iconMaskable192: "assets/icon-maskable-192.png",
  appleTouchIcon: "assets/apple-touch-icon.png",
  faviconIco: "assets/favicon.ico",
} as const;

/** Workspace package import IDs for Next / bundlers. */
export const brandAssetImports = {
  logoSvg: "@app/brand/assets/flc-logo.svg",
  iconSvg: "@app/brand/assets/icon.svg",
  icon1024: "@app/brand/assets/icon-1024.png",
  icon512: "@app/brand/assets/icon-512.png",
  icon192: "@app/brand/assets/icon-192.png",
  iconMaskable512: "@app/brand/assets/icon-maskable-512.png",
  iconMaskable192: "@app/brand/assets/icon-maskable-192.png",
  appleTouchIcon: "@app/brand/assets/apple-touch-icon.png",
  faviconIco: "@app/brand/assets/favicon.ico",
} as const;
