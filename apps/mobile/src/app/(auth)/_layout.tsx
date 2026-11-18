import { Stack } from "expo-router";
import { useTheme } from "../../theme/theme";

export default function AuthLayout() {
  const { colors, isDark } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        statusBarStyle: isDark ? "light" : "dark",
      }}
    />
  );
}
