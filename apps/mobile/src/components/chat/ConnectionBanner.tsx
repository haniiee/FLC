import { useEffect, useState } from "react";
import { View } from "react-native";
import { copy } from "../../lib/copy";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";

export function ConnectionBanner({ connected }: { connected: boolean }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (connected) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(timer);
  }, [connected]);

  if (!visible) return null;

  return (
    <View
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: colors.primarySoft,
        paddingVertical: 6,
        alignItems: "center",
      }}
    >
      <AppText variant="caption" color="primary">
        {copy.chats.reconnecting}
      </AppText>
    </View>
  );
}
