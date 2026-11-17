import {
  Vazirmatn_400Regular,
  Vazirmatn_500Medium,
  Vazirmatn_700Bold,
  useFonts,
} from "@expo-google-fonts/vazirmatn";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { DevSettings, I18nManager, Text, TextInput } from "react-native";
import { shouldReloadForRtl } from "../lib/rtl";
import { AppProviders } from "../providers/app-providers";
import { colors } from "../theme/colors";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const RTL_RELOAD_FLAG = "flc.rtlReloaded";

function markRtlReloadAttempted(): void {
  // globalThis survives JS reload in the same process; native RTL flips on next load.
  (globalThis as { [RTL_RELOAD_FLAG]?: boolean })[RTL_RELOAD_FLAG] = true;
}

function hasRtlReloadAttempted(): boolean {
  return Boolean((globalThis as { [RTL_RELOAD_FLAG]?: boolean })[RTL_RELOAD_FLAG]);
}

function reloadForRtl(): void {
  markRtlReloadAttempted();
  if (__DEV__ && typeof DevSettings?.reload === "function") {
    DevSettings.reload();
    return;
  }
  // Release: RN has no public reload API without expo-updates; forceRTL still
  // applies on the next cold start. Avoid looping.
}

// RTL must be set before first layout paint; Android applies after app restart.
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

if (shouldReloadForRtl(I18nManager.isRTL, hasRtlReloadAttempted())) {
  reloadForRtl();
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Vazirmatn_400Regular,
    Vazirmatn_500Medium,
    Vazirmatn_700Bold,
  });

  useEffect(() => {
    if (!fontsLoaded) return;
    // Apply Vazirmatn as default text font (RN still supports defaultProps)
    const TextAny = Text as unknown as { defaultProps?: { style?: unknown } };
    const InputAny = TextInput as unknown as { defaultProps?: { style?: unknown } };
    TextAny.defaultProps = {
      ...(TextAny.defaultProps ?? {}),
      style: [{ fontFamily: "Vazirmatn_400Regular" }, TextAny.defaultProps?.style],
    };
    InputAny.defaultProps = {
      ...(InputAny.defaultProps ?? {}),
      style: [{ fontFamily: "Vazirmatn_400Regular" }, InputAny.defaultProps?.style],
    };
    void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AppProviders>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.secondary },
          headerTintColor: colors.onPrimary,
          headerTitleStyle: { fontFamily: "Vazirmatn_700Bold" },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </AppProviders>
  );
}
