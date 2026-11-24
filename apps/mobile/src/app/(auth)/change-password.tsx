import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { GradientHero } from "../../components/GradientHero";
import { Input } from "../../components/Input";
import { Screen } from "../../components/Screen";
import { getApiClient } from "../../lib/api";
import { copy } from "../../lib/copy";
import { apiErrorMessage } from "../../lib/format";
import { useAuth } from "../../providers/auth-provider";
import { useTheme } from "../../theme/theme";

export default function ChangePasswordScreen() {
  const { refreshUser, logout } = useAuth();
  const { colors } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (newPassword !== confirmPassword) {
      setError(copy.auth.passwordMismatch);
      return;
    }
    if (newPassword.length < 8) {
      setError(copy.auth.passwordTooShort);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await getApiClient().changePassword({ currentPassword, newPassword });
      await refreshUser();
    } catch (err) {
      setError(apiErrorMessage(err, copy.auth.changePasswordFailed));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ gap: 16, paddingVertical: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <GradientHero style={{ paddingVertical: 22 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: "#FFFFFF",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AppText variant="h3" style={{ color: colors.heroFrom }}>
                  {copy.brand.short}
                </AppText>
              </View>
              <AppText variant="label" color="onHero">
                {copy.brand.academy}
              </AppText>
            </View>
          </GradientHero>

          <View style={{ gap: 6, marginTop: 8 }}>
            <AppText variant="display">{copy.auth.changePasswordTitle}</AppText>
            <AppText variant="body" color="textMuted">
              {copy.auth.changePasswordSubtitle}
            </AppText>
          </View>

          {error ? <ErrorBanner message={error} /> : null}

          <Input
            label={copy.auth.currentPassword}
            secureTextEntry
            autoComplete="password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
          <Input
            label={copy.auth.newPassword}
            secureTextEntry
            autoComplete="new-password"
            value={newPassword}
            onChangeText={setNewPassword}
          />
          <Input
            label={copy.auth.confirmNewPassword}
            secureTextEntry
            autoComplete="new-password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <Button
            title={loading ? copy.auth.updatingPassword : copy.auth.updatePassword}
            size="lg"
            loading={loading}
            disabled={loading || !currentPassword || !newPassword || !confirmPassword}
            onPress={() => void onSubmit()}
          />
          <Button
            title={copy.auth.signOut}
            variant="ghost"
            disabled={loading}
            onPress={() => void logout()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
