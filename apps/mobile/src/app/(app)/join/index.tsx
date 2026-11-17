import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AppText } from "../../../components/AppText";
import { Button } from "../../../components/Button";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { Input } from "../../../components/Input";
import { Screen } from "../../../components/Screen";
import { getApiClient } from "../../../lib/api";
import { parseJoinCodeFromUrl } from "../../../lib/deep-link";
import { copy } from "../../../lib/copy";
import { apiErrorMessage } from "../../../lib/format";
import { useTheme } from "../../../theme/theme";

export default function JoinScreen() {
  const { colors } = useTheme();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onJoin() {
    const parsed = parseJoinCodeFromUrl(code) ?? code.trim();
    if (!parsed) {
      setError(copy.join.invalidCode);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getApiClient().joinInvite(parsed);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/groups/${result.groupId}`);
    } catch (err) {
      setError(apiErrorMessage(err, copy.join.joinFailed));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <View style={{ gap: 16, paddingTop: 12 }}>
        <View style={{ gap: 6 }}>
          <AppText variant="display">{copy.join.title}</AppText>
          <AppText variant="body" color="textMuted">
            {copy.join.subtitle}
          </AppText>
        </View>
        {error ? <ErrorBanner message={error} /> : null}
        <Input
          label={copy.join.codeLabel}
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
          placeholder={copy.join.codePlaceholder}
          style={{
            fontSize: 24,
            letterSpacing: 4,
            fontFamily: "PlusJakartaSans_700Bold",
            color: colors.text,
          }}
        />
        <Button
          title={loading ? copy.join.joining : copy.join.join}
          size="lg"
          loading={loading}
          disabled={loading || !code.trim()}
          onPress={() => void onJoin()}
        />
      </View>
    </Screen>
  );
}
