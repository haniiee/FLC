import { X } from "lucide-react-native";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { copy } from "../../lib/copy";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";

type TextViewerProps = {
  visible: boolean;
  title: string;
  textContent: string | null | undefined;
  loading?: boolean;
  onClose: () => void;
};

export function TextViewer({ visible, title, textContent, loading, onClose }: TextViewerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.a11y.back}
            hitSlop={8}
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} color={colors.text} />
          </Pressable>
          <AppText variant="h3" style={{ flex: 1 }}>
            {title}
          </AppText>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {loading ? (
            <AppText variant="body" color="textMuted">
              {copy.content.processing}
            </AppText>
          ) : (
            <AppText variant="body" style={{ lineHeight: 24 }}>
              {textContent?.trim() || "—"}
            </AppText>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
