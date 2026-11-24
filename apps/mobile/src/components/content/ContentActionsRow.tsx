import { Plus, Type } from "lucide-react-native";
import { type ReactNode } from "react";
import { I18nManager, Pressable, View } from "react-native";
import { copy } from "../../lib/copy";
import type { VoiceCapture } from "../../lib/upload-voice";
import { useTheme } from "../../theme/theme";
import { Button } from "../Button";
import { RecordButton } from "./RecordButton";

type ContentActionsRowProps = {
  onAddFile: () => void;
  onSendText: () => void;
  onVoiceCaptured: (capture: VoiceCapture) => void;
  voiceDisabled?: boolean;
  /** Optional leading control (e.g. New topic) — rendered before Add file. */
  leading?: ReactNode;
};

/**
 * Messenger-style actions: Add file grows from start, Record sits at the
 * trailing end. Under forceRTL we flip the row so Record stays on the
 * physical right (room to slide left to cancel).
 */
export function ContentActionsRow({
  onAddFile,
  onSendText,
  onVoiceCaptured,
  voiceDisabled,
  leading,
}: ContentActionsRowProps) {
  const { colors, spacing } = useTheme();

  return (
    <View
      style={{
        flexDirection: I18nManager.isRTL ? "row-reverse" : "row",
        alignItems: "center",
        gap: spacing[2] + 2,
      }}
    >
      {leading}
      <View style={{ flex: 1, alignSelf: "stretch" }}>
        <Button
          title={copy.content.addFile}
          leftIcon={<Plus size={18} color={colors.onPrimary} />}
          onPress={onAddFile}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.content.sendText}
        onPress={onSendText}
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Type size={20} color={colors.primary} />
      </Pressable>
      <RecordButton disabled={voiceDisabled} onCaptured={onVoiceCaptured} />
    </View>
  );
}
