import { useEffect, useState } from "react";
import { Modal, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { copy } from "../../lib/copy";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";
import { Button } from "../Button";
import { Input } from "../Input";

type RenameModalProps = {
  visible: boolean;
  initialTitle: string | null;
  title?: string;
  label?: string;
  onClose: () => void;
  onSave: (title: string | null) => Promise<void>;
};

export function RenameModal({
  visible,
  initialTitle,
  title = copy.content.renameTitle,
  label = copy.content.title,
  onClose,
  onSave,
}: RenameModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(initialTitle ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setValue(initialTitle ?? "");
    }
  }, [visible, initialTitle]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: Math.max(insets.bottom, 16),
            gap: 16,
          }}
        >
          <AppText variant="h2">{title}</AppText>
          <Input
            label={label}
            value={value}
            onChangeText={setValue}
            autoFocus
            placeholder={copy.content.title}
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Button title={copy.content.cancel} onPress={onClose} variant="outline" />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={copy.content.save}
                loading={busy}
                disabled={busy}
                onPress={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      const next = value.trim();
                      await onSave(next.length === 0 ? null : next);
                      onClose();
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
