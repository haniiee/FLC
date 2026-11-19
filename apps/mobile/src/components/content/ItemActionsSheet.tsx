import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { copy } from "../../lib/copy";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";
import { Button } from "../Button";

export type ItemSheetAction = {
  title: string;
  onPress: () => void | Promise<void>;
  destructive?: boolean;
};

type ItemActionsSheetProps = {
  visible: boolean;
  onClose: () => void;
  onRename?: () => void;
  onDelete?: () => Promise<void>;
  onShare?: () => Promise<void>;
  showShare?: boolean;
  extraActions?: ItemSheetAction[];
  deleteConfirmTitle?: string;
  deleteConfirmMessage?: string;
};

export function ItemActionsSheet({
  visible,
  onClose,
  onRename,
  onDelete,
  onShare,
  showShare = false,
  extraActions,
  deleteConfirmTitle = copy.content.deleteConfirmTitle,
  deleteConfirmMessage = copy.content.deleteConfirmMessage,
}: ItemActionsSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setConfirming(false);
      setBusy(false);
    }
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
          onPress={(e) => e.stopPropagation()}
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
          {confirming && onDelete ? (
            <>
              <AppText variant="h2">{deleteConfirmTitle}</AppText>
              <AppText variant="body" color="textMuted">
                {deleteConfirmMessage}
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
              {extraActions?.map((action) => (
                <Button
                  key={action.title}
                  title={action.title}
                  variant={action.destructive ? "danger" : "secondary"}
                  onPress={() => {
                    onClose();
                    void action.onPress();
                  }}
                />
              ))}
              {onRename ? (
                <Button
                  title={copy.content.rename}
                  variant="secondary"
                  onPress={() => {
                    onClose();
                    onRename();
                  }}
                />
              ) : null}
              {showShare && onShare ? (
                <Button
                  title={copy.content.share}
                  variant="outline"
                  onPress={() => {
                    void (async () => {
                      setBusy(true);
                      try {
                        await onShare();
                        closeAll();
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                />
              ) : null}
              {onDelete ? (
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
