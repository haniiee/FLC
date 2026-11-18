import { Stack } from "expo-router";
import { PlayerProvider } from "../../player/PlayerProvider";
import { useTheme } from "../../theme/theme";

export default function AppLayout() {
  const { colors, isDark } = useTheme();

  return (
    <PlayerProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: "PlusJakartaSans_700Bold" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          headerBackButtonDisplayMode: "minimal",
          statusBarStyle: isDark ? "light" : "dark",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="groups/[groupId]"
          options={{ headerShown: false, statusBarStyle: "light" }}
        />
        <Stack.Screen
          name="sessions/[sessionId]"
          options={{ headerShown: false, title: "Session" }}
        />
        <Stack.Screen name="topics/[topicId]" options={{ headerShown: false, title: "Topic" }} />
        <Stack.Screen
          name="player"
          options={{
            presentation: "modal",
            headerShown: false,
            title: "Now playing",
          }}
        />
        <Stack.Screen name="join/index" options={{ title: "", headerTitle: "" }} />
        <Stack.Screen name="join/[code]" options={{ title: "", headerTitle: "" }} />
      </Stack>
    </PlayerProvider>
  );
}
