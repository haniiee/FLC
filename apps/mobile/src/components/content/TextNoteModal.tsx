import { useEffect, useState } from "react";
import { Modal, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { copy } from "../../lib/copy";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";
import { Button } from "../Button";

type TextNoteModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (content: string) => Promise<void>;
};

export function TextNoteModal({ visible, onClose, onSubmit }: TextNoteModalProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue("");
      setBusy(false);
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: spacing[4],
            paddingTop: spacing[5],
            paddingBottom: Math.max(insets.bottom, spacing[4]),
            gap: spacing[4],
          }}
        >
          <AppText variant="h2">{copy.content.textNote}</AppText>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={copy.content.writeTextPlaceholder}
            placeholderTextColor={colors.textMuted}
            multiline
            autoFocus
            textAlignVertical="top"
            style={{
              minHeight: 140,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: spacing[3],
              color: colors.text,
              backgroundColor: colors.surface,
              fontSize: 16,
            }}
          />
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <View style={{ flex: 1 }}>
              <Button title={copy.content.cancel} onPress={onClose} variant="outline" />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={copy.content.sendText}
                loading={busy}
                disabled={busy || !value.trim()}
                onPress={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      await onSubmit(value.trim());
                      onClose();
                    } catch {
                      // The screen shows the error.
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
