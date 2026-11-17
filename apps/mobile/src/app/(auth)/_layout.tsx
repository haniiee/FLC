import { Stack } from "expo-router";
import { colors } from "../../theme/colors";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.secondary },
        headerTintColor: colors.onPrimary,
        headerTitleStyle: { fontFamily: "Vazirmatn_700Bold" },
      }}
    >
      <Stack.Screen name="login" options={{ title: "ورود" }} />
      <Stack.Screen name="register" options={{ title: "ثبت‌نام" }} />
    </Stack>
  );
}
