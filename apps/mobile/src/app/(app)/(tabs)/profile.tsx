import { tokens } from "@app/brand";
import Constants from "expo-constants";
import { useRef } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { AppText } from "../../../components/AppText";
import { Avatar } from "../../../components/Avatar";
import { Button } from "../../../components/Button";
import { Card } from "../../../components/Card";
import { Screen } from "../../../components/Screen";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { copy } from "../../../lib/copy";
import { useTabScrollToTop } from "../../../lib/use-tab-scroll-to-top";
import { useAuth } from "../../../providers/auth-provider";
import type { AppearancePreference } from "../../../theme/appearance-store";
import { useTheme } from "../../../theme/theme";

function SegmentedControl({
  value,
  onChange,
}: {
  value: AppearancePreference;
  onChange: (value: AppearancePreference) => void;
}) {
  const { colors } = useTheme();
  const options: Array<{ key: AppearancePreference; label: string }> = [
    { key: "system", label: copy.profile.system },
    { key: "light", label: copy.profile.light },
    { key: "dark", label: copy.profile.dark },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surfaceMuted,
        borderRadius: tokens.radius.md,
        padding: 4,
        gap: 4,
      }}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            hitSlop={4}
            onPress={() => onChange(opt.key)}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: tokens.radius.sm,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? colors.surface : "transparent",
            }}
          >
            <AppText variant="label" color={active ? "primary" : "textMuted"}>
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const ref = useRef(null);
  useTabScrollToTop(ref);
  const version = Constants.expoConfig?.version ?? "0.1.0";
  const roleLabel =
    user?.platformRole === "teacher" ? copy.profile.platformTeacher : copy.profile.platformMember;

  function confirmLogout() {
    Alert.alert(copy.profile.logOutConfirmTitle, copy.profile.logOutConfirmMessage, [
      { text: copy.profile.cancel, style: "cancel" },
      {
        text: copy.profile.logOut,
        style: "destructive",
        onPress: () => void logout(),
      },
    ]);
  }

  return (
    <Screen padded={false} edges={["top"]}>
      <ScreenHeader title={copy.profile.title} />
      <ScrollView
        ref={ref}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 16 }}
      >
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Avatar name={user?.displayName ?? "U"} size={56} />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="h3">{user?.displayName ?? ""}</AppText>
              <AppText variant="body" color="textMuted">
                {user?.phone ?? ""}
              </AppText>
              <AppText variant="label" color="primary">
                {roleLabel}
              </AppText>
            </View>
          </View>
        </Card>

        <View style={{ gap: 8 }}>
          <AppText variant="label" color="textMuted">
            {copy.profile.appearance}
          </AppText>
          <Card padding={16}>
            <SegmentedControl value={preference} onChange={setPreference} />
          </Card>
        </View>

        <View style={{ gap: 8 }}>
          <AppText variant="label" color="textMuted">
            {copy.profile.about}
          </AppText>
          <Card>
            <AppText variant="body">{copy.brand.academy}</AppText>
            <AppText variant="caption" color="textMuted" style={{ marginTop: 6 }}>
              Version {version}
            </AppText>
          </Card>
        </View>

        <Button title={copy.profile.logOut} variant="danger" onPress={confirmLogout} />
      </ScrollView>
    </Screen>
  );
}
