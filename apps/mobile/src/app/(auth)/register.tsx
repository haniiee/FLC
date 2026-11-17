import { Link } from "expo-router";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { Button, Field, Screen, Title } from "../../components/ui";
import { getApiClient } from "../../lib/api";
import { apiErrorMessage } from "../../lib/format";
import { useAuth } from "../../providers/auth-provider";
import { colors } from "../../theme/colors";

export default function RegisterScreen() {
  const { setSessionFromAuth } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    try {
      await getApiClient().register({
        phone: phone.trim(),
        password,
        displayName: displayName.trim(),
      });
      await setSessionFromAuth();
    } catch (error) {
      Alert.alert("ثبت‌نام ناموفق", apiErrorMessage(error, "ثبت‌نام ناموفق بود"));
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
          <Title>ثبت‌نام</Title>
          <Text style={styles.subtitle}>ساخت حساب جدید</Text>
          <Field
            label="نام"
            autoComplete="name"
            value={displayName}
            onChangeText={setDisplayName}
          />
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
            autoComplete="password-new"
            value={password}
            onChangeText={setPassword}
          />
          <Button
            title={loading ? "در حال ثبت‌نام..." : "ثبت‌نام"}
            disabled={loading || !displayName.trim() || !phone.trim() || password.length < 8}
            onPress={() => void onSubmit()}
          />
          <Text style={styles.footer}>
            قبلاً ثبت‌نام کرده‌اید؟{" "}
            <Link href="/login" style={styles.link}>
              ورود
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
