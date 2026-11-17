import type { ReactNode } from "react";
import { View } from "react-native";
import { AppText } from "./AppText";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  action?: ReactNode;
};

export function ScreenHeader({ title, subtitle, action }: ScreenHeaderProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 12,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="display">{title}</AppText>
        {subtitle ? (
          <AppText variant="body" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {action}
    </View>
  );
}
