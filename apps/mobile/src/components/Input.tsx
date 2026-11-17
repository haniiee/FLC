import { Eye, EyeOff } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { copy } from "../lib/copy";
import { tokens } from "@app/brand";
import { useTheme } from "../theme/theme";
import { AppText } from "./AppText";

type InputProps = TextInputProps & {
  label: string;
  helper?: string;
  error?: string;
  leftIcon?: ReactNode;
};

export function Input({
  label,
  helper,
  error,
  leftIcon,
  secureTextEntry,
  style,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(secureTextEntry));
  const showToggle = Boolean(secureTextEntry);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;
  const borderWidth = focused || error ? 2 : 1;

  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label">{label}</AppText>
      <View
        style={
          {
            minHeight: 52,
            borderRadius: tokens.radius.md,
            borderWidth,
            borderColor,
            backgroundColor: colors.surface,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            gap: 10,
          } satisfies ViewStyle
        }
      >
        {leftIcon}
        <TextInput
          {...props}
          secureTextEntry={showToggle ? hidden : secureTextEntry}
          placeholderTextColor={colors.placeholder}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              minHeight: 48,
              color: colors.text,
              fontSize: 16,
              fontFamily: "PlusJakartaSans_400Regular",
              paddingVertical: 10,
            },
            style,
          ]}
        />
        {showToggle ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? copy.a11y.showPassword : copy.a11y.hidePassword}
            hitSlop={10}
            onPress={() => setHidden((v) => !v)}
            style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            {hidden ? (
              <Eye size={20} color={colors.textMuted} />
            ) : (
              <EyeOff size={20} color={colors.textMuted} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="caption" color="textMuted">
          {helper}
        </AppText>
      ) : null}
    </View>
  );
}
