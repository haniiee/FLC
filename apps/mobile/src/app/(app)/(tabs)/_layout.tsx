import { Tabs } from "expo-router";
import { PlatformPressable } from "expo-router/react-navigation";
import { GraduationCap, MessagesSquare, UserRound } from "lucide-react-native";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { copy } from "../../../lib/copy";
import { useTheme } from "../../../theme/theme";

function TabIcon({
  focused,
  color,
  Icon,
}: {
  focused: boolean;
  color: string;
  Icon: typeof GraduationCap;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0, { damping: 16, stiffness: 180 });
  }, [focused, scale]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: scale.value,
    transform: [{ scale: 0.85 + scale.value * 0.15 }],
  }));

  return (
    <View style={{ width: 48, height: 32, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: 48,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.primarySoft,
          },
          pillStyle,
        ]}
      />
      <Icon size={22} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: "PlusJakartaSans_600SemiBold",
          fontSize: 12,
        },
        tabBarButton: (props) => (
          <PlatformPressable
            {...props}
            pressColor="transparent"
            android_ripple={{ borderless: false, color: "transparent" }}
          />
        ),
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 6,
          ...(insets.bottom > 0
            ? {
                paddingBottom: insets.bottom + 6,
                height: 62 + insets.bottom,
              }
            : null),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: copy.classes.title,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={String(color)} Icon={GraduationCap} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: copy.chats.title,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={String(color)} Icon={MessagesSquare} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: copy.profile.title,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} color={String(color)} Icon={UserRound} />
          ),
        }}
      />
    </Tabs>
  );
}
