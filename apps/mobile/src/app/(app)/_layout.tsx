import { Stack } from "expo-router";
import { colors } from "../../theme/colors";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.secondary },
        headerTintColor: colors.onPrimary,
        headerTitleStyle: { fontFamily: "Vazirmatn_700Bold" },
        headerBackTitle: "بازگشت",
      }}
    >
      <Stack.Screen name="index" options={{ title: "کلاس‌ها" }} />
      <Stack.Screen name="groups/[groupId]" options={{ title: "کلاس" }} />
      <Stack.Screen name="join/index" options={{ title: "پیوستن با دعوت" }} />
      <Stack.Screen name="join/[code]" options={{ title: "پیوستن با دعوت" }} />
    </Stack>
  );
}
