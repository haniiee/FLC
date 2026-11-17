import { Stack } from "expo-router";
import { useTheme } from "../../theme/theme";

export default function AppLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: "PlusJakartaSans_700Bold" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="groups/[groupId]"
        options={{ headerShown: false, statusBarStyle: "light" }}
      />
      <Stack.Screen name="join/index" options={{ title: "", headerTitle: "" }} />
      <Stack.Screen name="join/[code]" options={{ title: "", headerTitle: "" }} />
    </Stack>
  );
}
