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
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:4000",
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});
