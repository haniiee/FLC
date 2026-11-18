import { EllipsisVertical } from "lucide-react-native";
import { Pressable, type GestureResponderEvent } from "react-native";
import { copy } from "../lib/copy";
import { useTheme } from "../theme/theme";

type MoreOptionsButtonProps = {
  onPress: (event: GestureResponderEvent) => void;
};

const HIT_TARGET = 44;

export function MoreOptionsButton({ onPress }: MoreOptionsButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.content.moreActions}
      hitSlop={8}
      onPress={onPress}
      style={{
        width: HIT_TARGET,
        height: HIT_TARGET,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <EllipsisVertical size={20} color={colors.textMuted} />
    </Pressable>
  );
}
