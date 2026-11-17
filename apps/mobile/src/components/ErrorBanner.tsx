import { TriangleAlert } from "lucide-react-native";
import { View } from "react-native";
import { tokens } from "@app/brand";
import { useTheme } from "../theme/theme";
import { AppText } from "./AppText";

export function ErrorBanner({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: `${colors.danger}18`,
        borderRadius: tokens.radius.md,
        padding: 12,
        borderWidth: 1,
        borderColor: `${colors.danger}44`,
      }}
    >
      <TriangleAlert size={18} color={colors.danger} />
      <AppText variant="label" color="danger" style={{ flex: 1 }}>
        {message}
      </AppText>
    </View>
  );
}
