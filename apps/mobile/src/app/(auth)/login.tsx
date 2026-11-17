import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { GradientHero } from "../../components/GradientHero";
import { Input } from "../../components/Input";
import { Screen } from "../../components/Screen";
import { copy } from "../../lib/copy";
import { apiErrorMessage } from "../../lib/format";
import { getApiClient } from "../../lib/api";
import { useAuth } from "../../providers/auth-provider";
import { useTheme } from "../../theme/theme";

export default function LoginScreen() {
  const { setSessionFromAuth } = useAuth();
  const { colors } = useTheme();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      await getApiClient().login({ phone: phone.trim(), password });
      await setSessionFromAuth();
    } catch (err) {
      setError(apiErrorMessage(err, copy.auth.loginFailed));
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
            <AppText variant="display">{copy.auth.welcomeBack}</AppText>
            <AppText variant="body" color="textMuted">
              {copy.auth.loginSubtitle}
            </AppText>
          </View>

          {error ? <ErrorBanner message={error} /> : null}

          <Input
            label={copy.auth.phone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder={copy.auth.phonePlaceholder}
            value={phone}
            onChangeText={setPhone}
          />
          <Input
            label={copy.auth.password}
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />
          <Button
            title={loading ? copy.auth.loggingIn : copy.auth.logIn}
            size="lg"
            loading={loading}
            disabled={loading || !phone.trim() || !password}
            onPress={() => void onSubmit()}
          />
          <AppText variant="body" color="textMuted" style={{ textAlign: "center", marginTop: 4 }}>
            {copy.auth.newHere}{" "}
            <Link href="/register" style={{ color: colors.primary, fontWeight: "700" }}>
              {copy.auth.createAccountLink}
            </Link>
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
