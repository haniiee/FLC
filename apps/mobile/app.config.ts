import type { ExpoConfig, ConfigContext } from "expo/config";

const IS_DEV = process.env.APP_ENV !== "production";

function webJoinIntentData(): Array<Record<string, string>> {
  const webUrl = process.env.EXPO_PUBLIC_WEB_URL?.trim();
  if (!webUrl) return [];
  try {
    const { hostname } = new URL(webUrl);
    if (!hostname) return [];
    return [
      {
        scheme: "https",
        host: hostname,
        pathPrefix: "/join",
      },
    ];
  } catch {
    return [];
  }
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "FLC",
  slug: "flc",
  version: "0.1.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "flc",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "ir.foroughmahtaban.flc",
  },
  android: {
    package: "ir.foroughmahtaban.flc",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#0F1E4A",
    },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        category: ["BROWSABLE", "DEFAULT"],
        data: [
          ...webJoinIntentData(),
          {
            scheme: "flc",
            host: "join",
            pathPrefix: "/",
          },
          {
            scheme: "flc",
            host: "playlists",
            pathPrefix: "/",
          },
          {
            scheme: "flc",
            host: "library",
            pathPrefix: "/",
          },
        ],
      },
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-font",
    [
      "expo-audio",
      {
        enableBackgroundPlayback: true,
        enableBackgroundRecording: false,
        microphonePermission: "FLC needs the microphone to record voice messages for your class.",
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#0F1E4A",
        image: "./assets/images/splash-icon.png",
        imageWidth: 180,
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: IS_DEV,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Legacy Fastify fallback only (unused when supabaseUrl + anon key are set)
    apiUrl: process.env.EXPO_PUBLIC_API_URL,
    supabaseUrl:
      process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://gegmzokhmbxwjonyqmmz.supabase.co",
    supabaseAnonKey:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlZ216b2tobWJ4d2pvbnlxbW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU1ODAyMDcsImV4cCI6MjExMTE1NjIwN30.Ch2t8MRu2S1fFETd4gob1CbVGWE0X_bg2bF7CyuNc9w",
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});

