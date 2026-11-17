import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { Button, Field, Screen, Title } from "../../../components/ui";
import { parseJoinCodeFromUrl } from "../../../lib/deep-link";
import { getApiClient } from "../../../lib/api";
import { apiErrorMessage } from "../../../lib/format";
import { colors } from "../../../theme/colors";

export default function JoinScreen() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function onJoin() {
    const parsed = parseJoinCodeFromUrl(code) ?? code.trim();
    if (!parsed) {
      Alert.alert("کد نامعتبر", "کد دعوت را وارد کنید");
      return;
    }
    setLoading(true);
    try {
      const result = await getApiClient().joinInvite(parsed);
      router.replace(`/groups/${result.groupId}`);
    } catch (error) {
      Alert.alert("پیوستن ناموفق", apiErrorMessage(error, "دعوت‌نامه معتبر نیست"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Title>پیوستن به کلاس</Title>
      <Text style={styles.subtitle}>کد دعوت یا لینک را وارد کنید</Text>
      <Field
        label="کد دعوت"
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={setCode}
        placeholder="مثلاً ABC123"
      />
      <Button
        title={loading ? "در حال پیوستن..." : "پیوستن"}
        disabled={loading || !code.trim()}
        onPress={() => void onJoin()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: colors.textMuted,
    marginVertical: 12,
  },
});
