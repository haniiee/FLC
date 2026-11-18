import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { copy } from "../../lib/copy";
import { AppText } from "../AppText";

type ImageViewerProps = {
  visible: boolean;
  uri: string | null;
  title: string;
  onClose: () => void;
};

export function ImageViewer({ visible, uri, title, onClose }: ImageViewerProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.content.cancel}
            hitSlop={8}
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.16)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} color="#fff" />
          </Pressable>
          <AppText variant="h3" style={{ color: "#fff", flex: 1 }}>
            {title}
          </AppText>
        </View>
        {uri ? (
          <Image
            source={{ uri }}
            contentFit="contain"
            style={{ flex: 1, width: "100%" }}
            accessibilityLabel={title}
          />
        ) : null}
      </View>
    </Modal>
  );
}
