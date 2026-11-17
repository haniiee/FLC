import type { LucideIcon } from "lucide-react-native";
import { View } from "react-native";
import { useTheme } from "../theme/theme";
import { AppText } from "./AppText";
import { Button } from "./Button";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actionTitle?: string;
  onAction?: () => void;
};

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  actionTitle,
  onAction,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 4,
        }}
      >
        <Icon size={28} color={colors.primary} />
      </View>
      <AppText variant="h3" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" color="textMuted" style={{ textAlign: "center" }}>
          {subtitle}
        </AppText>
      ) : null}
      {actionTitle && onAction ? (
        <View style={{ marginTop: 8, alignSelf: "stretch" }}>
          <Button title={actionTitle} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
