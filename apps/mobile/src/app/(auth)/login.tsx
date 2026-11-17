import { Link } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { Button, Field, Screen, Title } from "../../components/ui";
import { getApiClient } from "../../lib/api";
import { apiErrorMessage } from "../../lib/format";
import { useAuth } from "../../providers/auth-provider";
import { colors } from "../../theme/colors";

export default function LoginScreen() {
  const { setSessionFromAuth } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    try {
      await getApiClient().login({ phone: phone.trim(), password });
      await setSessionFromAuth();
    } catch (error) {
      Alert.alert("ورود ناموفق", apiErrorMessage(error, "ورود ناموفق بود"));
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Title>ورود</Title>
          <Text style={styles.subtitle}>با شماره موبایل وارد شوید</Text>
          <Field
            label="شماره موبایل"
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="0912..."
            value={phone}
            onChangeText={setPhone}
          />
          <Field
            label="رمز عبور"
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
          />
          <Button
            title={loading ? "در حال ورود..." : "ورود"}
            disabled={loading || !phone.trim() || !password}
            onPress={() => void onSubmit()}
          />
          <Text style={styles.footer}>
            حساب ندارید؟{" "}
            <Link href="/register" style={styles.link}>
              ثبت‌نام
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingVertical: 24,
  },
  subtitle: {
    color: colors.textMuted,
    marginBottom: 8,
  },
  footer: {
    textAlign: "center",
    color: colors.textMuted,
    marginTop: 8,
  },
  link: {
    color: colors.secondary,
    fontWeight: "700",
  },
});
