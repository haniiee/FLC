import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { copy } from "../../lib/copy";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";
import { Button } from "../Button";

type MessageActionsSheetProps = {
  visible: boolean;
  canCopy: boolean;
  canDelete: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => Promise<void>;
};

export function MessageActionsSheet({
  visible,
  canCopy,
  canDelete,
  onClose,
  onCopy,
  onDelete,
}: MessageActionsSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) setConfirming(false);
  }, [visible]);

  function closeAll() {
    setConfirming(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={closeAll}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.content.cancel}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
        onPress={closeAll}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: Math.max(insets.bottom, 16),
            gap: 12,
          }}
        >
          {confirming ? (
            <>
              <AppText variant="h2">{copy.chats.deleteConfirmTitle}</AppText>
              <AppText variant="body" color="textMuted">
                {copy.chats.deleteConfirmMessage}
              </AppText>
              <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={copy.content.cancel}
                    variant="outline"
                    onPress={() => setConfirming(false)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={copy.content.delete}
                    variant="danger"
                    loading={busy}
                    disabled={busy}
                    onPress={() => {
                      void (async () => {
                        setBusy(true);
                        try {
                          await onDelete();
                          closeAll();
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              {canCopy ? (
                <Button
                  title={copy.chats.copy}
                  variant="secondary"
                  onPress={() => {
                    onClose();
                    onCopy();
                  }}
                />
              ) : null}
              {canDelete ? (
                <Button
                  title={copy.content.delete}
                  variant="danger"
                  onPress={() => setConfirming(true)}
                />
              ) : null}
              <Button title={copy.content.cancel} variant="ghost" onPress={closeAll} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
