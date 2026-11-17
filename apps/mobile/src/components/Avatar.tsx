import { View } from "react-native";
import { avatarColorFromName, contrastingInk } from "../lib/avatar-color";
import { initials } from "../lib/format";
import { useTheme } from "../theme/theme";
import { AppText } from "./AppText";

type AvatarProps = {
  name: string;
  size?: 32 | 40 | 56;
};

export function Avatar({ name, size = 40 }: AvatarProps) {
  const { colors, isDark } = useTheme();
  const bg = avatarColorFromName(name);
  const ink = contrastingInk(bg);
  const fontSize = size >= 56 ? 18 : size >= 40 ? 14 : 12;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: isDark ? 1 : 0,
        borderColor: colors.border,
      }}
    >
      <AppText variant="label" style={{ fontSize, lineHeight: fontSize + 2, color: ink }}>
        {initials(name)}
      </AppText>
    </View>
  );
}
