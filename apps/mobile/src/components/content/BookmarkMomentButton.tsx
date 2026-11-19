import { useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiClient } from "../../lib/api";
import { bookmarksQueryKey, formatBookmarkClock } from "../../lib/bookmark-logic";
import { copy } from "../../lib/copy";
import { apiErrorMessage } from "../../lib/format";
import { usePlayerProgress } from "../../player/context";
import { useTheme } from "../../theme/theme";
import { AppText } from "../AppText";
import { Button } from "../Button";
import { Input } from "../Input";

export function BookmarkMomentButton({ fileId }: { fileId: string }) {
  const { position } = usePlayerProgress();
  const positionRef = useRef(position);
  positionRef.current = position;
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [positionMs, setPositionMs] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
      setPositionMs(null);
      setNote("");
    }, 1200);
    return () => clearTimeout(timer);
  }, [toast]);

  async function save() {
    if (positionMs == null || saving) return;
    setSaving(true);
    try {
      const trimmed = note.trim();
      const created = await getApiClient().bookmarks.create({
        fileId,
        positionMs,
        note: trimmed.length > 0 ? trimmed : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: bookmarksQueryKey });
      setToast(copy.library.bookmarkedAt(formatBookmarkClock(created.positionMs ?? positionMs)));
    } catch (error) {
      Alert.alert(copy.content.actionFailed, apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.library.bookmarkThisMoment}
        hitSlop={8}
        onPress={() => {
          setToast(null);
          setNote("");
          setPositionMs(Math.max(0, Math.round(positionRef.current * 1000)));
        }}
        style={{
          width: 48,
          height: 48,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BookmarkPlus size={22} color={colors.text} />
      </Pressable>
      <Modal
        visible={positionMs != null}
        animationType="fade"
        transparent
        onRequestClose={() => setPositionMs(null)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.content.cancel}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => {
            if (!saving) setPositionMs(null);
          }}
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
              gap: 16,
            }}
          >
            <AppText variant="h2">{copy.library.bookmarkThisMoment}</AppText>
            {toast ? (
              <View accessibilityLiveRegion="polite">
                <AppText variant="body" color="primary">
                  {toast}
                </AppText>
              </View>
            ) : (
              <>
                <AppText variant="body" color="textMuted">
                  {formatBookmarkClock(positionMs ?? 0)}
                </AppText>
                <Input
                  label={copy.library.note}
                  value={note}
                  onChangeText={setNote}
                  placeholder={copy.library.notePlaceholder}
                  maxLength={500}
                />
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={copy.content.cancel}
                      variant="outline"
                      onPress={() => setPositionMs(null)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={copy.content.save}
                      loading={saving}
                      disabled={saving}
                      onPress={() => void save()}
                    />
                  </View>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
